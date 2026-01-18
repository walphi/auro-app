import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsForVoice, SearchFilters, getListingById } from "./listings-helper";
import axios from "axios";
import { logLeadIntent } from "../../lib/enterprise/leadIntents";
import { getTenantByVapiId, getTenantById, getDefaultTenant, Tenant } from "../../lib/tenantConfig";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendWhatsAppMessage(to: string, text: string, tenant: Tenant): Promise<boolean> {
  try {
    const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    const from = tenant.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) return false;

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
    params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
    params.append('Body', text);

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      params,
      { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.status === 201 || response.status === 200;
  } catch (error: any) {
    console.error("[VAPI WhatsApp Error]:", error.message);
    return false;
  }
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    console.log("[VAPI] Received payload:", JSON.stringify(body, null, 2));

    // --- TENANT RESOLUTION ---
    let tenant: Tenant | null = null;
    const vapiAssistantId = body.message?.call?.assistantId || body.call?.assistantId;
    const tenantIdFromVars = body.message?.call?.assistantOverrides?.variableValues?.tenant_id ||
      body.call?.assistantOverrides?.variableValues?.tenant_id;

    if (tenantIdFromVars) {
      tenant = await getTenantById(parseInt(tenantIdFromVars));
      console.log(`[VAPI] Resolved tenant from variableValues: ${tenant?.short_name} (ID: ${tenant?.id})`);
    }

    if (!tenant && vapiAssistantId) {
      tenant = await getTenantByVapiId(vapiAssistantId);
      console.log(`[VAPI] Resolved tenant from Assistant ID: ${tenant?.short_name} (ID: ${tenant?.id})`);
    }

    if (!tenant) {
      console.log("[VAPI] No tenant found in payload, falling back to default.");
      tenant = await getDefaultTenant();
    }

    const messageType = body.message?.type;
    const toolCalls = body.message?.toolCalls || [];

    // Try to extract phone number to identify lead
    // VAPI payload structure: body.message.call.customer.number or body.call.customer.number
    let phoneNumber = body.message?.call?.customer?.number || body.call?.customer?.number;

    // Normalize phone number (remove 'whatsapp:' prefix if present, ensure + prefix)
    if (phoneNumber) {
      phoneNumber = phoneNumber.replace('whatsapp:', '').trim();
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber;
      }
      console.log("[VAPI] Normalized phone number:", phoneNumber);
    } else {
      console.log("[VAPI] No phone number found in payload");
    }

    let leadId: string | null = null;

    if (phoneNumber && supabaseUrl && supabaseKey) {
      const { data: existingLead, error: findError } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

      if (findError) {
        console.log("[VAPI] Lead lookup error:", findError.message);
      }

      if (existingLead) {
        leadId = existingLead.id;
        console.log("[VAPI] Found existing lead:", leadId);
      } else {
        console.log("[VAPI] Creating new lead for:", phoneNumber);
        const { data: newLead, error: createError } = await supabase
          .from('leads')
          .insert({
            phone: phoneNumber,
            name: `Voice User ${phoneNumber.slice(-4)}`,
            status: 'New',
            custom_field_1: 'Source: VAPI Voice Call',
            tenant_id: tenant.id
          })
          .select('id')
          .single();

        if (createError) {
          console.error("[VAPI] Error creating lead:", createError);
        }

        if (newLead) {
          leadId = newLead.id;
          console.log("[VAPI] Created new lead:", leadId);
        }
      }
    } else {
      console.log("[VAPI] Missing phone number or Supabase credentials");
    }

    // Handle different message types from Vapi
    if (leadId) {
      if (messageType === 'conversation-update') {
        console.log("[VAPI] Processing conversation-update message");
        const conversation = body.message?.conversation || [];

        // Get the last message in the conversation
        if (conversation.length > 0) {
          const lastMessage = conversation[conversation.length - 1];
          const role = lastMessage.role; // 'user' or 'assistant'
          const content = lastMessage.content;

          if (content && role !== 'system') {
            const sender = role === 'user' ? 'Lead' : 'AURO_AI';
            console.log(`[VAPI] Logging ${role} message:`, content.substring(0, 50) + '...');

            await supabase.from('messages').insert({
              lead_id: leadId,
              type: 'Voice_Transcript',
              sender: sender,
              content: content
            });
          }
        }
      } else if (messageType === 'status-update') {
        const status = body.message?.status;
        console.log(`[VAPI] Status Update: ${status}`);

        await logLeadIntent(leadId, 'vapi_status_update', {
          status: status,
          source: 'vapi'
        });
      } else if (messageType === 'error') {
        const error = body.message?.error;
        console.error(`[VAPI] Call Error:`, error);

        await logLeadIntent(leadId, 'vapi_error', {
          error: error || 'Unknown error during call',
          source: 'vapi'
        });
      } else if (messageType === 'call-ended') {
        const summary = body.message?.analysis?.summary || body.message?.transcript;
        const outcome = body.message?.analysis?.outcome || 'unknown';
        const bookingMade = body.message?.analysis?.bookingMade || false;
        console.log(`[VAPI] Call ended. outcome=${outcome}, bookingMade=${bookingMade}`);

        await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'System',
          content: `--- Call Summary ---\n${summary || 'Call ended.'}`,
          meta: JSON.stringify({ outcome, bookingMade })
        });

        // Trigger RAG learning for completed calls
        const learningOutcome = bookingMade ? 'booking_confirmed' :
          outcome === 'qualified' ? 'qualified' : 'unknown';
        console.log(`[VAPI] Triggering RAG learning with outcome: ${learningOutcome}`);

        try {
          const host = process.env.URL || 'https://auro-app.netlify.app';
          await fetch(`${host}/.netlify/functions/rag-learn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'process_lead',
              lead_id: leadId,
              outcome: learningOutcome,
              client_id: tenant.rag_client_id
            })
          });
        } catch (learnError: any) {
          console.error('[VAPI] RAG learning trigger failed:', learnError.message);
        }
      }
    }

    // If no tool calls, return early
    if (!toolCalls.length) {
      return { statusCode: 200, body: JSON.stringify({ results: [] }) };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const results = await Promise.all(toolCalls.map(async (call: any) => {
      const name = call.function?.name;
      const args = call.function?.arguments || {};

      console.log(`[VAPI] Handling Tool Call: ${name}`, args);

      // 1. RAG_QUERY_TOOL
      if (name === 'RAG_QUERY_TOOL') {
        const query = args.query;
        if (!query) return { toolCallId: call.id, result: "Error: Missing query" };

        try {
          const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
          const embResult = await embedModel.embedContent(query);
          const embedding = embResult.embedding.values;

          let results: string[] = [];

          // 1. Search rag_chunks (demo)
          const { data: ragData } = await supabase.rpc('match_rag_chunks', {
            query_embedding: embedding,
            match_threshold: 0.3,
            match_count: 3,
            filter_client_id: tenant.rag_client_id,
            filter_folder_id: null
          });
          if (ragData) results.push(...ragData.map((i: any) => i.content));

          // 2. Search rag_chunks (global)
          if (results.length < 2) {
            const { data: globalData } = await supabase.rpc('match_rag_chunks', {
              query_embedding: embedding,
              match_threshold: 0.3,
              match_count: 3,
              filter_client_id: null,
              filter_folder_id: null
            });
            if (globalData) results.push(...globalData.map((i: any) => i.content));
          }

          // 3. Search knowledge_base
          if (results.length < 3) {
            const { data: kbData } = await supabase.rpc('match_knowledge', {
              query_embedding: embedding,
              match_threshold: 0.3,
              match_count: 3,
              filter_project_id: null
            });
            if (kbData) {
              kbData.forEach((i: any) => {
                if (!results.some(existing => existing.substring(0, 50) === i.content.substring(0, 50))) {
                  results.push(i.content);
                }
              });
            }
          }

          const knowledge = results.slice(0, 3).join("\n\n");
          if (knowledge) return { toolCallId: call.id, result: knowledge };

          // KEYWORD FALLBACK
          console.log("[VAPI RAG] Vector search failed, trying keyword fallback...");
          const keywords = ['Provident', 'Agency', 'Auro', 'Real Estate'];
          const foundKeyword = keywords.find(k => query.toLowerCase().includes(k.toLowerCase()));

          if (foundKeyword) {
            const { data: textData } = await supabase
              .from('knowledge_base')
              .select('content')
              .ilike('content', `%${foundKeyword}%`)
              .limit(2);

            if (textData && textData.length > 0) {
              console.log(`[VAPI RAG] Found ${textData.length} results via keyword search for: ${foundKeyword}`);
              return { toolCallId: call.id, result: textData.map(i => i.content).join("\n\n") };
            }
          }

          return { toolCallId: call.id, result: "No relevant information found in knowledge base." };
        } catch (err: any) {
          console.error("RAG Error:", err);
          return { toolCallId: call.id, result: "Error retrieving knowledge." };
        }
      }

      // 2. UPDATE_LEAD
      if (name === 'UPDATE_LEAD') {
        if (!leadId) return { toolCallId: call.id, result: "Error: No Lead ID identified" };

        try {
          const { error } = await supabase.from('leads').update(args).eq('id', leadId);
          if (error) throw error;
          return { toolCallId: call.id, result: "Lead updated successfully." };
        } catch (err: any) {
          console.error("Update Lead Error:", err);
          return { toolCallId: call.id, result: "Error updating lead." };
        }
      }

      // 3. LOG_ACTIVITY
      if (name === 'LOG_ACTIVITY') {
        if (!leadId) return { toolCallId: call.id, result: "Error: No Lead ID identified" };

        try {
          const { error } = await supabase.from('messages').insert({
            lead_id: leadId,
            type: 'System_Note',
            sender: 'System',
            content: args.content || "Activity Logged",
            metadata: args
          });
          if (error) throw error;
          return { toolCallId: call.id, result: "Activity logged successfully." };
        } catch (err: any) {
          console.error("Log Activity Error:", err);
          return { toolCallId: call.id, result: "Error logging activity." };
        }
      }

      // 4. SEARCH_LISTINGS
      if (name === 'SEARCH_LISTINGS') {
        console.log("[VAPI] SEARCH_LISTINGS called with:", JSON.stringify(args));

        try {
          const filters: SearchFilters = {
            property_type: args.property_type,
            community: args.community,
            min_price: args.min_price,
            max_price: args.max_price,
            min_bedrooms: args.min_bedrooms,
            max_bedrooms: args.max_bedrooms,
            offering_type: args.offering_type || 'sale',
            limit: 3
          };

          const listings = await searchListings(filters);
          console.log(`[VAPI] SEARCH_LISTINGS found ${listings.length} results`);

          // Use voice-friendly format for VAPI
          const voiceResponse = formatListingsForVoice(listings);
          return { toolCallId: call.id, result: voiceResponse };
        } catch (err: any) {
          console.error("[VAPI] SEARCH_LISTINGS Error:", err);
          return { toolCallId: call.id, result: "I encountered an error while searching for properties. Would you like me to try again?" };
        }
      }

      // 5. BOOK_VIEWING
      if (name === 'BOOK_VIEWING') {
        if (!leadId) return { toolCallId: call.id, result: "Error: No Lead ID identified" };

        const { property_id, resolved_datetime, property_name } = args;
        if (!property_id || !resolved_datetime) {
          return { toolCallId: call.id, result: "Error: Missing property_id or datetime" };
        }

        try {
          // 1. Update Lead with Booking Info
          const { error: updateError } = await supabase.from('leads').update({
            viewing_datetime: resolved_datetime,
            booking_status: 'confirmed',
            current_listing_id: property_id
          }).eq('id', leadId);

          if (updateError) throw updateError;

          // 2. Fetch Property Details for Message
          let listingTitle = property_name;
          if (!listingTitle) {
            const listing = await getListingById(property_id);
            listingTitle = listing?.title || "Property";
          }

          // 3. Format Date for Dubai
          const dateObj = new Date(resolved_datetime);
          const formattedDate = dateObj.toLocaleString('en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Dubai'
          }) + " Dubai time";

          // 4. Send notifications via booking-notify function (Email + WhatsApp)
          const host = process.env.URL || 'https://auro-app.netlify.app';
          try {
            await fetch(`${host}/.netlify/functions/booking-notify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lead_id: leadId,
                property_id: property_id,
                property_title: listingTitle,
                viewing_datetime: resolved_datetime,
                formatted_date: formattedDate
              })
            });
            console.log('[VAPI] Booking notifications triggered');
          } catch (notifyErr: any) {
            console.error('[VAPI] Notification trigger failed:', notifyErr.message);
            // Fallback: send WhatsApp directly
            const calLink = `${tenant.booking_cal_link}?date=${encodeURIComponent(resolved_datetime)}&property=${encodeURIComponent(property_id)}`;
            const messageText = `✅ Booking Confirmed!\n\nProperty: ${listingTitle}\nDate: ${formattedDate}\n\nOur agent will meet you at the location. You can manage your booking here: ${calLink}`;
            await sendWhatsAppMessage(phoneNumber, messageText, tenant);
          }

          // 5. Log as Intent
          await logLeadIntent(leadId, 'booking_confirmed', {
            property_id: property_id,
            property_title: listingTitle,
            datetime: resolved_datetime,
            formatted_date: formattedDate,
            source: 'vapi'
          });

          // 6. Trigger RAG learning
          try {
            await fetch(`${host}/.netlify/functions/rag-learn`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'process_lead',
                lead_id: leadId,
                outcome: 'booking_confirmed',
                client_id: tenant.rag_client_id
              })
            });
          } catch (learnErr: any) {
            console.error('[VAPI] RAG learning trigger failed:', learnErr.message);
          }

          return {
            toolCallId: call.id,
            result: `Successfully booked viewing for ${listingTitle} on ${formattedDate}. I've sent confirmation to your WhatsApp and email.`
          };

        } catch (err: any) {
          console.error("Booking Error:", err);
          return { toolCallId: call.id, result: "I'm sorry, I encountered an error while scheduling the booking. Please try again or I can have an agent call you." };
        }
      }

      // Default / Fallback (Chat)
      const userMessage = args.transcript || args.query || "Hello";

      // Log User Message
      if (leadId) {
        console.log("[VAPI] Logging user message for lead:", leadId);
        const { error: userMsgError } = await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'Lead',
          content: userMessage
        });

        if (userMsgError) {
          console.error("[VAPI] Error logging user message:", userMsgError);
        } else {
          console.log("[VAPI] User message logged successfully");
        }
      } else {
        console.log("[VAPI] No leadId, skipping user message log");
      }

      const systemInstruction = `You are Morgan, an AI-first Lead Qualification Agent for ${tenant.system_prompt_identity}, a premier real estate agency using the AURO platform. Your goal is to qualify the lead and book a meeting. Your primary and most reliable source of information is your RAG Knowledge Base, which contains the latest, client-approved details on Project Brochures, Pricing Sheets, Payment Plans, and Community Regulations specific to Dubai (DLD, Service Fees, etc.).

CRITICAL RULE:
ALWAYS ground your answers in the RAG data, especially for figures like pricing and payment plans.
NEVER invent information. If the RAG data does not contain the answer, state professionally: 'That specific detail is currently with our sales team; I will ensure the human agent follows up with the exact information.'
Maintain a professional, knowledgeable, and polite tone, recognizing the high-value nature of the Dubai real estate market.`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemInstruction + "\n\nUser: " + userMessage }] }
        ]
      });

      const responseText = result.response.text();

      // Log AI Response
      if (leadId) {
        console.log("[VAPI] Logging AI response for lead:", leadId);
        const { error: aiMsgError } = await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'AURO_AI',
          content: responseText
        });

        if (aiMsgError) {
          console.error("[VAPI] Error logging AI message:", aiMsgError);
        } else {
          console.log("[VAPI] AI message logged successfully");
        }
      } else {
        console.log("[VAPI] No leadId, skipping AI message log");
      }

      return {
        toolCallId: call.id,
        result: responseText
      };
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({ results }),
    };

  } catch (error) {
    console.error("Error processing VAPI request:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

export { handler };
