// netlify/functions/chat-bridge.ts
// Auro App — Google Chat orchestrator bridge (Netlify Scheduled Function).
//
// Wakes every 2 minutes (cron @netlify.toml: [functions.chat-bridge] schedule = "@every 2m").
// Reads Chat API messages via OAuth, dedups, classifies intent, and posts a reply
// via the cached incoming webhook. State is persisted in Netlify Blobs.
//
// Two reply paths:
//   - "general" — OpenAI gpt-4o-mini persona response (1-4 sentences, plain text, signed "— auro")
//                  or a static canned response if OPENAI_API_KEY is not configured.
//   - "dev"     — static message telling the user opencode/dev path is local-only in this build.
//                  (Deploy Option C — Hetzner VPS — for full cloud dev path.)

import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import OpenAI from "openai";

interface OAuthConfig {
  refresh_token: string;
  client_id: string;
  client_secret: string;
  scope: string;
  space_id: string;
  bot_user_id: string;
}

interface BridgeState {
  last_seen_create_time: string | null;
  processed_user_names: string[];
  sent_message_names: string[];
  last_run_at: string | null;
  consecutive_errors: number;
}

const STORE_NAME = "auro-chat-bridge";
const STATE_KEY  = "state";
const REQUEST_TIMEOUT_MS = 20_000;

// Same classifier vocabulary as chat_bridge_v4.py — kept in sync.
const KEYWORD_DEV = [
  "@dev", "fix the", "edit the", "deploy", "git push", "git commit",
  ".tsx", ".ts ", ".css", ".svg", "src/", "refactor",
  "component", "build is broken", "diff for", "implement",
  "function in", "patch the", "rename in", "add a class",
  "what does line", "explain this file", "staged files",
  "build the site", "fix the build", "wire up",
];

const CONVERSATIONAL = [
  "how are you", "how is it", "how's it", "how's your", "you doing", "what's up",
  "are you there", "you there", "you ok", "alive", "ping ",
  "hello", " hi ", " hi.", " hi,", " hey,", " hey.", " hey ",
  "thanks,", "thanks.", "thanks ", "thank you", "thank you!", "thank you.",
  "good morning", "good evening", "are you up", "ready?",
];

function looksConversational(text: string): boolean {
  const lc = " " + (text || "").toLowerCase() + " ";
  return CONVERSATIONAL.some((kw) => lc.includes(kw));
}

function isDev(text: string): boolean {
  const lc = " " + (text || "").toLowerCase() + " ";
  return KEYWORD_DEV.some((kw) => lc.includes(kw));
}

function classify(text: string): "dev" | "general" {
  if (isDev(text) && !looksConversational(text)) return "dev";
  return "general";
}

function looksLikeBotReply(text: string): boolean {
  return /— auro|⚙️ dev staged|⚙️ dev 🤝|⚠️ bridge failed|Query: You are replying/i.test(text || "");
}

// ---------- HTTP with timeout ----------

async function jsonFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

// ---------- State ----------

async function loadState(store: ReturnType<typeof getStore>): Promise<BridgeState> {
  const fallback: BridgeState = {
    last_seen_create_time: null,
    processed_user_names: [],
    sent_message_names: [],
    last_run_at: null,
    consecutive_errors: 0,
  };
  try {
    const { state } = (await store.get(STATE_KEY, { type: "json" })) as { state: BridgeState };
    return { ...fallback, ...state };
  } catch {
    return fallback;
  }
}

async function saveState(store: ReturnType<typeof getStore>, state: BridgeState): Promise<void> {
  await store.setJSON(STATE_KEY, { state });
}

// ---------- OAuth + Chat API ----------

async function mintToken(cfg: OAuthConfig): Promise<string> {
  const res = await jsonFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: cfg.refresh_token,
      client_id:     cfg.client_id,
      client_secret: cfg.client_secret,
      scope:         cfg.scope,
    }),
  });
  if (!res.ok) throw new Error("token mint: " + res.status + " " + (await res.text()));
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

async function listMessages(cfg: OAuthConfig, bearer: string): Promise<any[]> {
  const url =
    "https://chat.googleapis.com/v1/spaces/" + encodeURIComponent(cfg.space_id) +
    "/messages?pageSize=25&orderBy=createTime%20asc";
  const res = await jsonFetch(url, { headers: { Authorization: "Bearer " + bearer } });
  if (!res.ok) throw new Error("list messages: " + res.status);
  const body = (await res.json()) as { messages?: any[] };
  return body.messages || [];
}

async function postWebhook(url: string, text: string): Promise<string> {
  const res = await jsonFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("webhook post: " + res.status + " " + (await res.text()).slice(0, 200));
  const body = (await res.json()) as { name?: string };
  return body.name || "?";
}

// ---------- OpenAI persona ----------

