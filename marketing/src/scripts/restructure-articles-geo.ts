import fs from "node:fs";

function genDefFirst(a: any): string {
  const cat = a.category;
  const titleClean = a.title.replace(/[:—–-].*$/, "").trim();
  const ks = a.keyStat;
  const ksLower = ks ? ks.label.toLowerCase() : "conversion optimization";
  const yr = a.publishedAt.substring(0, 4);

  const m: Record<string, string> = {
    "dubai-luxury-real-estate": `This analysis of the Dubai luxury real estate market in ${yr} examines ${titleClean.toLowerCase()}, with transaction data showing ${ks ? ks.value + " " + ksLower : "record activity across prime segments"}. `,
    "off-plan-dubai": `This analysis of the Dubai off-plan property market in ${yr} examines ${titleClean.toLowerCase()}, with data showing ${ksLower}. `,
    "ai-marketing": `This article examines how AI is transforming ${titleClean.toLowerCase()} in Dubai real estate, building on ${yr} technology adoption data and industry benchmarks. `,
    "ai-news": `This article reports on the latest AI developments affecting ${titleClean.toLowerCase()} and their implications for Dubai real estate lead qualification and nurturing workflows. `,
    "multi-agent-systems": `Multi-agent AI systems orchestrate lead nurturing, qualification, and booking across multiple communication channels. This article examines ${titleClean.toLowerCase()} for Dubai real estate. `,
    "lead-nurturing-definition": `Lead nurturing is the systematic process of building relationships with potential buyers at every stage of their decision journey. This guide defines ${titleClean.toLowerCase()} for Dubai real estate teams. `,
    "lead-nurturing": `Lead nurturing is the process of guiding real estate prospects from initial inquiry to booked meeting through persistent, personalized engagement. This guide covers ${titleClean.toLowerCase()} for Dubai real estate. `,
    "lead-nurturing-strategy": `A lead nurturing strategy is a structured framework for engaging prospects through personalized, multi-touch sequences. This guide covers ${titleClean.toLowerCase()} for Dubai real estate agencies. `,
    "lead-nurturing-automation": `Lead nurturing automation uses AI to scale personalized follow-up without sacrificing quality. This article covers ${titleClean.toLowerCase()} for Dubai real estate teams. `,
    "sales-nurturing": `Sales nurturing is the process of converting real estate leads into booked meetings through structured, persistent engagement. This guide covers ${titleClean.toLowerCase()} for Dubai agencies. `,
    "playbooks": `This playbook provides actionable frameworks and templates for ${titleClean.toLowerCase()} in Dubai real estate sales and lead nurturing. `,
    "booking-automation": `Booking automation uses AI to qualify leads and schedule meetings without manual intervention. This article examines ${titleClean.toLowerCase()} for Dubai real estate. `,
    "case-studies": `This case study documents how a Dubai real estate agency used AI-powered lead nurturing to achieve measurable improvements in pipeline conversion and meeting booking rates. `,
    "experiments": `This controlled experiment measures the impact of specific variables on real estate lead conversion outcomes using data from AURO platform deployments in Dubai. `,
    "product-updates": `This update details the latest AURO platform features, improvements, and enhancements for Dubai real estate lead nurturing and qualification workflows. `,
    "faq-explainers": `This FAQ answers common questions about ${titleClean.toLowerCase()} in the context of Dubai real estate and AI-powered lead qualification systems. `,
    "real-estate-marketing": `This marketing guide examines strategies for ${titleClean.toLowerCase()} in Dubai, covering digital channels, AI-powered nurturing, and data-driven campaign optimization. `,
    "developer-funnels": `Developer funnels are sales pipelines designed specifically for off-plan property marketing. This article examines ${titleClean.toLowerCase()} for Dubai developers. `,
  };
  return m[cat] || `This article explores ${titleClean.toLowerCase()} in the context of Dubai real estate, providing data and analysis on ${ksLower}. `;
}

function genAnswerFirst(h2Text: string): string {
  const t = h2Text.replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim();
  if (/^the\s/i.test(t)) return t + " is a defining characteristic of the 2026 Dubai real estate market. ";
  if (/^(how|what|why)\s/i.test(t)) return t + " has become a central strategic question for Dubai real estate agencies in 2026. ";
  if (/beyond/i.test(t)) return "Moving beyond transactional approaches is essential for agencies competing in the 2026 Dubai real estate market. ";
  if (/looking ahead|the future/i.test(t)) return "Looking ahead, the Dubai real estate market trajectory points toward continued expansion driven by technological integration and sustained investor demand. ";
  if (/advantage|imperative|critical/i.test(t)) return t + " represents a strategic priority for Dubai real estate agencies seeking competitive differentiation in 2026. ";
  if (/transformation|evolution|shift/i.test(t)) return t + " is reshaping operational models and conversion strategies for Dubai real estate agencies. ";
  if (/from.*to/i.test(t)) return t + " describes the paradigm shift occurring in how Dubai real estate agencies manage and convert their lead pipelines. ";
  if (/dominance|ascent|surge|boom/i.test(t)) return t + " continues to accelerate in 2026, driven by structural demand and favorable market conditions in Dubai. ";
  return t + " plays a pivotal role in shaping Dubai real estate agency outcomes in 2026. ";
}

const { allInsights } = await import("../data/insights.ts");

let content = fs.readFileSync("src/data/insights.ts", "utf-8");
let defCount = 0;
let h2Count = 0;

for (const a of allInsights) {
  const escapedSlug = a.slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const slugIdx = content.search(new RegExp(`slug:\\s*"${escapedSlug}"`));

  const afterSlug = content.substring(slugIdx);
  const sStart = afterSlug.indexOf("sections: [");
  const blockStart = slugIdx + sStart + 10;

  const afterBlockStart = content.substring(blockStart);
  const sEnd = afterBlockStart.search(/\],\s*\r?\n\s*internalLinks:/);

  const block = afterBlockStart.substring(0, sEnd);
  const lines = block.split("\n");

  let firstPPending = true;
  let prevWasH2 = false;
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    let modified = line;

    const isH2 = /^\{\s*type:\s*"h2"/.test(trimmed);
    const isP = /^\{\s*type:\s*"p"/.test(trimmed);
    const isSectionEntry = /^\{\s*type:\s*"/.test(trimmed);

    if (isH2) {
      prevWasH2 = true;
    }

    if (isP) {
      const m = trimmed.match(/text: ("(?:[^"\\]|\\.)*")/);
      if (m) {
        const currentText = JSON.parse(m[1]);
        let prefix = "";

        if (firstPPending) {
          prefix = genDefFirst(a);
          firstPPending = false;
        } else if (prevWasH2) {
          const h2Line = out.findLast((l) => /^\{\s*type:\s*"h2"/.test(l.trim()));
          const h2m = h2Line?.match(/text: "([^"]+)"/);
          if (h2m) {
            prefix = genAnswerFirst(h2m[1]);
          }
        }

        if (prefix && !currentText.startsWith(prefix)) {
          modified = line.replace(m[1], JSON.stringify(prefix + currentText));
          if (!prevWasH2) defCount++;
          else h2Count++;
        }
      }
      prevWasH2 = false;
    }

    if (isSectionEntry && !isH2 && !isP) {
      prevWasH2 = false;
    }

    out.push(modified);
  }

  const newBlock = out.join("\n");
  content = content.substring(0, blockStart) + newBlock + content.substring(blockStart + sEnd);
}

fs.writeFileSync("src/data/insights.ts", content, "utf-8");
console.log(`Definition-first openings: ${defCount} articles`);
console.log(`Answer-first H2 sections: ${h2Count}`);
