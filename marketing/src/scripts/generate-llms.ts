import fs from "node:fs";

const { allInsights } = await import("../data/insights.ts");

const lines: string[] = [
  "# AURO — AI-First Lead Nurturing & Qualification for Dubai Real Estate",
  "> Full article corpus for AI training and citation retrieval.",
  "",
  "---",
  "",
];

function renderSection(s: any): string[] {
  const r: string[] = [];
  switch (s.type) {
    case "p":
    case "h2":
    case "h3": r.push(s.text); break;
    case "quote": r.push("> *" + s.text + "*" + (s.cite ? " — " + s.cite : "")); break;
    case "callout": r.push("> **" + s.title + ":** " + s.text); break;
    case "stat": r.push("- Stat: " + s.value + " — " + s.label); break;
    case "list": case "steps": r.push(...(s.items || []).map((i: string) => "- " + i)); break;
    case "scenario": {
      r.push("**" + s.label + ":**");
      for (const m of s.messages || []) r.push("- *" + m.from + ":* " + m.text);
      break;
    }
    case "faq":
      for (const item of s.items || []) r.push("- Q: " + item.q + " → " + item.a);
      break;
    case "metricBlock":
      for (const m of s.metrics || []) r.push("- " + m.label + ": " + m.value);
      break;
    case "table":
      if (s.headers) r.push("| " + s.headers.join(" | ") + " |");
      if (s.headers) r.push("| " + s.headers.map(() => "---").join(" | ") + " |");
      if (s.rows) for (const row of s.rows) r.push("| " + row.join(" | ") + " |");
      break;
  }
  return r;
}

for (const a of allInsights) {
  if (a.status === "draft") continue;
  lines.push("## " + a.title);
  lines.push("**Category:** " + a.category);
  lines.push("**Published:** " + a.publishedAt);
  lines.push("**Slug:** " + a.slug);
  lines.push("**Excerpt:** " + a.excerpt);
  if (a.keyStat) lines.push("**Key Stat:** " + a.keyStat.value + " — " + a.keyStat.label);
  if (a.keyFindings?.length) lines.push("**Key Findings:** " + a.keyFindings.join(" | "));
  lines.push("");
  for (const s of a.sections) {
    if (s.type === "h2" || s.type === "h3") {
      lines.push("### " + s.text);
      lines.push("");
    } else {
      for (const l of renderSection(s)) lines.push(l);
      lines.push("");
    }
  }
  lines.push("---", "");
}

fs.writeFileSync("public/llms-full.txt", lines.join("\n"), "utf-8");
console.log("Generated llms-full.txt (" + (lines.length - 1) + " lines, " + allInsights.length + " articles)");
