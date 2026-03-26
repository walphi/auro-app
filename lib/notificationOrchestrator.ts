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
import { TwilioWhatsAppClient } from './twilioWhatsAppClient';
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

    if (!accountSid || !authToken) {
      console.error('[NotificationOrchestrator] Missing Twilio credentials');
      return false;
    }

    const client = new TwilioWhatsAppClient(accountSid, authToken, messagingServiceSid);

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

    // Tenant-aware branding
    const brandName = tenant.id === 1 ? 'Provident Real Estate' : (tenant.name || 'Eshel Properties');
    const projectLabel = projectName || (tenant.id === 1 ? 'Apartment' : 'our latest properties');
    const firstName = name?.split(' ')[0] || 'there';

    let message = `Hi ${firstName}, your call about ${projectLabel} with ${brandName} has been scheduled.\n` +
      `Date & time: ${dateStr} at ${timeStr} (Dubai Time).\n` +
      `Join the meeting: ${meetingUrl || 'Link in calendar invite'}`;

    if (tenant.id === 1) {
      message += `\n\nIn the meantime, you can explore Provident's Top Branded Residences PDF here: https://drive.google.com/file/d/1gKCSGYCO6ObmPJ0VRfk4b4TvKZl9sLuB/view`;
    } else if (tenant.id === 2) {
      message += `\n\nIn the meantime, you can explore Eshel's 2026 UAE Off-Plan Playbook here: https://147683870.fs1.hubspotusercontent-eu1.net/hubfs/147683870/THE_2026_UAE_OFF-PLAN_PLAYBOOK_FINAL_%20(2).pdf`;
    }

    console.log('[NotificationOrchestrator] Sending WhatsApp confirmation:', {
      to: phoneCleaned,
      branding: brandName,
      sender: explicitFrom ? `From: ${explicitFrom}` : `Messaging Service: ${messagingServiceSid}`,
      bodyLength: message.length,
      bodyPreview: message.substring(0, 120),
    });

    const result = await client.sendTextMessage(phoneCleaned, message, explicitFrom);

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
