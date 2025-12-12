/**
 * Sync Listings Function
 * Fetches latest property listings from parse.bot and stores in Supabase
 * 
 * Can be triggered:
 * - Manually via HTTP GET/POST request
 * - Via scheduled job (Netlify scheduled functions or external cron)
 */

import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { syncListings, getLatestListings } from "./listings-helper";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers for manual trigger
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Allow GET for easy testing, POST for programmatic calls
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  console.log("[Sync] Starting property listings sync...");

  try {
    // Parse request body for options
    let limit = 10;
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        limit = body.limit || 10;
      } catch (e) {
        // Ignore parse errors, use defaults
      }
    }

    // Also check query params
    if (event.queryStringParameters?.limit) {
      limit = parseInt(event.queryStringParameters.limit) || 10;
    }

    console.log(`[Sync] Syncing ${limit} listings...`);

    // Sync listings from parse.bot to Supabase
    const result = await syncListings(limit);

    console.log(`[Sync] Complete - Fetched: ${result.fetched}, Success: ${result.success}, Errors: ${result.errors}`);

    // Get the latest listings to return
    const latestListings = await getLatestListings(limit);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Synced ${result.success} of ${result.fetched} listings`,
        stats: {
          fetched: result.fetched,
          saved: result.success,
          errors: result.errors
        },
        listings: latestListings.map(l => ({
          property_id: l.property_id,
          title: l.property_title,
          type: l.property_type,
          bedrooms: l.bedrooms,
          price_aed: l.price_aed,
          community: l.community,
          url: l.property_url
        }))
      })
    };

  } catch (error: any) {
    console.error("[Sync] Error:", error.message);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to sync listings"
      })
    };
  }
};

export { handler };
