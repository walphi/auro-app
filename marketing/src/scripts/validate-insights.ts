import fs from "fs";
import path from "path";
import { allInsights } from "../data/insights.ts";

let errors = 0;

function error(msg: string) {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg: string) {
  console.warn(`  WARN:  ${msg}`);
}

// 1. Check for duplicate heroImage URLs
const heroImageCounts = new Map<string, number>();
for (const insight of allInsights) {
  heroImageCounts.set(insight.heroImage, (heroImageCounts.get(insight.heroImage) || 0) + 1);
}
for (const [url, count] of heroImageCounts) {
  if (count > 1) {
    const slugs = allInsights.filter((i) => i.heroImage === url).map((i) => i.slug);
    error(`heroImage used ${count}x: ${url.split("/").pop()?.split("?")[0]} (${slugs.join(", ")})`);
  }
}

// 2. Check for known fabricated quote citations
const fabricatedNames = ["Maria Petrova"];
for (const insight of allInsights) {
  for (const section of insight.sections) {
    if (section.type === "quote" && "cite" in section && section.cite) {
      for (const name of fabricatedNames) {
        if (section.cite.includes(name)) {
          error(`Fabricated quote citation found in "${insight.slug}": ${section.cite}`);
        }
      }
    }
  }
}

// 3. Warn if the used-image registry is stale (run `npm run used-images` to refresh)
const registryPath = path.resolve(import.meta.dirname, "../data/used-images.json");
if (fs.existsSync(registryPath)) {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const reserved = new Set<string>(registry.pexelsPhotoIds || []);
  const PEXELS_RE = /photos\/(\d+)\//;
  const used = new Set<string>();
  for (const insight of allInsights) {
    const match = insight.heroImage.match(PEXELS_RE);
    if (match) used.add(match[1]);
  }
  const stale = [...used].filter((id) => !reserved.has(id));
  const orphaned = [...reserved].filter((id) => !used.has(id));
  if (stale.length > 0 || orphaned.length > 0) {
    warn(`used-images.json is stale — run \`npm run used-images\` (missing: ${stale.join(", ") || "none"}, extra: ${orphaned.join(", ") || "none"})`);
  }
} else {
  warn("used-images.json not found — run `npm run used-images` to generate the registry");
}

// 4. List all quote citations for manual review
let quoteCount = 0;
for (const insight of allInsights) {
  for (const section of insight.sections) {
    if (section.type === "quote" && "cite" in section && section.cite) {
      quoteCount++;
    }
  }
}
if (quoteCount > 0) {
  warn(`${quoteCount} quotes with citations found — verify they are real people:`);
  for (const insight of allInsights) {
    for (const section of insight.sections) {
      if (section.type === "quote" && "cite" in section && section.cite) {
        console.warn(`       ${insight.slug}: ${section.cite}`);
      }
    }
  }
}

if (errors > 0) {
  console.error(`\nValidation failed: ${errors} error(s) found.`);
  process.exit(1);
} else {
  console.log(`\nValidation passed: ${allInsights.length} articles, ${quoteCount} citations listed.`);
}
