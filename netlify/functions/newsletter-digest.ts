import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = "https://auroapp.com";

interface Article {
    title: string;
    link: string;
    pubDate: string;
    description: string;
}

// Rule (locked-in): ship the latest N articles from the insights array, ranked
// strictly by publication date (descending). Tunable via the constant below.
const DIGEST_ARTICLE_COUNT = 8;

function parseRssItems(xml: string): Article[] {
    const items: Article[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
        const link = itemXml.match(/<link>(.*?)<\/link>/);
        const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        const desc = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);
        if (title && link && pubDate) {
            items.push({
                title: title[1].trim(),
                link: link[1].trim(),
                pubDate: pubDate[1].trim(),
                description: desc ? desc[1].replace(/<[^>]+>/g, "").slice(0, 200) : "",
            });
        }
    }
    // Sort by publication date descending so the digest always carries the
    // most-recent insights regardless of array order in insights.ts.
    items.sort((a, b) => {
        const da = new Date(a.pubDate).getTime();
        const db = new Date(b.pubDate).getTime();
        return db - da;
    });
    return items.slice(0, DIGEST_ARTICLE_COUNT);
}

function buildDigestEmail(articles: Article[]): string {
    const shortDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const articleList = articles.map((a, i) => {
        const num = String(i + 1).padStart(2, "0");
        const dateStr = new Date(a.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return `
            <div style="padding:20px 0;border-bottom:1px solid #222;">
                <p style="margin:0 0 6px 0;color:#D4FF00;font-size:11px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;font-weight:bold;">// ${num}</p>
                <a href="${a.link}" style="color:#D4FF00;font-size:16px;font-weight:bold;text-decoration:none;line-height:1.4;display:inline-block;margin:2px 0 6px 0;">${a.title}</a>
                <p style="color:#aaaaaa;font-size:13px;margin:6px 0 0;line-height:1.55;">${a.description}</p>
                <p style="color:#666;font-size:11px;margin:8px 0 0;letter-spacing:.15em;font-family:'Courier New',monospace;text-transform:uppercase;">// ${dateStr}</p>
            </div>
        `;
    }).join("");

    return `
        <div style="background:#0a0a0a;padding:40px 20px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
            <div style="max-width:560px;margin:0 auto;background:#0b0b0bed;border:1px solid #333;padding:40px;">

                <!-- brandmark -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                    <tr>
                        <td style="vertical-align:middle;padding:0 10px 0 0;">
                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#D4FF00;line-height:10px;">&nbsp;</span>
                        </td>
                        <td style="vertical-align:middle;color:#D4FF00;font-size:14px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;font-weight:bold;">AURO</td>
                    </tr>
                </table>
                <div style="height:1px;background:#333;margin:0 0 28px 0;"></div>

                <p style="margin:0 0 4px 0;color:#D4FF00;font-size:11px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;">// DIGEST &middot; ${shortDate}</p>

                <h1 style="margin:0 0 16px 0;color:#f4f4f4;font-size:30px;font-style:italic;font-family:Georgia,'Times New Roman',serif;font-weight:normal;line-height:1.3;">What we've published.</h1>

                <p style="margin:0 0 24px 0;color:#aaaaaa;font-size:15px;line-height:1.6;">Hi __NAME__, here's the latest from AURO Insights &mdash; Dubai real estate signals and the AI lead nurturing patterns we're seeing work.<span aria-hidden="true">&nbsp;📰</span></p>

                <p style="margin:0 0 8px 0;color:#D4FF00;font-size:11px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;">// LATEST ${DIGEST_ARTICLE_COUNT}</p>

                ${articleList}

                <p style="margin:32px 0 4px 0;color:#D4FF00;font-size:11px;letter-spacing:.2em;font-family:'Courier New',monospace;text-transform:uppercase;">// NEXT</p>
                <p style="margin:0;color:#aaaaaa;font-size:14px;line-height:1.6;">Next digest lands Monday at 9am GST.<span aria-hidden="true">&nbsp;📅</span></p>

                <div style="height:1px;background:#333;margin:32px 0 16px 0;"></div>
                <p style="margin:0;color:#666;font-size:11px;line-height:1.5;">
                    You're receiving this because you subscribed to AURO Insights.
                    <a href="${SITE_URL}/unsubscribe" style="color:#666;text-decoration:underline;">Unsubscribe</a>
                </p>

            </div>
        </div>
    `;
}

export const handler = schedule("0 9 * * 1,4", async () => {
    console.log("[Digest] Starting bi-weekly newsletter digest...");

    if (!RESEND_API_KEY) {
        console.log("[Digest] Skipped - RESEND_API_KEY not configured");
        return { statusCode: 200 };
    }

    // Fetch latest articles from RSS feed
    let articles: Article[] = [];
    try {
        const rssResp = await axios.get(`${SITE_URL}/rss.xml`, { timeout: 10000 });
        articles = parseRssItems(rssResp.data);
        console.log(`[Digest] Fetched ${articles.length} articles from RSS`);
    } catch (err: any) {
        console.error("[Digest] Failed to fetch RSS:", err.message);
    }

    if (articles.length === 0) {
        console.log("[Digest] No articles found, skipping");
        return { statusCode: 200 };
    }

    // Query active subscribers
    const { data: subscribers, error } = await supabase
        .from("subscribers")
        .select("email, name")
        .eq("status", "active");

    if (error || !subscribers?.length) {
        console.log("[Digest] No active subscribers or error:", error?.message);
        return { statusCode: 200 };
    }

    console.log(`[Digest] Sending to ${subscribers.length} subscribers`);

    // Send via Resend batch
    const emailHtml = buildDigestEmail(articles);
    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
        try {
            const personalizedHtml = emailHtml.replace("__NAME__", sub.name);

            await axios.post("https://api.resend.com/emails", {
                from: "AURO Insights <insights@insights.auroapp.com>",
                to: [sub.email],
                subject: `AURO Insights Digest — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
                html: personalizedHtml,
            }, {
                headers: {
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 10000,
            });
            sent++;
        } catch (err: any) {
            console.error(`[Digest] Failed to send to ${sub.email}:`, err.response?.data || err.message);
            failed++;
        }
    }

    console.log(`[Digest] Complete: ${sent} sent, ${failed} failed`);
    return { statusCode: 200 };
});
