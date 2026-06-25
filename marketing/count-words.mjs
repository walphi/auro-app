import fs from "fs";

const code = fs.readFileSync("src/data/insights.ts", "utf-8");
const lines = code.split("\n");

let currentSlug = null;
let currentTitle = null;
let currentMinutes = null;
let inSections = false;
let bracketCount = 0;
let sectionLines = [];

for (const line of lines) {
  // Detect slug
  const slugMatch = line.match(/slug:\s*"([^"]+)"/);
  if (slugMatch) {
    if (currentSlug && sectionLines.length > 0) {
      // Count words in accumulated section lines
      const sectionText = sectionLines.join(" ");
      const textMatches = [...sectionText.matchAll(/:?\s*"(?:\\"|[^"])*"/g)];
      let words = 0;
      for (const m of textMatches) {
        const clean = m[0].replace(/^:\s*"/, "").replace(/"$/, "").replace(/\\"/g, '"');
        if (clean.length > 1) {
          words += clean.split(/\s+/).length;
        }
      }
      console.log(
        `${String(words).padStart(5)} words | ${String(currentMinutes || "?").padStart(2)} min | ${currentSlug}`
      );
    }
    currentSlug = slugMatch[1];
    currentTitle = null;
    currentMinutes = null;
    inSections = false;
    bracketCount = 0;
    sectionLines = [];
  }

  // Detect title
  const titleMatch = line.match(/title:\s*"([^"]+)"/);
  if (titleMatch && currentSlug) {
    currentTitle = titleMatch[1];
  }

  // Detect readMinutes
  const minutesMatch = line.match(/readMinutes:\s*(\d+)/);
  if (minutesMatch && currentSlug) {
    currentMinutes = parseInt(minutesMatch[1]);
  }

  // Track section boundaries
  if (line.includes("sections:")) {
    inSections = true;
    const bracketIdx = line.indexOf("[");
    if (bracketIdx >= 0) {
      bracketCount = (line.match(/\[/g) || []).length;
      bracketCount -= (line.match(/\]/g) || []).length;
    }
    continue;
  }

  if (inSections) {
    bracketCount += (line.match(/\[/g) || []).length;
    bracketCount -= (line.match(/\]/g) || []).length;
    sectionLines.push(line);
    if (bracketCount <= 0 && line.trim().startsWith("]")) {
      // End of sections
      inSections = false;
    }
  }
}

// Handle last article
if (currentSlug && sectionLines.length > 0) {
  const sectionText = sectionLines.join(" ");
  const textMatches = [...sectionText.matchAll(/:?\s*"(?:\\"|[^"])*"/g)];
  let words = 0;
  for (const m of textMatches) {
    const clean = m[0].replace(/^:\s*"/, "").replace(/"$/, "").replace(/\\"/g, '"');
    if (clean.length > 1) {
      words += clean.split(/\s+/).length;
    }
  }
  console.log(
    `${String(words).padStart(5)} words | ${String(currentMinutes || "?").padStart(2)} min | ${currentSlug}`
  );
}
