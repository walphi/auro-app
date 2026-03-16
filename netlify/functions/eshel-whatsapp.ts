import { Handler } from "@netlify/functions";
import { handler as coreHandler } from "./whatsapp";

/**
 * Eshel Properties WhatsApp Entrypoint
 * 
 * This is a thin wrapper around the core WhatsApp handler that forces
 * the tenant resolution to 'eshel' via a custom header.
 */
export const handler: Handler = async (event, context) => {
  // Inject the tenant override header
  event.headers = {
    ...event.headers,
    "x-aurora-tenant": "eshel",
  };

  // Delegate all logic to the core handler
  const response = await coreHandler(event, context);
  if (!response) {
    return {
      statusCode: 500,
      body: "Internal Server Error"
    };
  }
  return response;
};
