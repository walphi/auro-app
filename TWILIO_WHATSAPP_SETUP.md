# Twilio WhatsApp Configuration Verification

## Current Issue
Error 63007: "Twilio could not find a Channel with the specified From address"

## What This Means
The number `+971565203832` is not registered as a WhatsApp sender in your Twilio account.

## Required Actions in Twilio Console

### Option 1: Register +971565203832 as WhatsApp Sender (Recommended)
1. Go to Twilio Console → Messaging → Senders → WhatsApp senders
2. Click "Add new WhatsApp sender"
3. Follow the process to register `+971565203832` as a WhatsApp Business sender
4. Complete Meta Business verification if required

### Option 2: Use Existing Working Sender
If you already have a working WhatsApp sender (the one used by `/whatsapp` handler):
1. Find the working sender number in Twilio Console
2. Update the database to use that number:
   ```sql
   UPDATE tenants 
   SET twilio_whatsapp_number = 'YOUR_WORKING_NUMBER'
   WHERE id = 1;
   ```

### Option 3: Use Messaging Service (If Configured)
If you're using a Twilio Messaging Service:
1. The `From` parameter should be the **Messaging Service SID** (starts with `MG...`)
2. Not the phone number directly
3. Update code to use Messaging Service SID when available

## Current Configuration

### Database (Tenant 1 - Provident)
- `twilio_phone_number`: `whatsapp:+14155238886` (Sandbox - blocked by our guard)
- `twilio_whatsapp_number`: `+971565203832` (Not registered in Twilio)

### Environment Variables (.env.local)
- `TWILIO_PHONE_NUMBER`: `+971565203832`
- `TWILIO_ACCOUNT_SID`: [Set]
- `TWILIO_AUTH_TOKEN`: [Set]

### Resolution Logic
The `resolveWhatsAppSender` function:
1. Checks `tenant.twilio_whatsapp_number` → Returns `+971565203832`
2. Falls back to `tenant.twilio_phone_number` → Blocked (sandbox)
3. Falls back to `TWILIO_PHONE_NUMBER` env var
4. Blocks sandbox number `+14155238886`

## How WhatsApp Handler Works (Currently Functional)
The `/whatsapp` handler returns **TwiML** which Twilio processes server-side.
Twilio automatically uses the correct sender based on the incoming message.

## How Vapi Handler Works (Currently Failing)
The `/vapi` handler makes a **direct API call** to Twilio's Messages endpoint.
This requires the `From` number to be explicitly registered as a WhatsApp sender.

## Next Steps

1. **Verify in Twilio Console**:
   - Go to: https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders
   - Check if `+971565203832` is listed and active
   - If not, you need to register it

2. **Alternative: Use the Sandbox for Testing**:
   - Update database: `UPDATE tenants SET twilio_whatsapp_number = '+14155238886' WHERE id = 1;`
   - Remove sandbox guard temporarily for testing
   - This is NOT for production

3. **Check Messaging Service**:
   - Go to: https://console.twilio.com/us1/develop/sms/services
   - If you have a service, check if `+971565203832` is added to it
   - If using a service, we need to use the Service SID as `From`

## Logs to Check After Next Test
Look for these in Netlify logs:
```
[MEETING_DEBUG] WhatsApp sender resolution: tenant.twilio_whatsapp_number="...", resolved="..."
[MEETING_DEBUG] Twilio send params: To="...", From="...", AccountSid="..."
[VAPI WhatsApp Error]: { code: 63007, moreInfo: "..." }
```
