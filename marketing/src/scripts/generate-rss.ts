import fs from "fs";
import path from "path";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "../lib/site.ts";
import { allInsights } from "../data/insights.ts";

const DIST = path.resolve(import.meta.dirname, "../../dist");
const PUBLIC = path.resolve(import.meta.dirname, "../../public");

function rssXml(): string {
  const items = allInsights.map((insight) => {
    const sectionTexts = insight.sections
      .filter((s): s is { type: "p"; text: string } => s.type === "p")
      .map((s) => `<p>${s.text}</p>`)
      .join("\n");

    return `  <item>
    <title><![CDATA[${insight.title}]]></title>
    <link>${SITE_URL}/insights/${insight.slug}/</link>
    <description><![CDATA[${insight.excerpt}]]></description>
    <pubDate>${new Date(insight.publishedAt).toUTCString()}</pubDate>
    <guid>${SITE_URL}/insights/${insight.slug}/</guid>
    <content:encoded><![CDATA[${sectionTexts}]]></content:encoded>
  </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${SITE_NAME} Insights</title>
    <link>${SITE_URL}/insights/</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

const content = rssXml();
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, "rss.xml"), content, "utf-8");
fs.writeFileSync(path.join(PUBLIC, "rss.xml"), content, "utf-8");
console.log("RSS feed generated.");
