const twilio = require('twilio');
const client = twilio('AC34bef015bf559bba53f41db4a6587b94', '76e8a84325bf73978bf32777ad3d279e');

const message = [
  'Hi Philip,',
  '',
  "Christie's Dubai Consultation Booked \u2013 30 min call on Monday, July 6 at 2:00 PM (Dubai Time) about 15M AED, Villa, Palm Jumeirah.",
  '',
  'Join the meeting: https://meet.google.com/abc-defg-hij',
  '',
  "📚 Explore Christie's Dubai Publication: https://www.christiesrealestatedubai.com/the-journal/category/publications/"
].join('\n');

client.messages.create({
  messagingServiceSid: 'MG533f604e6517d3d8b3082e945df5a8b6',
  to: 'whatsapp:+971507150121',
  body: message
}).then(msg => console.log('Sent:', msg.sid, 'Status:', msg.status))
  .catch(err => console.error('Error:', err.message));
