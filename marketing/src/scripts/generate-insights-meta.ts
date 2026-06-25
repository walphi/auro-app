import fs from "fs";
import path from "path";
import { allInsights } from "../data/insights.ts";
import type { InsightMeta } from "../types/content.ts";

const insightsMeta: InsightMeta[] = allInsights.map(
  ({ sections, internalLinks, ...meta }) => meta
);

const output = `import type { InsightMeta } from "../types/content.ts";\n\nexport const insightsMeta: InsightMeta[] = ${JSON.stringify(insightsMeta, null, 2)};\n`;

const outPath = path.resolve(import.meta.dirname, "../data/insights-meta.ts");
fs.writeFileSync(outPath, output, "utf-8");
console.log(`Generated insights-meta.ts (${insightsMeta.length} entries)`);
