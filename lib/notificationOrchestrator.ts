/**
 * lib/notificationOrchestrator.ts — Unified Post-Meeting Notification Orchestrator
 * 
 * Single source of truth for all post-meeting notifications (WhatsApp, Email).
 * Implements idempotency to prevent duplicate notifications.
 * 
 * Deduplication strategy:
 * - Uses booking_id as primary dedup key when available
 * - Falls back to lead_id + meeting_start_iso composite key
 * - Stores notification status in Supabase bookings.meta.whatsapp_confirmation_sent
 */

import { createClient } from '@supabase/supabase-js';
import { TwilioWhatsAppClient, resolveWhatsAppSender } from './twilioWhatsAppClient';
import type { Tenant } from './tenantConfig';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface NotificationParams {
  tenant: Tenant;
  leadId: string;
  phone: string;
  email?: string;
  name?: string;
  meetingStartIso: string;
  meetingUrl?: string;
  projectName?: string;
  bookingId?: string;
  budget?: string;
  propertyType?: string;
  area?: string;
  notificationType: 'booking_confirmed' | 'viewing_booked';
  source: 'vapi' | 'vapi_webhook' | 'booking_notify' | 'tool_call';
}

export interface NotificationResult {
  whatsappSent: boolean;
  emailSent: boolean;
  deduplicated: boolean;
  error?: string;
}

/**
 * Main entry point: orchestrates post-meeting notifications with deduplication
 */
export async function orchestratePostMeetingNotification(
  params: NotificationParams
): Promise<NotificationResult> {
  const { tenant, leadId, bookingId, meetingStartIso, source } = params;

  // --- IDEMPOTENCY CHECK ---
  const alreadyNotified = await checkExistingNotification(leadId, bookingId, meetingStartIso);
  if (alreadyNotified) {
    console.log(`[NotificationOrchestrator] Deduplicated: Notification already sent for booking=${bookingId}, lead=${leadId}`);
    return { whatsappSent: false, emailSent: false, deduplicated: true };
  }

  console.log(`[NotificationOrchestrator] Processing ${params.notificationType} notification from ${source} for lead=${leadId}`);

  // --- SEND NOTIFICATIONS ---
  const [whatsappSent, emailSent] = await Promise.all([
    sendWhatsAppConfirmation(params),
    // Email notification disabled for now - no existing email flow in the codebase
    Promise.resolve(false)
  ]);

  // --- RECORD NOTIFICATION ---
  if (whatsappSent || emailSent) {
    await recordNotificationSent(leadId, bookingId, meetingStartIso, {
      whatsapp: whatsappSent,
      email: emailSent,
      source,
      timestamp: new Date().toISOString()
    });
  }

  return {
    whatsappSent,
    emailSent,
    deduplicated: false
  };
}

/**
 * Check if notification was already sent for this booking/meeting
 */
async function checkExistingNotification(
  leadId: string,
  bookingId: string | undefined,
  meetingStartIso: string
): Promise<boolean> {
  try {
    // Primary check: by booking_id
    if (bookingId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('meta')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (booking?.meta?.whatsapp_confirmation_sent || booking?.meta?.notification_sent) {
        return true;
      }
    }

    // Fallback check: by lead_id + meeting_start_iso
    const { data: existing } = await supabase
      .from('bookings')
      .select('meta')
      .eq('lead_id', leadId)
      .eq('meeting_start_iso', meetingStartIso)
      .maybeSingle();

    return !!(existing?.meta?.whatsapp_confirmation_sent || existing?.meta?.notification_sent);
  } catch (err: any) {
    console.warn('[NotificationOrchestrator] Idempotency check failed:', err.message);
    // Fail open - proceed with notification if check fails
    return false;
  }
}

/**
 * Record that notification was sent
 */
