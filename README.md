# AURO MVP

Dubai Real Estate AI Infrastructure using Gemini 3.0 Pro, VAPI, and Twilio.

## Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Copy `.env.example` to `.env` and fill in your keys:
    - `GEMINI_API_KEY`: Google AI Studio API Key
    - `TWILIO_ACCOUNT_SID`: Twilio Account SID
    - `TWILIO_AUTH_TOKEN`: Twilio Auth Token
    - `VAPI_WEBHOOK_SECRET`: (Optional) Secret for validating VAPI requests

## Development

Run the Netlify Dev server locally:

```bash
npm start
```

This will expose your functions at:
- `http://localhost:8888/.netlify/functions/vapi`
- `http://localhost:8888/.netlify/functions/whatsapp`

## Deployment

Deploy to Netlify:

```bash
netlify deploy --prod
```

## Webhook Configuration

- **VAPI:** Set the Tool Call URL to `https://<your-site>.netlify.app/.netlify/functions/vapi`
- **Twilio:** Set the WhatsApp Webhook URL to `https://<your-site>.netlify.app/.netlify/functions/whatsapp`
