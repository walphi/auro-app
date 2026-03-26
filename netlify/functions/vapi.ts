import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsForVoice, SearchFilters, getListingById } from "./listings-helper";
import axios from "axios";
import { logLeadIntent } from "../../lib/enterprise/leadIntents";
import { getTenantByVapiId, getTenantById, getDefaultTenant, Tenant } from "../../lib/tenantConfig";
import { createCalComBooking } from "../../lib/calCom";
import { genAI, callGemini } from "../../lib/gemini";
import { resolveWhatsAppSender, TwilioWhatsAppClient } from "../../lib/twilioWhatsAppClient";
import { generateAuroSummary } from "../../lib/auroSummary";
import { addDealComment } from "../../lib/bitrixClient";
import { normalizePhone, resolvePrioritizedPhone } from "../../lib/phoneUtils";
import { orchestratePostMeetingNotification } from "../../lib/notificationOrchestrator";

const { BITRIX_PROVIDENT_WEBHOOK_URL } = process.env;


// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Helper to notify Bitrix Webhook for Tenant 1 (Provident)
 * Always called even if Cal.com fails, as per hard contract.
 */
async function triggerBitrixBookingWebhook(params: {
  event: string,
  bitrixId: string | null,
  leadId: string,
  tenant: any,
  phone: string,
  summary: string,
  transcript: string,
  booking: {
    id: string | null, // null if Cal.com failed
    start: string,
    meetingUrl: string | null,
    eventTypeId: number
  },
  structured: any
}) {
  const { event, bitrixId, leadId, tenant, phone, summary, transcript, booking, structured } = params;

  if (tenant.id !== 1) return;

  const bitrixPayload = {
    event,
    bitrixId,
    lead_id: leadId,
    tenant_id: tenant.id,
    phone,
    summary,
    transcript: transcript.substring(0, 2000),
    booking,
    structured,
    source: 'Auro Assistant'
  };

  // Robust Auth: Check multiple possible env var names
  const webhookKey = process.env.AURO_PROVIDENT_WEBHOOK_KEY ||
    process.env.BITRIX_WEBHOOK_KEY ||
    process.env.VAPI_WEBHOOK_SECRET || "";

  const webhookUrl = `https://auroapp.com/.netlify/functions/provident-bitrix-webhook?key=${webhookKey}`;

  console.log(`[BitrixWebhook] Posting booking to ${webhookUrl.split('?')[0]} for lead=${leadId} (key: ${webhookKey ? 'present, len=' + webhookKey.length : 'MISSING'})`);

  try {
    const response = await axios.post(
      webhookUrl,
      bitrixPayload,
      {
        headers: {
          'x-auro-key': webhookKey,
          'X-Webhook-Key': webhookKey,
          'Content-Type': 'application/json'
        }
      }
    );

    // Logs required by hard contract
    console.log(`[BitrixBookingWebhook] Processing BOOKING_CREATED for BitrixID ${bitrixId}, Lead ${leadId}`);
    console.log(`[BitrixWebhook] Success status=${response.status}`);
    return true;
  } catch (error: any) {
    console.error(`[BitrixWebhook] ERROR status=${error.response?.status} body=${JSON.stringify(error.response?.data || error.message)}`);
    return false;
  }
}

