const twilio = require('twilio');
const client = twilio('AC34bef015bf559bba53f41db4a6587b94', '76e8a84325bf73978bf32777ad3d279e');

async function check() {
  // Check messaging service phone numbers
  const nums = await client.messaging.services('MG533f604e6517d3d8b3082e945df5a8b6').phoneNumbers.list();
  console.log('Phone numbers on messaging service:', nums.map(n => ({ sid: n.sid, number: n.phoneNumber, country: n.isoCountry })));

  // Check messaging service WhatsApp senders (newer API)
  try {
    const waConfigs = await client.messaging.services('MG533f604e6517d3d8b3082e945df5a8b6').whatsappConfigs.list();
    console.log('WhatsApp configs:', waConfigs.map(c => ({ sid: c.sid, number: c.phoneNumber })));
  } catch(e) {
    console.log('WhatsApp configs error:', e.message);
  }

  // Also check by sending a message with explicit from prefix
  const msg = await client.messages.create({
    from: 'MG533f604e6517d3d8b3082e945df5a8b6',
    to: 'whatsapp:+971507150121',
    body: 'Test from messaging service'
  }).catch(e => ({ error: e.message }));
  console.log('MSG via service:', msg);
}
check().then(() => console.log('done'));