async function recordNotificationSent(
  leadId: string,
  bookingId: string | undefined,
  meetingStartIso: string,
  status: { whatsapp: boolean; email: boolean; source: string; timestamp: string }
): Promise<void> {
  try {
    const updatePayload = {
      meta: {
        whatsapp_confirmation_sent: status.whatsapp,
        email_confirmation_sent: status.email,
        notification_sent: status.whatsapp || status.email,
        notification_source: status.source,
        notification_timestamp: status.timestamp
      }
    };

    if (bookingId) {
      await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('booking_id', bookingId);
    } else {
      // Fallback: update by lead + meeting time
      await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('lead_id', leadId)
        .eq('meeting_start_iso', meetingStartIso);
    }
  } catch (err: any) {
    console.warn('[NotificationOrchestrator] Failed to record notification status:', err.message);
    // Non-critical - don't fail the notification
  }
}

/**
 * Send WhatsApp confirmation message
 * Consolidates logic from sendSimpleWhatsAppConfirmation and sendWhatsAppNotification
 */
async function sendWhatsAppConfirmation(params: NotificationParams): Promise<boolean> {
  const { tenant, phone, name, meetingStartIso, meetingUrl, projectName } = params;

  try {
    // ── Guard: validate phone looks like E.164 ──────────────────────────
    const phoneCleaned = (phone || '').replace(/^whatsapp:/i, '').trim();
    if (!phoneCleaned || !phoneCleaned.startsWith('+') || phoneCleaned.replace(/\D/g, '').length < 8) {
      console.error('[NotificationOrchestrator] Invalid or missing phone – skipping send:', { raw: phone, cleaned: phoneCleaned });
      return false;
    }

    // Resolve Twilio credentials from tenant config or defaults
    const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      console.error('[NotificationOrchestrator] Missing Twilio credentials');
      return false;
    }

    const fromNumber = resolveWhatsAppSender(tenant);
    const client = new TwilioWhatsAppClient(accountSid, authToken);

    const dateObj = new Date(meetingStartIso);
    const dateStr = dateObj.toLocaleString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      timeZone: 'Asia/Dubai' 
    });
    const timeStr = dateObj.toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Dubai' 
    });

    const { budget, propertyType, area } = params;

    // Tenant-aware branding
    const tenantLabel = tenant.id === 1 ? 'Provident Real Estate' : tenant.id === 3 ? "Christie's Dubai" : (tenant.name || 'Auro');
    const projectLabel = projectName || 'your property inquiry';
    const firstName = name?.split(' ')[0] || 'there';
    const budgetLabel = budget || 'budget to be confirmed';
    const propTypeLabel = propertyType || 'property type to be confirmed';
    const areaLabel = area || projectLabel;
    const resourceLink = getWAResourceLink(tenant.short_name);

    let message = `Hi ${firstName},\n\n` +
      `${tenantLabel} Consultation Booked – 30 min call on ${dateStr} at ${timeStr} (Dubai Time) about ${budgetLabel}, ${propTypeLabel}, ${areaLabel}.\n\n` +
      `Join the meeting: ${meetingUrl || 'Link in calendar invite'}` +
      (resourceLink ? `\n\n${resourceLink}` : '');

    console.log('[NotificationOrchestrator] Sending WhatsApp confirmation:', {
      to: phoneCleaned,
      branding: tenantLabel,
      sender: fromNumber,
      bodyLength: message.length,
      bodyPreview: message.substring(0, 120),
    });

    const result = await client.sendTextMessage(phoneCleaned, message, fromNumber);

    if (result.success) {
      console.log(`[NotificationOrchestrator] WhatsApp sent successfully. SID=${result.sid}`);
      return true;
    } else {
      console.error(`[NotificationOrchestrator] Twilio client returned failure: ${result.error}`);
      return false;
    }
  } catch (error: any) {
    console.error('[NotificationOrchestrator] WhatsApp send failed:', error.message);
    return false;
  }
}

function getWAResourceLink(shortName?: string): string | null {
  switch (shortName) {
    case 'christies_dubai':
      return `📚 Explore Christie's Dubai Publication: https://www.christiesrealestatedubai.com/the-journal/category/publications/`;
    default:
      return null;
  }
}
