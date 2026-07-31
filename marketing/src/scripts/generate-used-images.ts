import fs from "fs";
import path from "path";
import { allInsights } from "../data/insights.ts";

const PEXELS_RE = /photos\/(\d+)\//;

const ids = new Set<string>();
for (const insight of allInsights) {
  const match = insight.heroImage.match(PEXELS_RE);
  if (match) ids.add(match[1]);
}

const registry = {
  _note: "Reserved pexels photo IDs currently used by heroImage across all insights. The Auro Content Engine MUST consult this list and never reuse an ID when choosing a hero image.",
  pexelsPhotoIds: [...ids].sort((a, b) => Number(a) - Number(b)),
};

const outPath = path.resolve(import.meta.dirname, "../data/used-images.json");
fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
console.log(`Generated used-images.json (${registry.pexelsPhotoIds.length} pexels photo IDs reserved)`);