async function sendWhatsAppMessage(to: string, text: string, tenant: Tenant): Promise<boolean> {
  try {
    const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    const from = resolveWhatsAppSender(tenant);

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
 * Helper using TwilioWhatsAppClient for simple (free-form) confirmation.
 * NOTE: Free-form messages only work within the WhatsApp 24-hour session window.
 * If the lead has not messaged the business number in the last 24 hours, Twilio
 * will return HTTP 400. For out-of-session sends, a Content Template is required
 * (future enhancement).
 */
async function sendSimpleWhatsAppConfirmation(
  phone: string,
  firstName: string,
  meetingStartIso: string,
  meetingUrl: string,
  tenant: Tenant,
  projectName?: string
): Promise<boolean> {
  try {
    // ── Guard: validate phone looks like E.164 ──────────────────────────
    const phoneCleaned = (phone || '').replace(/^whatsapp:/i, '').trim();
    if (!phoneCleaned || !phoneCleaned.startsWith('+') || phoneCleaned.replace(/\D/g, '').length < 8) {
      console.error('[WhatsApp Helper] Invalid or missing phone – skipping send:', { raw: phone, cleaned: phoneCleaned });
      return false;
    }

    // Refactored: Resolve correct Twilio credentials by tenant
    const accountSid = tenant.id === 2 
      ? process.env.TWILIO_ACCOUNT_SID_ESHEL_T2 
      : (tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID);
    const authToken = tenant.id === 2 
      ? process.env.TWILIO_AUTH_TOKEN_ESHEL_T2 
      : (tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN);
    const messagingServiceSid = tenant.id === 2 
      ? undefined 
      : (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
    const explicitFrom = tenant.id === 2 
      ? process.env.ESHEL_T2_WHATSAPP_FROM 
      : undefined;

    const client = new TwilioWhatsAppClient(accountSid, authToken, messagingServiceSid);

    const dateObj = new Date(meetingStartIso);
    const dateStr = dateObj.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Dubai' });
    const timeStr = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' });

    // Refactored: Tenant-aware branding
    const brandName = tenant.id === 1 ? 'Provident Real Estate' : (tenant.name || 'Eshel Properties');
    const projectLabel = projectName || (tenant.id === 1 ? 'Apartment' : 'our latest properties');

    let message = `Your call about ${projectLabel} with ${brandName} has been scheduled.\n` +
      `Date & time: ${dateStr} at ${timeStr} (Dubai Time).\n` +
      `Join the meeting: ${meetingUrl || 'Link in calendar invite'}`;

    if (tenant.id === 1) {
      message += `\n\nIn the meantime, you can explore Provident's Top Branded Residences PDF here: https://drive.google.com/file/d/1gKCSGYCO6ObmPJ0VRfk4b4TvKZl9sLuB/view`;
    } else if (tenant.id === 2) {
      message += `\n\nIn the meantime, you can explore Eshel's 2026 UAE Off-Plan Playbook here: https://147683870.fs1.hubspotusercontent-eu1.net/hubfs/147683870/THE_2026_UAE_OFF-PLAN_PLAYBOOK_FINAL_%20(2).pdf`;
    }

    console.log('[WhatsApp Helper] Sending confirmation:', {
      to: phoneCleaned,
      branding: brandName,
      sender: explicitFrom ? `From: ${explicitFrom}` : `Messaging Service: ${messagingServiceSid}`,
      bodyLength: message.length,
      bodyPreview: message.substring(0, 120),
    });

    // Pass the explicit 'from' number for Eshel/Tenant 2
    const result = await client.sendTextMessage(phoneCleaned, message, explicitFrom);

    if (result.success) {
      console.log(`[WhatsApp Helper] Sent successfully. SID=${result.sid}`);
      return true;
    } else {
      console.error(`[WhatsApp Helper] ❌ Twilio client returned failure: ${result.error}`);
      return false;
    }
  } catch (error: any) {
    console.error('[WhatsApp Helper] ❌ Unexpected error:', error.message);
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
  const message = body.message || {};
  const analysis = message.analysis || body.call?.analysis || body.analysis || {};
  const artifact = message.artifact || body.call?.artifact || body.artifact || {};
  const structuredOutputs = artifact.structuredOutputs || {};

  // Vapi sends structuredOutputs as an object keyed by ID or as an array
  const outputsArray = Array.isArray(structuredOutputs) ? structuredOutputs : Object.values(structuredOutputs);

  const harvested: any = {};
  
  // Map of common variations to our internal keys
  const variations: Record<string, string> = {
    'meetingscheduled': 'meeting_scheduled',
    'meeting_scheduled': 'meeting_scheduled',
    'meetingstartiso': 'meeting_start_iso',
    'meeting_start_iso': 'meeting_start_iso',
    'firstname': 'first_name',
    'first_name': 'first_name',
    'lastname': 'last_name',
    'last_name': 'last_name',
    'email': 'email',
    'phone': 'phone',
    'budget': 'budget',
    'propertytype': 'property_type',
    'property_type': 'property_type',
    'preferredarea': 'preferred_area',
    'preferred_area': 'preferred_area',
    'raw_time_phrase': 'raw_time_phrase',
    'summary': 'summary'
  };

  // 1. Check artifact.structuredOutputs
  outputsArray.forEach((o: any) => {
    if (!o || !o.name) return;
    const name = o.name.toLowerCase().replace(/_/g, '');
    const internalKey = variations[name] || o.name;
    if (internalKey) {
      harvested[internalKey] = o.result;
    }
  });

  // 2. Check analysis.structuredData
  const structuredData = analysis.structuredData || {};
  Object.entries(structuredData).forEach(([key, value]) => {
    const internalKey = variations[key.toLowerCase().replace(/_/g, '')] || key;
    if (harvested[internalKey] === undefined) {
      harvested[internalKey] = value;
    }
  });

  // 3. Fallback: Check for specific "Morgan Booking" or similar result objects
  const consolidated = outputsArray.find((o: any) => 
    o.name?.toLowerCase().includes('booking') || o.name?.toLowerCase().includes('consultation')
  );
  if (consolidated?.result) {
    Object.entries(consolidated.result).forEach(([k, v]) => {
      const internalKey = variations[k.toLowerCase().replace(/_/g, '')] || k;
      if (harvested[internalKey] === undefined) {
        harvested[internalKey] = v;
      }
    });
  }

  if (harvested.meeting_start_iso || harvested.meeting_scheduled) {
    console.log(`[VAPI] Harvested structured data:`, Object.keys(harvested));
  }

  return harvested;
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

    // Use global normalizePhone
    if (phoneNumber) {
      phoneNumber = normalizePhone(phoneNumber);
      console.log("[VAPI] Normalized phone number:", phoneNumber);
    } else {
      console.log("[VAPI] No phone number found in payload");
    }

    let leadId: string | null = null;
    let leadData: any = null;

    if (phoneNumber && supabaseUrl && supabaseKey) {
      // FIX: Filter by phone AND tenant.id to avoid multiple-row errors
      // and order by created_at DESC to get the latest canonical lead.
      console.log(`[VAPI] Looking up lead for ${phoneNumber} in tenant ${tenant.id}...`);
      const { data: leads, error: findError } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (findError) {
        console.log("[VAPI] Lead lookup error:", findError.message);
      }

      if (leads && leads.length > 0) {
        leadData = leads[0];
        leadId = leadData.id;
        if (leads.length > 1) {
          console.warn(`[VAPI] Found ${leads.length} leads for ${phoneNumber} (tenant: ${tenant.id}). Using most recent (ID: ${leadId})`);
        } else {
          console.log("[VAPI] Resolved existing lead:", leadId);
        }
      } else {
        console.log("[VAPI] Lead not found. Creating new lead for:", phoneNumber);
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
          .maybeSingle(); // maybeSingle to avoid errors if a race condition lead was created

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

    if (!leadData) {
      leadData = {
        phone: phoneNumber,
        name: nameFromVars || "Client",
        email: emailFromVars || ""
      };
    } else {
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
    // 1. assistant.started (Server URL hook)
    if (messageType === 'assistant.started' || messageType === 'assistant-started') {
      console.log(`[VAPI] Call started hook - returning overrides for lead ${leadId}`);
      const whatsappSummary = body.message?.call?.assistantOverrides?.variableValues?.whatsapp_summary || 
                              body.call?.assistantOverrides?.variableValues?.whatsapp_summary || 
                              "No prior WhatsApp conversation.";

      return {
        statusCode: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify({
          assistantOverrides: {
            variableValues: {
              lead_id: leadId || "",
              // Split name into first_name/last_name for consistency with structured data parsing
              // Handle single-word names gracefully (last_name empty if no space)
              first_name: ((leadData?.name || nameFromVars || "Client").split(' ')[0]) || "Client",
              last_name: (() => {
                const fullName = leadData?.name || nameFromVars || "Client";
                const parts = fullName.split(' ');
                return parts.length > 1 ? parts.slice(1).join(' ') : "";
              })(),
              name: leadData?.name || nameFromVars || "Client",  // Keep for backward compatibility
              email: leadData?.email || emailFromVars || "",
              budget: leadData?.budget || "",
              location: leadData?.location || "",
              property_type: leadData?.property_type || "",
              whatsapp_summary: whatsappSummary
            }
          }
        })
      };
    }

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
        const recordingUrl = body.message?.call?.recordingUrl || body.call?.recordingUrl;

        console.log(`[VAPI] Call ended/Report received. outcome=${outcome}, bookingMade=${bookingMade}, recording=${recordingUrl ? 'YES' : 'NO'}`);

        await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'System',
          content: `--- Call Summary ---\n${summary || 'Call ended.'}`,
          meta: JSON.stringify({ outcome, bookingMade, recordingUrl })
        });

        // --- CRM SYNC: Vapi Call Ended Sidecar (Tenant 2 / Eshel) ---
        if (tenant.id === 2 && tenant.crm_type === 'hubspot') {
          const syncSummary = summary || "Conversation completed.";
          const duration = body.message?.call?.duration || body.call?.duration || 0;
          const structuredData = getStructuredData(body);
          
          // Build minimal lead data if Supabase lookup failed - ensures HubSpot note is always created
          const minimalLeadData = leadData || {
            phone: phoneNumber || "",
            name: nameFromVars || "Unknown",
            email: emailFromVars || ""
          };
          
          // Only proceed if we have at least a phone number to identify the lead
          if (!minimalLeadData.phone) {
            console.warn('[VAPI] Cannot create HubSpot note: no phone number available');
          } else {
            await triggerHubSpotSidecar(tenant, 'vapi_call_ended', minimalLeadData, syncSummary, undefined, {
              qualificationData: {
                budget: structuredData.budget || minimalLeadData?.budget || "",
                propertyType: structuredData.property_type || minimalLeadData?.property_type || "",
                area: structuredData.preferred_area || minimalLeadData?.location || ""
              },
              vapi: { callId: body.message?.call?.id || body.call?.id, summary: syncSummary, duration }
            });
          }
        }

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

        // --- NEW: AURO SUMMARY POSTBACK TO BITRIX ---
        // We post a summary if this is a Provident Deal (Tenant 1) and we have a Bitrix Deal ID.
        if (tenant.id === 1 && leadData?.custom_field_1?.includes('DealID:')) {
          console.log(`[AuroSummary] Initiating summary postback for lead ${leadId}`);

          try {
            // 1. Fetch WhatsApp message history
            const { data: messages } = await supabase
              .from('messages')
              .select('sender, content, type')
              .eq('lead_id', leadId)
              .in('type', ['Message', 'Image', 'Voice'])
              .order('created_at', { ascending: true })
              .limit(20);

            const whatsappHighlights = messages?.map(m => `${m.sender}: ${m.content}`).join('\n') || 'No messages recorded.';

            // 2. Extract Bitrix Deal ID
            const dealIdMatch = leadData.custom_field_1.match(/DealID:\s*(\d+)/);
            const bitrixDealId = dealIdMatch ? dealIdMatch[1] : null;

            if (bitrixDealId) {
              const structuredData = getStructuredData(body);

              // 3. Generate Summary
              const auroSummary = generateAuroSummary({
                leadName: leadData.name || structuredData.first_name || 'Recipient',
                leadPhone: leadData.phone || phoneNumber,
                leadEmail: leadData.email || structuredData.email,
                budget: leadData.budget || structuredData.budget,
                location: leadData.location || structuredData.preferred_area,
                propertyType: leadData.property_type || structuredData.property_type,
                whatsappTranscript: whatsappHighlights,
                voiceSummary: summary,
                voiceRecordingUrl: recordingUrl,
                meetingDateTime: structuredData.meeting_start_iso ? new Date(structuredData.meeting_start_iso).toLocaleString('en-US', { timeZone: 'Asia/Dubai' }) : undefined,
                meetingUrl: leadData.meeting_url || leadData.meta?.meetingUrl // From local state if available
              });

              console.log(`[AuroSummary] Posting summary to Bitrix Deal ${bitrixDealId}`);
              await addDealComment(bitrixDealId, auroSummary, BITRIX_PROVIDENT_WEBHOOK_URL);
            }
          } catch (summaryError: any) {
            console.error('[AuroSummary] Failed to generate/post summary:', summaryError.message);
          }
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

            // Preparation for Bitrix (Extracted early so we can call it even if Cal.com fails)
            const dbName = leadData?.name && !leadData.name.includes('WhatsApp Lead') ? leadData.name : '';
            const firstName = structuredData.first_name || dbName.split(' ')[0] || 'Client';
            const lastName = structuredData.last_name || dbName.split(' ').slice(1).join(' ') || '';
            const fullName = `${firstName} ${lastName}`.trim();

            const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
            const sanitizeEmail = (e: string) => {
              if (!e) return "";
              return e.toLowerCase().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s+/g, '');
            };

            let cleanEmail = sanitizeEmail(structuredData.email);
            // LOCK: Prefer existing valid email from DB over STT
            const finalEmail = leadData?.email && isValidEmail(leadData.email) ? leadData.email : cleanEmail;

            const normalizedAttendeePhone = resolvePrioritizedPhone(
              phoneNumber,
              leadData?.phone,
              structuredData.phone
            );
            // LOCK: Prefer existing phone from DB over STT (unless new caller ID)
            const finalPhone = leadData?.phone ? leadData.phone : (phoneNumber || normalizedAttendeePhone);

            let calResult: any = null;
            let calErrorMsg: string | null = null;

            try {
              calResult = await createCalComBooking({
                eventTypeId,
                start: meetingStartIso,
                name: fullName,
                email: finalEmail,
                phoneNumber: finalPhone,
                metadata: {
                  budget: String(structuredData.budget || leadData?.budget || ""),
                  property_type: String(structuredData.property_type || leadData?.property_type || ""),
                  preferred_area: String(structuredData.preferred_area || leadData?.location || ""),
                  lead_id: String(leadId),
                  tenant_id: String(tenant.id),
                  call_id: String(body.message?.call?.id || body.call?.id || "")
                }
              });

              // Store in DB, Update Lead, etc.
              const endDate = new Date(new Date(meetingStartIso).getTime() + 30 * 60000);
              await supabase.from('bookings').upsert({
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
              }, { onConflict: 'lead_id,tenant_id,meeting_start_iso' });

              await supabase.from('leads').update({
                booking_status: 'confirmed',
                viewing_datetime: meetingStartIso
              }).eq('id', leadId);

              const dubaiTimeStr = new Date(meetingStartIso).toLocaleString('en-US', { timeZone: 'Asia/Dubai', dateStyle: 'full', timeStyle: 'short' });
              const budget = structuredData.budget || leadData?.budget || "Not specified";
              const propType = structuredData.property_type || leadData?.property_type || "Not specified";
              const area = structuredData.preferred_area || leadData?.location || "Not specified";
              const notePrefix = tenant.id === 2 ? "Eshel Consultation Booked" : "✅ Cal.com Consultation Booked";

              await supabase.from('messages').insert({
                lead_id: leadId,
                type: 'System_Note',
                sender: 'System',
                content: `${notePrefix} – 30 min call on ${dubaiTimeStr} about ${budget}, ${propType}, ${area}. Cal.com link: ${calResult.meetingUrl || 'Check Cal.com'}`
              });

              console.log(`[VAPI] Successfully created Cal.com booking: ${calResult.bookingId}`);
            } catch (calErr: any) {
              calErrorMsg = calErr.message;
              console.error(`[VAPI] Cal.com booking failed:`, calErrorMsg);
            }

            // --- BITRIX NOTIFICATION (Tenant 1 only) - HARD CONTRACT: CALL ALWAYS IF SCHEDULED ---
            if (tenant.id === 1) {
              const dealIdMatch = leadData?.custom_field_1?.match(/(?:DealID|LeadID|BitrixID):\s*(\d+)/i);
              let bitrixId = dealIdMatch ? dealIdMatch[1] : null;
              if (!bitrixId) {
                bitrixId = body.call?.metadata?.bitrix_id || body.call?.extra?.bitrix_id ||
                  body.message?.call?.metadata?.bitrix_id || body.message?.call?.extra?.bitrix_id;
              }

              await triggerBitrixBookingWebhook({
                event: 'BOOKING_CREATED',
                bitrixId,
                leadId,
                tenant,
                phone: normalizedAttendeePhone,
                summary: summary || "Cal.com booking attempt via Vapi voice call.",
                transcript: (body.message?.transcript || body.call?.transcript || "No transcript available."),
                booking: {
                  id: calResult?.bookingId || null,
                  start: meetingStartIso,
                  meetingUrl: calResult?.meetingUrl || calResult?.raw?.meetingUrl || null,
                  eventTypeId: eventTypeId
                },
                structured: {
                  budget: structuredData.budget || leadData?.budget || "",
                  property_type: structuredData.property_type || leadData?.property_type || "",
                  preferred_area: structuredData.preferred_area || leadData?.location || "",
                  meetingscheduled: true,
                  meetingstartiso: meetingStartIso
                }
              });
            }

            // --- WHATSAPP CONFIRMATION (Tenant 1 or 2, only if Cal.com succeeded) ---
            if (calResult && (tenant.id === 1 || tenant.id === 2)) {
              console.log(`[MeetingConfirmation] Sending WhatsApp confirmation for tenant ${tenant.id}, lead=${leadId} to=${normalizedAttendeePhone}`);
              
              // Use unified orchestrator with deduplication
              const notificationResult = await orchestratePostMeetingNotification({
                tenant,
                leadId,
                phone: normalizedAttendeePhone,
                email: finalEmail,
                name: fullName,
                meetingStartIso,
                meetingUrl: calResult.meetingUrl || calResult.raw?.meetingUrl || '',
                projectName: structuredData.preferred_area || structuredData.property_type || 
                            (tenant.id === 2 ? 'our latest properties' : 'Apartment'),
                bookingId: calResult.bookingId,
                notificationType: 'booking_confirmed',
                source: 'vapi'
              });
              
              if (notificationResult.whatsappSent) {
                console.log(`[MeetingConfirmation] WhatsApp confirmation sent via orchestrator`);
                // Record is already updated by orchestrator, but update call_id if needed
                await supabase.from('bookings').update({
                  meta: {
                    call_id: body.message?.call?.id || body.call?.id
                  }
                }).eq('booking_id', calResult.bookingId);
              } else if (notificationResult.deduplicated) {
                console.log(`[MeetingConfirmation] Notification deduplicated (already sent)`);
              } else {
                console.error(`[MeetingConfirmation] WhatsApp confirmation failed`);
              }
            }

            // --- CRM SYNC: Booking Created Sidecar (Tenant 2 / Eshel) ---
            if (tenant.id === 2 && tenant.crm_type === 'hubspot' && calResult) {
              const finalProject = structuredData.project_name || structuredData.preferred_area || leadData?.location || "our latest properties";
              const budget = structuredData.budget || leadData?.budget || "";
              const propertyType = structuredData.property_type || leadData?.property_type || "";
              const area = structuredData.preferred_area || leadData?.location || "";

              await triggerHubSpotSidecar(tenant, 'booking_created', leadData, "Meeting Scheduled", undefined, {
                qualificationData: { budget, propertyType, area },
                booking: {
                  meetingUrl: calResult.meetingUrl,
                  bookingId: calResult.bookingId,
                  startTime: meetingStartIso,
                  projectName: finalProject
                }
              });
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

          // 4. Create Cal.com Booking immediately
          let calResult: any = null;
          let calErrorMsg: string | null = null;

          let eventTypeIdAttr = process.env.CALCOM_EVENT_TYPE_ID_PROVIDENT || "4644939";
          if (tenant.id !== 1) {
            const tenantEnvKey = `CALCOM_EVENT_TYPE_ID_${tenant.short_name?.toUpperCase()}`;
            eventTypeIdAttr = process.env[tenantEnvKey] || eventTypeIdAttr;
          }
          const eventTypeId = parseInt(eventTypeIdAttr);

          const emailForBooking = leadData?.email;
          if (emailForBooking) {
            try {

              const prioritizedPhone = resolvePrioritizedPhone(
                phoneNumber,
                leadData?.phone,
                args.phone // Assistant phone from tool args if present
              );

              calResult = await createCalComBooking({
                eventTypeId: parseInt(eventTypeIdAttr),
                start: resolved_datetime,
                name: leadData.name || 'Client',
                email: emailForBooking,
                phoneNumber: prioritizedPhone,
                metadata: {
                  lead_id: String(leadId),
                  tenant_id: String(tenant.id),
                  property_id: property_id,
                  source: 'vapi_tool_call'
                }
              });

              console.log(`[VAPI] Tool-call booking successful: ${calResult.bookingId}`);

              // Store booking record
              await supabase.from('bookings').upsert({
                lead_id: leadId,
                tenant_id: tenant.id,
                booking_id: calResult.bookingId,
                booking_provider: 'calcom',
                meeting_start_iso: resolved_datetime,
                status: 'confirmed',
                meta: {
                  uid: calResult.uid,
                  meeting_url: calResult.meetingUrl,
                  call_id: body.message?.call?.id || body.call?.id,
                  listing_title: listingTitle
                }
              }, { onConflict: 'lead_id,tenant_id,meeting_start_iso' });

              // 5. Trigger Meeting Confirmation via orchestrator
              if (tenant.id === 1 || tenant.id === 2) {
                console.log(`[MeetingConfirmation] Sending WhatsApp confirmation via orchestrator for tenant ${tenant.id}, lead=${leadId} to=${prioritizedPhone}`);
                
                const notificationResult = await orchestratePostMeetingNotification({
                  tenant,
                  leadId,
                  phone: prioritizedPhone,
                  name: leadData?.name,
                  meetingStartIso: resolved_datetime,
                  meetingUrl: calResult?.meetingUrl || '',
                  projectName: listingTitle,
                  bookingId: calResult?.bookingId,
                  notificationType: 'viewing_booked',
                  source: 'tool_call'
                });
                
                if (notificationResult.whatsappSent) {
                  console.log(`[MeetingConfirmation] Tool confirmation sent via orchestrator`);
                } else if (notificationResult.deduplicated) {
                  console.log(`[MeetingConfirmation] Tool confirmation deduplicated`);
                } else {
                  console.error(`[MeetingConfirmation] Tool confirmation failed`);
                }
              }

            } catch (calErr: any) {
              calErrorMsg = calErr.message;
              console.error("[VAPI] Tool-call Cal.com failed:", calErrorMsg);
            }
          }

          // --- BITRIX NOTIFICATION (Tenant 1) - HARD CONTRACT ---
          if (tenant.id === 1) {
            const dealIdMatch = leadData?.custom_field_1?.match(/(?:DealID|LeadID|BitrixID):\s*(\d+)/i);
            let bitrixId = dealIdMatch ? dealIdMatch[1] : null;
            if (!bitrixId) {
              bitrixId = body.call?.metadata?.bitrix_id || body.call?.extra?.bitrix_id ||
                body.message?.call?.metadata?.bitrix_id || body.message?.call?.extra?.bitrix_id;
            }

            const prioritizedPhone = resolvePrioritizedPhone(
              phoneNumber,
              leadData?.phone,
              args.phone
            );

            await triggerBitrixBookingWebhook({
              event: 'BOOKING_CREATED',
              bitrixId,
              leadId,
              tenant,
              phone: prioritizedPhone,
              summary: `Viewing booked for ${listingTitle} via Vapi tool call.`,
              transcript: body.message?.transcript || body.call?.transcript || "Tool call booking.",
              booking: {
                id: calResult?.bookingId || null,
                start: resolved_datetime,
                meetingUrl: calResult?.meetingUrl || calResult?.raw?.meetingUrl || null,
                eventTypeId: eventTypeId
              },
              structured: {
                budget: leadData?.budget || "",
                property_type: leadData?.property_type || "",
                preferred_area: listingTitle,
                meetingscheduled: true,
                meetingstartiso: resolved_datetime
              }
            });
          }

          // 6. Send other generic notifications
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
          } catch (notifyErr: any) {
            console.error('[VAPI] Notification trigger failed:', notifyErr.message);
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


2. KNOW YOUR FACTS (MANDATORY):
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

/**
 * Triggers the Eshel CRM sidecar to log info to HubSpot.
 * Only runs if tenant.id === 2 (Eshel) and crm_type is hubspot.
 */
async function triggerHubSpotSidecar(tenant: any, eventType: string, lead: any, noteText: string, hsTimestamp?: string, extra?: any) {
  if (tenant.id !== 2 || tenant.crm_type !== 'hubspot' || !lead) return;

  const sidecarUrl = `https://${process.env.MEDIA_HOST || 'auro-app.netlify.app'}/.netlify/functions/eshel-hubspot-crm-sync`;
  const sidecarKey = process.env.AURO_SIDECAR_KEY;

  try {
    await axios.post(sidecarUrl, {
      eventType,
      tenantId: tenant.id,
      phone: lead.phone,
      name: lead.name,
      email: lead.email,
      noteText,
      hsTimestamp: hsTimestamp || new Date().toISOString(),
      ...extra
    }, {
      headers: { 'x-auro-sidecar-key': sidecarKey }
    });
    console.log(`[Sidecar] Triggered ${eventType} for ${lead.phone}`);
  } catch (err: any) {
    console.error(`[Sidecar] Failed to trigger ${eventType}:`, err.message);
  }
}
