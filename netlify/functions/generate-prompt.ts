// generate-prompt.ts: call Gemini 2.5 Flash to write a Pomelli brief for a
// given (date, slot). Persists the result back to the row's `pomelli_prompt`
// column and the view's metadata block (article_slug, format, hook, cta...).
//
// POST /api/v1/generate-prompt
// body: { date: "YYYY-MM-DD", slot: "article_morning"|..., hook?: string,
//         article_slug?: string, format?: string, cta?: string, tone?: string,
// regenerate?: boolean }
// response: { ok: true, pomelli_prompt: <text>, metadata: <meta> }
import { Handler } from "@netlify/functions";
import {
    VALID_SLOTS, Slot, isISODate, getSupabase,
    stripPromelliMeta, attachPromelliMeta, PomelliMeta,
    respond, HEADERS_CORS, getGeminiKey,
} from "./social-calendar-helper";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEN_URL = (key: string, m: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;

interface GenRequest {
    date?:        string;
    slot?:        string;
    hook?:        string;
    article_slug?: string;
    format?:      string;
    cta?:         string;
    tone?:        string;
    regenerate?:  boolean;
}

const SLOT_INSTRUCTIONS: Record<Slot, string> = {
    article_morning:
        "Write a 4:5 IMAGE carousel caption (5-7 slides) for a morning lead-nurturing "
        + "IG post based on today's blog article. Direct value, professional tone, Dubai "
        + "luxury real estate context. Model: problem -> framework -> Auro solution.",
    quote_afternoon:
        "Write a single-image QUOTE post caption with the day's substantive market "
        + "insight stated as a quotable line plus 2-3 supporting sentences. Punchy, "
        + "shareable, ends with a hook question.",
    reel_evening:
        "Write a 9:16 REEL (15-30s) caption. Script must include a 3-second hook, "
        + "a 12-second body, and a CTA at the end. Tone: cinematic Dubai luxe, "
        + "agent POV, voiceover-ready.",
    story_late:
        "Write a poll/slider STYLE STORY caption. 1-4 sentences that drive a "
        + "binary engagement (swipe up vs. comment vs. react). Designed for "
        + "agent reposting, so include a 'screenshot this → DM us' line.",
};

async function callGemini(
    key: string, prompt: string, temperature: number
): Promise<{ success: true; text: string }
         | { success: false; error: string }> {
    try {
        const r = await fetch(GEN_URL(key, GEMINI_MODEL), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature,
                    topK:               40,
                    topP:               0.95,
                    maxOutputTokens:    1024,
                },
            }),
        });
        if (!r.ok) return { success: false, error:
            `Gemini returned HTTP ${r.status}: ` + (await r.text()).slice(0, 400) };
        const js = await r.json();
        const txt = js?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!txt) return { success: false,
                            error: "Gemini returned no content" };
        return { success: true, text: String(txt) };
    } catch (e: any) {
        return { success: false, error: e?.message || "Gemini call failed" };
    }
}

export const handler: Handler = async (event) => {
    // CORS pre-flight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: HEADERS_CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
        return respond(405, { error: "Method not allowed" });
    }
    let body: GenRequest = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return respond(400, { error: "invalid JSON body" }); }
    if (!isISODate(body.date))    return respond(400, { error: "date must be YYYY-MM-DD" });
    if (!body.slot || !VALID_SLOTS.includes(body.slot as Slot)) {
        return respond(400, { error: "slot must be one of " + VALID_SLOTS.join(",") });
    }
    const slot = body.slot as Slot;
    let key: string;
    try { key = getGeminiKey(); } catch (e: any) {
        return respond(503, { error: e?.message });
    }
    // Pull existing meta (so we preserve post_id, post_id, etc.).
    const supabase = getSupabase();
    const sel = await supabase.from("social_calendar")
        .select("pomelli_prompt").eq("date", body.date!).eq("slot", slot)
        .maybeSingle();
    const existing = stripPromelliMeta(
        String(sel.data?.pomelli_prompt ?? ""));
    const meta: PomelliMeta = existing.meta;
    // ... and inherit/overwrite from the request:
    if (body.article_slug) meta.article_slug = body.article_slug;
    meta.format = (body.format as PomelliMeta["format"]) || meta.format;
    meta.cta    = body.cta || meta.cta;
    if (body.hook) meta.hook = body.hook;
    meta.tone   = body.tone || meta.tone;
    // Avoid re-running if there is already a generated brief and !regenerate:
    if (existing.human && !body.regenerate) {
        return respond(200, {
            ok: true,
            reused: true,
            pomelli_prompt: sel.data?.pomelli_prompt,
                                                        metadata: meta,
        });
    }
    const article = meta.article_slug ?? body.article_slug ?? "recent";
    const tone    = meta.tone ?? body.tone ?? "insider, Dubai-luxury-focused";
    const format  = meta.format ?? body.format ?? "feed";
    const cta     = meta.cta ?? body.cta ?? "question";
    const systemInstruction =
        `You are the Auro App content engine for Dubai luxury real estate. `
        + `You write Instagram captions. Tone: ${tone}. Slot: ${slot} (${SLOT_INSTRUCTIONS[slot]}). `
        + `Format: ${format}. CTA flavor: ${cta}. English. No emojis in the hook. `
        + `Hashtags: 4-6 at the end (#AuroApp always). Use the article slug "${article}" as the foundation.`;
    const userPrompt =
        `Generate a Pomelli brief + caption for the ${slot} slot of ${body.date}. `
        + `Article slug: ${article}.\n\nOutput ONLY the human-readable caption text, `
        + `no metadata preamble, no header. The header will be set programmatically. `;
    const resp = await callGemini(key, systemInstruction + "\n\n" + userPrompt, 0.7);
    if (!resp.success) {
        // narrow the union:
        const r2 = resp as Extract<typeof resp, { success: false }>;
        return respond(502, { error: r2.error });
    }
    const newPrompt = attachPromelliMeta(resp.text, meta);
    const upd = await supabase.from("social_calendar")
        .update({ status: "prompt_ready", pomelli_prompt: newPrompt,
                  content_ref: article })
        .eq("date", body.date!).eq("slot", slot);
    return respond(200, {
        ok: true,
        reused: false,
        pomelli_prompt: newPrompt,
        metadata:       meta,
        rows_updated:   Array.isArray(upd?.data) ? upd.data.length : 0,
    });
};
