// Shared helpers for Social Calendar Netlify Functions.
// Mirrors auro_calendar.py constants and metadata block helpers in TypeScript
// so dashboard-side and cron-side stay in sync.

import { Handler, HandlerEvent } from "@netlify/functions";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Env / client factory ──────────────────────────────────────────────
export function getEnv(name: string): string | undefined {
    const v = process.env[name];
    return v && v.trim() ? v : undefined;
}

export function getSupabase(): SupabaseClient {
    const url = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL") || "";
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY")
             || getEnv("VITE_SUPABASE_ANON_KEY")     || "";
    if (!url || !key) {
        throw new Error("Supabase env vars missing ("
                         + "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    }
    return createClient(url, key);
}

export function getZernioToken(): string {
    const t = getEnv("ZERNIO_TOKEN") || "";
    if (!t) throw new Error("ZERNIO_TOKEN env var missing");
    return t;
}

export function getGeminiKey(): string {
    const k = getEnv("GEMINI_API_KEY") || "";
    if (!k) throw new Error("GEMINI_API_KEY env var missing");
    return k;
}

// ── Domain enums (must stay aligned with auro_calendar.py constants) ──
export const VALID_SLOTS = [
    "article_morning", "quote_afternoon",
    "reel_evening",    "story_late",
] as const;
export type Slot = (typeof VALID_SLOTS)[number];

export const VALID_STATUSES = [
    "pending", "prompt_ready", "creative_ready",
    "posted",  "failed",
] as const;
export type RowStatus = (typeof VALID_STATUSES)[number];

export const VALID_CTAS = ["question", "save", "follow", "link"] as const;
export type Cta = (typeof VALID_CTAS)[number];

export const SLOT_DEFAULT_TIMES: Record<Slot, number> = {
    article_morning:    9,   // 09:00 GST
    quote_afternoon:   13,   // 13:00 GST
    reel_evening:      18,   // 18:00 GST
    story_late:        21,   // 21:00 GST
};

// ── Metadata block sentinels (mirror META_OPEN / META_CLOSE in Python) ──
export const META_OPEN  = "[AURO-META-JSON]";
export const META_CLOSE = "[/AURO-META-JSON]";

export interface PomelliMeta {
    hook?:            string;
    headline_variants?: string[];
    keyStat?:         string | number | null;
    cta?:             string;
    cta_text?:        string;
    hashtags_block?:  string[];
    article_slug?:    string;
    format?:          "feed" | "reel" | "story";
    category?:        string;
    intent?:          string;
    needs_human?:     boolean;
    post_id?:         string;
    title?:           string;
    [k: string]:      unknown;
}

/** Extract (meta, humanText) from a stored Pomelli prompt. */
export function stripPromelliMeta(prompt: string | null | undefined): {
    meta: PomelliMeta; human: string;
} {
    if (!prompt || typeof prompt !== "string" || !prompt.includes(META_OPEN)) {
        return { meta: {}, human: prompt || "" };
    }
    const head = prompt.split(META_OPEN)[0];
    const rest = prompt.split(META_OPEN)[1] ?? "";
    if (!rest.includes(META_CLOSE)) return { meta: {}, human: rest };
    const bodyStr = rest.split(META_CLOSE)[0]!.trim();
    const human   = (rest.split(META_CLOSE)[1] ?? "").trim();
    let meta: PomelliMeta = {};
    if (bodyStr) {
        try { meta = JSON.parse(bodyStr) as PomelliMeta; }
        catch { meta = {}; }
    }
    return { meta, human: head + human };
}

/** Build full prompt = metadata block header + human-readable body. */
export function attachPromelliMeta(human: string, meta: PomelliMeta): string {
    const body = JSON.stringify(meta, null, 2);
    return [
        META_OPEN,
        body,
        META_CLOSE,
        "",
        (human || "").trim(),
    ].join("\n");
}

/** Stable legacy_id = date-slot. Matches Python legacy_id synthesis. */
export function legacyId(date: string, slot: string): string {
    return `${date}-${slot}`;
}

/** Validate a YYYY-MM-DD date string. */
export function isISODate(s: string | undefined): boolean {
    return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ── HTTP response helpers ─────────────────────────────────────────────
export const HEADERS_CORS: Record<string, string> = {
    "Content-Type":                            "application/json",
    "Access-Control-Allow-Origin":              "*",
    "Access-Control-Allow-Headers":             "Content-Type",
    "Access-Control-Allow-Methods":             "GET, POST, OPTIONS",
};

export interface HandlerResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}

export function respond(status: number, body: unknown): HandlerResponse {
    return { statusCode: status, headers: HEADERS_CORS,
             body: JSON.stringify(body) };
}

// ── Supabase patch helpers (mirror auro_calendar.py mark_*) ───────────
export async function setPromptReady(
    supabase: SupabaseClient,
    date: string, slot: string,
    pomelliPrompt: string
): Promise<number> {
    const res = await supabase.from("social_calendar")
        .update({ status: "prompt_ready", pomelli_prompt: pomelliPrompt })
        .eq("date", date).eq("slot", slot);
    return Array.isArray(res.data) ? res.data.length : 0;
}

export async function setCreativeReady(
    supabase: SupabaseClient,
    date: string, slot: string,
    creativeUrl: string
): Promise<number> {
    const res = await supabase.from("social_calendar")
        .update({ status: "creative_ready", creative_url: creativeUrl })
        .eq("date", date).eq("slot", slot);
    return Array.isArray(res.data) ? res.data.length : 0;
}

export async function markPosted(
    supabase: SupabaseClient,
    date: string, slot: string,
    postId: string
): Promise<number> {
    // Get existing prompt, preserve human body, replace only post_id metadata.
    const sel = await supabase.from("social_calendar")
        .select("pomelli_prompt").eq("date", date).eq("slot", slot)
        .maybeSingle();
    const cur = String(sel.data?.pomelli_prompt ?? "");
    const { meta, human } = stripPromelliMeta(cur);
    meta.post_id = postId;
    const body = human || meta.title
              || "(prompt generated by Netlify function)";
    const newPrompt = attachPromelliMeta(body, meta);
    const res = await supabase.from("social_calendar")
        .update({ status: "posted", pomelli_prompt: newPrompt })
        .eq("date", date).eq("slot", slot);
    return Array.isArray(res.data) ? res.data.length : 0;
}

export async function markFailed(
    supabase: SupabaseClient,
    date: string, slot: string,
    reason: string
): Promise<number> {
    const sel = await supabase.from("social_calendar")
        .select("pomelli_prompt").eq("date", date).eq("slot", slot)
        .maybeSingle();
    const cur = String(sel.data?.pomelli_prompt ?? "");
    const { meta, human } = stripPromelliMeta(cur);
    meta.failure_reason = reason;
    meta.failed_at = new Date().toISOString();
    const body = human || meta.title || "";
    const newPrompt = attachPromelliMeta(body, meta);
    const res = await supabase.from("social_calendar")
        .update({ status: "failed", pomelli_prompt: newPrompt })
        .eq("date", date).eq("slot", slot);
    return Array.isArray(res.data) ? res.data.length : 0;
}

export async function setStatus(
    supabase: SupabaseClient,
    date: string, slot: string,
    status: RowStatus,
    extras: Record<string, unknown> = {}
): Promise<number> {
    const res = await supabase.from("social_calendar")
        .update({ status, ...extras })
        .eq("date", date).eq("slot", slot);
    return Array.isArray(res.data) ? res.data.length : 0;
}
