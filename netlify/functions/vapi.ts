import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsForVoice, SearchFilters, getListingById } from "./listings-helper";
import axios from "axios";
import { logLeadIntent } from "../../lib/enterprise/leadIntents";
import { getTenantByVapiId, getTenantById, getDefaultTenant, Tenant } from "../../lib/tenantConfig";
import { createCalComBooking } from "../../lib/calCom";
import { genAI, callGemini } from "../../lib/gemini";

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendWhatsAppMessage(to: string, text: string, tenant: Tenant): Promise<boolean> {
  try {
    const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    let from = tenant.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+12098994972';

    // Safety check: specific override to ensure we never use sandbox for this flow
    if (from.includes('14155238886')) {
      console.warn('[VAPI WhatsApp] Detected sandbox number in config, switching to production');
      from = 'whatsapp:+12098994972';
    }

    if (!accountSid || !authToken) {
      console.error('[VAPI WhatsApp] Missing credentials');
      return false;
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromFormatted = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

    console.log('[VAPI WhatsApp] Sending message:', {
      to: toFormatted,
      from: fromFormatted,
      bodyLength: text.length
    });

    const params = new URLSearchParams();
    params.append('To', toFormatted);
    params.append('From', fromFormatted);
    params.append('Body', text);

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      params,
      { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('[VAPI WhatsApp] Twilio response:', {
      status: response.status,
      messageSid: response.data?.sid,
      messageStatus: response.data?.status,
      to: response.data?.to,
      from: response.data?.from
    });

    return response.status === 201 || response.status === 200;
  } catch (error: any) {
    console.error('[VAPI WhatsApp Error]:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
}

/**
 * Extracts the correct structured data from Vapi payload.
 * Priority: artifact.structuredOutputs (matched by name or schema), then analysis.structuredData
 */
/**
 * Formats a human-friendly WhatsApp confirmation message for bookings.
 */
function buildWhatsappConfirmationMessage(firstName: string, meetingStartIso: string, meetingUrl?: string): string {
  const dateObj = new Date(meetingStartIso);
  const dayName = dateObj.toLocaleString('en-US', { weekday: 'long', timeZone: 'Asia/Dubai' });
  const dateStr = dateObj.toLocaleString('en-US', { day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });
  const timeStr = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' });

  let message = `Hi ${firstName}, your consultation with Provident is confirmed for ${dayName}, ${dateStr} at ${timeStr} (Dubai time). You’ll receive a calendar invite by email. If you need to reschedule, just reply to this message.`;

  if (meetingUrl) {
    message += `\n\nHere is your meeting link: ${meetingUrl}`;
  }

  return message;
}

function getStructuredData(body: any): any {
  const analysis = body.message?.analysis || body.call?.analysis || {};
  const artifact = body.message?.artifact || body.call?.artifact || {};
  const structuredOutputs = artifact.structuredOutputs || {};

  // Vapi sends structuredOutputs as an object keyed by ID
  const outputsArray = Object.values(structuredOutputs) as any[];

  // 1. Look for a consolidated booking artifact first
  const consolidated = outputsArray.find((o: any) =>
    o.name === 'Morgan Booking' ||
    o.name === 'Consultation Booking' ||
    (o.result && o.result.meeting_scheduled !== undefined && o.result.meeting_start_iso !== undefined)
  );

  if (consolidated) {
    console.log("[VAPI] Found consolidated booking artifact:", consolidated.name);
    return consolidated.result || {};
  }

  // 2. Harvesting individual fields from the array of structured outputs
  const harvested: any = {};
  const fieldsToHarvest = [
    'meeting_scheduled', 'meeting_start_iso', 'first_name', 'last_name',
    'email', 'phone', 'budget', 'property_type', 'preferred_area'
  ];

  outputsArray.forEach(o => {
    if (o.name && fieldsToHarvest.includes(o.name)) {
      harvested[o.name] = o.result;
    }
  });

  if (harvested.meeting_scheduled !== undefined) {
    console.log("[VAPI] Successfully harvested individual structured fields:", Object.keys(harvested));
    return harvested;
  }

  // 3. Fallback to analysis.structuredData
  const fallback = analysis.structuredData;
  if (fallback) {
    console.log("[VAPI] Using analysis.structuredData fallback");
    return fallback;
  }

  console.log('[VAPI] No booking fields found in artifact/analysis', {
    availableNames: outputsArray.map((o) => o.name),
  });
  return {};
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
    let leadData: any = null;

    if (phoneNumber && supabaseUrl && supabaseKey) {
      const { data: existingLead, error: findError } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phoneNumber)
        .single();

      if (findError) {
        console.log("[VAPI] Lead lookup error:", findError.message);
      }

      if (existingLead) {
        leadId = existingLead.id;
        leadData = existingLead;
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
          .select('*')
          .single();

        if (createError) {
          console.error("[VAPI] Error creating lead:", createError);
        }

        if (newLead) {
          leadId = newLead.id;
          leadData = newLead;
          console.log("[VAPI] Created new lead:", leadId);
        }
      }
    } else {
      console.log("[VAPI] Missing phone number or Supabase credentials");
    }

    // Fallback for name and email from Vapi variables if missing in DB
    const nameFromVars = body.message?.call?.assistantOverrides?.variableValues?.name ||
      body.call?.assistantOverrides?.variableValues?.name;
    const emailFromVars = body.message?.call?.assistantOverrides?.variableValues?.email ||
      body.call?.assistantOverrides?.variableValues?.email;

    if (leadData) {
      if (!leadData.name && nameFromVars) leadData.name = nameFromVars;
      if (!leadData.email && emailFromVars) leadData.email = emailFromVars;
    }

    let propertyContext = "None";
    if (leadData?.current_listing_id) {
      const { data: listing } = await getListingById(leadData.current_listing_id);
      if (listing) {
        propertyContext = `${listing.title} in ${listing.community}${listing.sub_community ? ` (${listing.sub_community})` : ""} - AED ${listing.price?.toLocaleString()}`;
      } else {
        propertyContext = leadData.current_listing_id;
      }
    } else if (leadData?.custom_field_1 && leadData.custom_field_1.includes('Interest:')) {
      propertyContext = leadData.custom_field_1;
    }

    const contextString = (leadData || nameFromVars || emailFromVars) ? `
CURRENT LEAD PROFILE:
- Name: ${leadData?.name || nameFromVars || "Unknown"}
- Phone: ${leadData?.phone || phoneNumber || "Unknown"}
- Email: ${leadData?.email || emailFromVars || "Unknown"}
- Budget: ${leadData?.budget || "Unknown"}
- Location: ${leadData?.location || "Unknown"}
- Property Type: ${leadData?.property_type || "Unknown"}
- Timeline: ${leadData?.timeline || "Unknown"}
- Financing: ${leadData?.financing || "Unknown"}
- Most recent property interest: ${propertyContext}
- Project context: ${leadData?.project_id || "None"}
- Booking: ${leadData?.viewing_datetime || "None"}
` : "NEW LEAD - No context.";

    let dubaiTime = "";
    try {
      dubaiTime = new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: 'Asia/Dubai'
      }).format(new Date());
    } catch (e) {
      dubaiTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });
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
      } else if (messageType === 'call-ended' || messageType === 'end-of-call-report') {
        const analysis = body.message?.analysis || body.call?.analysis || {};
        const summary = analysis.summary || body.message?.transcript;
        const outcome = analysis.outcome || 'unknown';
        const bookingMade = analysis.bookingMade || false;
        console.log(`[VAPI] Call ended/Report received. outcome=${outcome}, bookingMade=${bookingMade}`);

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

        // --- NEW: CAL.COM BOOKING LOGIC ---
        const structuredData = getStructuredData(body);
        const meetingScheduled = structuredData.meeting_scheduled === true ||
          structuredData.meeting_scheduled === 'true';

        // Explicitly log the structured data being used for booking
        if (meetingScheduled || structuredData.meeting_scheduled !== undefined) {
          console.log('Morgan structured booking output', {
            meeting_scheduled: structuredData.meeting_scheduled,
            meeting_start_iso: structuredData.meeting_start_iso,
            first_name: structuredData.first_name,
            last_name: structuredData.last_name,
            email: structuredData.email,
            phone: structuredData.phone,
            budget: structuredData.budget,
            property_type: structuredData.property_type,
            preferred_area: structuredData.preferred_area,
            lead_id: leadId,
            tenant_id: tenant.id,
            vapi_call_id: body.message?.call?.id || body.call?.id
          });
        }

        if (meetingScheduled && leadId) {
          const meetingStartIso = structuredData.meeting_start_iso;

          if (meetingStartIso) {
            console.log(`[VAPI] Scheduling Cal.com booking for lead ${leadId} at ${meetingStartIso}`);

            // Resolve Event Type ID (Provident = 4644939)
            let eventTypeIdAttr = process.env.CALCOM_EVENT_TYPE_ID_PROVIDENT || "4644939";
            if (tenant.id !== 1) {
              const tenantEnvKey = `CALCOM_EVENT_TYPE_ID_${tenant.short_name?.toUpperCase()}`;
              eventTypeIdAttr = process.env[tenantEnvKey] || eventTypeIdAttr;
            }
            const eventTypeId = parseInt(eventTypeIdAttr);

            try {
              // Improvement: Ignore 'WhatsApp' placeholder names
              const dbName = leadData?.name && !leadData.name.includes('WhatsApp Lead') ? leadData.name : '';

              const firstName = structuredData.first_name || dbName.split(' ')[0] || 'Client';
              const lastName = structuredData.last_name || dbName.split(' ').slice(1).join(' ') || '';

              // SANITIZATION HELPERS
              const sanitizeEmail = (e: string) => {
                if (!e) return "";
                return e.toLowerCase()
                  .replace(/\s+at\s+/g, '@')
                  .replace(/\s+dot\s+/g, '.')
                  .replace(/\s+/g, '');
              };

              const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
              let cleanEmail = sanitizeEmail(structuredData.email);

              // If sanitized email from call is invalid, try leadData as fallback
              if (!isValidEmail(cleanEmail)) {
                console.log(`[VAPI] Call-derived email "${cleanEmail}" is invalid.`);
                if (leadData?.email && isValidEmail(leadData.email)) {
                  console.log(`[VAPI] Falling back to lead database email: ${leadData.email}`);
                  cleanEmail = leadData.email;
                }
              }

              const rawPhone = structuredData.phone || phoneNumber || leadData?.phone || '';

              const calResult = await createCalComBooking({
                eventTypeId,
                start: meetingStartIso,
                name: `${firstName} ${lastName}`.trim(),
                email: cleanEmail,
                phoneNumber: rawPhone,
                metadata: {
                  budget: String(structuredData.budget || leadData?.budget || ""),
                  property_type: String(structuredData.property_type || leadData?.property_type || ""),
                  preferred_area: String(structuredData.preferred_area || leadData?.location || ""),
                  lead_id: String(leadId),
                  tenant_id: String(tenant.id),
                  call_id: String(body.message?.call?.id || body.call?.id || "")
                }
              });

              // Calculate end time
              const endDate = new Date(new Date(meetingStartIso).getTime() + 30 * 60000);

              // Store in DB (Upsert to handle retries gracefully)
              const { error: insertError } = await supabase.from('bookings').upsert({
                lead_id: leadId,
                tenant_id: tenant.id,
                booking_id: calResult.bookingId,
                booking_provider: 'calcom',
                meeting_start_iso: meetingStartIso,
                meeting_end_iso: endDate.toISOString(),
                status: 'confirmed',
                meta: {
                  uid: calResult.uid,
                  meeting_url: calResult.meetingUrl,
                  call_id: body.message?.call?.id || body.call?.id,
                  structured_data: structuredData
                }
              }, {
                onConflict: 'lead_id,tenant_id,meeting_start_iso'
              });

              if (insertError) {
                console.error('[VAPI] Booking DB Error:', insertError.message);
              }

              // Update Lead
              await supabase.from('leads').update({
                booking_status: 'confirmed',
                viewing_datetime: meetingStartIso
              }).eq('id', leadId);

              // Log success note
              await supabase.from('messages').insert({
                lead_id: leadId,
                type: 'System_Note',
                sender: 'System',
                content: `✅ Cal.com Consultation Booked via Vapi\nTime: ${new Date(meetingStartIso).toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}\nLink: ${calResult.meetingUrl || 'Check Cal.com'}`
              });

              console.log(`[VAPI] Successfully created Cal.com booking: ${calResult.bookingId}`);

              // 5. WhatsApp Confirmation
              if (tenant.id === 1) {
                try {
                  // Check if confirmation was already sent to avoid double-sending on retries
                  const { data: existingBooking } = await supabase
                    .from('bookings')
                    .select('meta')
                    .eq('booking_id', calResult.bookingId)
                    .single();

                  if (existingBooking?.meta?.whatsapp_confirmation_sent) {
                    console.log('[WhatsApp] Confirmation already sent, skipping');
                  } else {
                    const phoneForWhatsapp = leadData?.phone || rawPhone;
                    console.log('[WhatsApp] Using phone for confirmation:', phoneForWhatsapp);

                    const whatsappMessage = buildWhatsappConfirmationMessage(
                      firstName,
                      meetingStartIso,
                      calResult.meetingUrl || calResult.raw?.meetingUrl
                    );

                    const sent = await sendWhatsAppMessage(phoneForWhatsapp, whatsappMessage, tenant);

                    if (sent) {
                      console.log('[WhatsApp] Sent booking confirmation', {
                        phone: phoneForWhatsapp,
                        leadId,
                        bookingId: calResult.bookingId
                      });

                      // Update meta to track that confirmation was sent
                      await supabase.from('bookings').update({
                        meta: {
                          ...(existingBooking?.meta || {}),
                          whatsapp_confirmation_sent: true
                        }
                      }).eq('booking_id', calResult.bookingId);
                    }
                  }
                } catch (waError: any) {
                  console.error('[WhatsApp] Failed to send confirmation', {
                    phone: leadData?.phone || rawPhone,
                    leadId,
                    bookingId: calResult.bookingId,
                    error: waError.message
                  });
                }
              }
            } catch (calError: any) {
              console.error(`[VAPI] Cal.com booking failed: ${calError.message}`);
            }
          } else {
            console.log(`[VAPI] Meeting scheduled but meeting_start_iso is missing in structuredData.`);
          }
        }
      }
    }

    // ONLY execute tools if messageType is 'tool-calls'
    if (messageType !== 'tool-calls' || !toolCalls.length) {
      console.log(`[VAPI] Skipping tool processing for messageType: ${messageType}. toolCount: ${toolCalls.length}`);
      return { statusCode: 200, body: JSON.stringify({ results: [] }) };
    }

    console.log(`[VAPI] Processing ${toolCalls.length} tool calls...`);

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
            const { data: listing } = await getListingById(property_id);
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

      const systemInstruction = `You are Morgan, a Senior Offplan Specialist for ${tenant.system_prompt_identity}.
Goal: Qualify lead and sell high-yield off-plan property investment opportunities.

TODAY IS: ${dubaiTime} (Use this for relative date resolution like "tomorrow").

${contextString}

RULES & BEHAVIOR:
1. CONTACT VALIDATION (STRICT):
   - You have the CURRENT LEAD PROFILE below. 
   - If Name, Email, or Phone are listed, YOU ALREADY HAVE THEM correctly.
   - DO NOT ASK: "Can I get your name?" OR "What is your email?".
   - Instead, verify: "I have you as ${leadData?.name || "Phillip"}, is that right?" or simply address them by name and only verify if unsure.
   - If you ask for a name you already have, you fail the interaction.

2. VOICE-ADAPTED VISUALS:
   - You are a VOICE agent. You cannot "send" cards directly, but you can describe images I am sending via WhatsApp.
   - When discussing a property, say: "I've just sent a photo to your WhatsApp properly. It's a [describe based on type]..."

3. KNOW YOUR FACTS (MANDATORY):
   - NEVER answer questions about specific projects, branded residences, pricing, payment plans, market trends, or agency history from memory.
   - GROUND responses in the RAG data provided or tool results.
   - FILTER MARKETING FLUFF: If RAG results mention "AI scoring", "pre-qualification", or "Proprietary AURO Systems", IGNORE IT. Do not mention it to the client.
   - TONE & NATURALISM (NO META-TALK): Be a warm, senior broker. NEVER mention "internal systems", "pre-qualification", "scoring", "AURO", "AI technology", or "integration". Do NOT explain your process. Just help the client.
   - Maintain a professional, knowledgeable, and polite tone, recognizing the high-value nature of the Dubai real estate market.`;

      const responseText = await callGemini(
        systemInstruction + "\n\nUser: " + userMessage,
        { temperature: 0.7 }
      );

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