const PERSONA_SYSTEM =
  "You are replying in Google Chat space 'Auro App Marketing' as the auro bot identity. " +
  "Brand: Auro App (auroapp.com) — AI-first lead nurturing for Dubai real estate. " +
  "Voice: minimal, dark editorial, factual, specific. " +
  "AURO point of view: turn every lead into a booked meeting. " +
  "Rules: 1-4 sentences. Plain text only — markdown bold/italic/bullet/etc. is forbidden. " +
  "Do NOT use emoji or hashtags. Sign with '— auro'. Dubai context where relevant. " +
  "Be useful, specific, factual. No vendor names.";

async function openaiReply(openai: OpenAI, userMsg: string, senderName: string): Promise<string> {
  const user =
    `Sender: ${senderName}. They wrote: ${JSON.stringify(userMsg)}\n\n` +
    "Compose a single reply using the system rules. Output ONLY the reply text.";
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 240,
    temperature: 0.7,
    messages: [
      { role: "system", content: PERSONA_SYSTEM },
      { role: "user",   content: user },
    ],
  });
  return (res.choices?.[0]?.message?.content || "").trim() || FALLBACK_REPLY;
}

const FALLBACK_REPLY =
  "All green here — pipeline warm, calendar open. Ship steady. What's on the list today? — auro";

const DEV_PATH_REPLY =
  "⚙️ dev mode is local-only in this Netlify build (opencode reasoning + file edits still require Hermes in your working session). " +
  "For full cloud bridge including dev path, see Option C — Hetzner VPS €4.5/mo. — auro";

// ---------- Handler ----------

export default async (req: Request, _ctx: Context) => {
  const log = (s: string, obj: Record<string, unknown> = {}) => {
    console.log("[chat-bridge] " + s + " " + JSON.stringify(obj));
  };
  try {
    const oauthJson = process.env.GCHAT_OAUTH_JSON;
    const webhook   = process.env.GCHAT_WEBHOOK_URL;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!oauthJson || !webhook) {
      log("missing env", { oauthJson: !!oauthJson, webhook: !!webhook });
      return new Response(JSON.stringify({ error: "missing env: GCHAT_OAUTH_JSON or GCHAT_WEBHOOK_URL" }), {
        status: 500,
      });
    }

    let cfg: OAuthConfig;
    try {
      cfg = JSON.parse(oauthJson);
    } catch {
      return new Response("GCHAT_OAUTH_JSON not valid JSON", { status: 500 });
    }
    if (!cfg.refresh_token || !cfg.client_id || !cfg.space_id) {
      return new Response("GCHAT_OAUTH_JSON missing required fields", { status: 500 });
    }

    const store   = getStore(STORE_NAME);
    const state   = await loadState(store);
    const bearer  = await mintToken(cfg);
    const rawMsgs = await listMessages(cfg, bearer);
    log("fetched", { count: rawMsgs.length });

    const procUsers = new Set(state.processed_user_names);
    const candidates: any[] = [];
    for (const m of rawMsgs) {
      if (!m?.name || procUsers.has(m.name)) continue;
      if (m.sender?.name === cfg.bot_user_id) continue;
      if (looksLikeBotReply(m.text || "")) continue;
      candidates.push(m);
    }

    if (candidates.length === 0) {
      state.last_run_at = new Date().toISOString();
      state.consecutive_errors = 0;
      await saveState(store, state);
      log("idle", { fetched: rawMsgs.length, replied: 0 });
      return new Response(JSON.stringify({ fetched: rawMsgs.length, replied: 0 }));
    }

    const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
    let replied = 0, failed = 0;
    const proc = [...state.processed_user_names];
    const sent = [...state.sent_message_names];

    // Process up to 5 messages per tick — boundary safety.
    for (const m of candidates.slice(0, 5)) {
      try {
        const text       = m.text || "";
        const senderName = m.sender?.displayName || m.sender?.name || "user";
        const intent     = classify(text);
        let reply: string;
        if (intent === "dev") {
          reply = DEV_PATH_REPLY;
        } else if (openai) {
          reply = await openaiReply(openai, text, senderName);
        } else {
          reply = FALLBACK_REPLY;
        }
        const replyName = await postWebhook(webhook, reply);
        proc.push(m.name);
        sent.push(replyName);
        state.last_seen_create_time = m.createTime;
        state.consecutive_errors = 0;
        replied += 1;
        log("replied", { intent, user_msg: m.name, reply: replyName, len: reply.length });
      } catch (ex) {
        failed += 1;
        state.consecutive_errors = (state.consecutive_errors ?? 0) + 1;
        log("failed", { user_msg: m.name, error: String(ex) });
        break; // don't loop on persistent errors
      }
    }

    state.processed_user_names = proc.slice(-200);
    state.sent_message_names   = sent.slice(-200);
    state.last_run_at          = new Date().toISOString();
    await saveState(store, state);
    log("tick end", { fetched: rawMsgs.length, replied, failed });
    return new Response(JSON.stringify({ fetched: rawMsgs.length, replied, failed }));
  } catch (ex) {
    console.error("[chat-bridge] top-level:", ex);
    return new Response(JSON.stringify({ error: String(ex) }), { status: 500 });
  }
};

// Trigger config (also set in netlify.toml under [functions.chat-bridge] schedule for safety).
export const config = {
  schedule: "@every 2m",
};
