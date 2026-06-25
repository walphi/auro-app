import fs from "fs";
import path from "path";
import { SITE_URL } from "../lib/site.ts";
import { allInsights } from "../data/insights.ts";

const DIST = path.resolve(import.meta.dirname, "../../dist");
const PUBLIC = path.resolve(import.meta.dirname, "../../public");

const staticPages = [
  "",
  "insights",
  "faq",
  "product-updates",
  "about",
  "solutions",
];

function sitemapXml(): string {
  const urls: string[] = [];

  for (const page of staticPages) {
    const url = page === "" ? SITE_URL : `${SITE_URL}/${page}/`;
    urls.push(`  <url>
    <loc>${url}</loc>
    <priority>${page === "" ? "1.0" : "0.8"}</priority>
  </url>`);
  }

  for (const insight of allInsights) {
    urls.push(`  <url>
    <loc>${SITE_URL}/insights/${insight.slug}/</loc>
    <lastmod>${insight.updatedAt}</lastmod>
    <priority>0.8</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

function imagesSitemapXml(): string {
  const urls: string[] = [];

  for (const insight of allInsights) {
    if (insight.heroImage) {
      urls.push(`  <url>
    <loc>${SITE_URL}/insights/${insight.slug}/</loc>
    <image:image>
      <image:loc>${insight.heroImage}</image:loc>
      <image:caption>${insight.heroAlt}</image:caption>
    </image:image>
  </url>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-images.xml</loc>
  </sitemap>
</sitemapindex>`;

function writeToDirs(filename: string, content: string) {
  fs.writeFileSync(path.join(DIST, filename), content, "utf-8");
  fs.writeFileSync(path.join(PUBLIC, filename), content, "utf-8");
  console.log(`Wrote ${filename}`);
}

fs.mkdirSync(DIST, { recursive: true });
writeToDirs("sitemap.xml", sitemapXml());
writeToDirs("sitemap-images.xml", imagesSitemapXml());
writeToDirs("sitemap-index.xml", sitemapIndex);

console.log("Sitemaps generated.");
