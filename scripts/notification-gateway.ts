import http from "http";
import https from "https";
import { URLSearchParams } from "url";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(import.meta.dirname, "../.env.local") });

const PORT = parseInt(process.env.NOTIFICATION_PORT || "5500", 10);

function sendWhatsApp(phone: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    return Promise.resolve({ success: false, error: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN" });
  }
  if (!fromNumber) {
    return Promise.resolve({ success: false, error: "Missing TWILIO_PHONE_NUMBER" });
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const params = new URLSearchParams();
  const formattedTo = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
  const formattedFrom = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
  params.append("To", formattedTo);
  params.append("From", formattedFrom);
  params.append("Body", body);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.twilio.com",
        path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode === 201) {
              resolve({ success: true, sid: parsed.sid });
            } else {
              resolve({ success: false, error: parsed.message || JSON.stringify(parsed) });
            }
          } catch {
            resolve({ success: false, error: data });
          }
        });
      }
    );
    req.on("error", (err) => resolve({ success: false, error: err.message }));
    req.write(params.toString());
    req.end();
  });
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/send") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. POST /send with { phone, message }" }));
    return;
  }

  try {
    const body = await parseBody(req);
    const { phone, message } = body;

    if (!phone || !message) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing required fields: phone, message" }));
      return;
    }

    console.log(`[NotificationGateway] Sending to ${phone}: "${message.substring(0, 80)}..."`);
    const result = await sendWhatsApp(phone, message);

    if (result.success) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, sid: result.sid }));
    } else {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: result.error }));
    }
  } catch (err: any) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[NotificationGateway] Running on http://localhost:${PORT}`);
  console.log(`[NotificationGateway] Send POST /send with { "phone": "+971XXXXXXXXX", "message": "..." }`);
});
