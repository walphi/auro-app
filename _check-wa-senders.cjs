const twilio = require('twilio');
const client = twilio('AC34bef015bf559bba53f41db4a6587b94', '76e8a84325bf73978bf32777ad3d279e');

async function main() {
  // Check incoming phone numbers
  const incoming = await client.incomingPhoneNumbers.list({limit: 20});
  console.log('Incoming numbers:');
  incoming.forEach(n => console.log(`  ${n.phoneNumber} [${n.friendlyName}] SMS:${n.capabilities.sms} Voice:${n.capabilities.voice} MMS:${n.capabilities.mms}`));

  // Check WhatsApp senders via the API
  try {
    const profile = await client.whatsapp.whatsappBusinessAccounts.list();
    console.log('\nWhatsApp Business Accounts:', profile.length);
    for (const acc of profile) {
      console.log(`  Account: ${acc.sid} || Name: ${acc.friendlyName || 'N/A'}`);
      try {
        const senders = await acc.whatsappBusinessAccountSenders().list();
        console.log('  Senders:', senders.map(s => s.phoneNumber));
      } catch(e) { console.log('  Senders error:', e.message); }
    }
  } catch(e) { console.log('\nWhatsApp Business accounts error:', e.message); }

  // Check messaging service
  try {
    const svc = await client.messaging.services('MG533f604e6517d3d8b3082e945df5a8b6').fetch();
    console.log('\nMessaging Service:', svc.friendlyName, '| Fallback:', svc.fallbackToLongCode, '| Inbound:', svc.inboundRequestUrl);
  } catch(e) { console.log('\nMessaging Service error:', e.message); }
}
main().then(() => console.log('\ndone'));
