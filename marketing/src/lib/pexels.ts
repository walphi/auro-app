const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || "";

const USED_IDS = new Set<number>();

const QUERY_MAP: Record<string, string[]> = {
  "lead-nurturing": ["lead nurturing", "nurturing system", "sales nurturing"],
  "ai-marketing": ["ai marketing", "automation", "artificial intelligence"],
  "real-estate-marketing": ["real estate marketing", "sales team", "digital marketing"],
  "dubai-luxury-real-estate": ["dubai skyline", "luxury property dubai", "dubai real estate"],
  "off-plan-dubai": ["off plan properties dubai", "dubai construction", "dubai property"],
  "booking-automation": ["calendar booking", "meeting scheduling", "automation"],
  "multi-agent-systems": ["ai network", "technology abstract", "digital agents"],
  default: ["modern office", "technology abstract", "business professional"],
};

function pickQuery(category: string): string {
  const queries = QUERY_MAP[category] || QUERY_MAP.default;
  return queries[Math.floor(Math.random() * queries.length)];
}

export interface PexelsResult {
  src: string;
  alt: string;
  id: number;
}

export async function getPexelsImage(
  category: string,
  orientation: "landscape" | "portrait" | "square" = "landscape"
): Promise<PexelsResult> {
  if (!PEXELS_API_KEY) {
    return {
      src: `https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=1200&q=80`,
      alt: "AURO lead nurturing",
      id: 0,
    };
  }

  const query = pickQuery(category);
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("orientation", orientation);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: PEXELS_API_KEY },
    });
    if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
    const data = await res.json();
    const photos = data.photos || [];
    const available = photos.filter((p: any) => !USED_IDS.has(p.id));
    const pick = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : photos[Math.floor(Math.random() * photos.length)];

    if (pick?.id) USED_IDS.add(pick.id);

    return {
      src: pick?.src?.large2x || pick?.src?.original || "",
      alt: pick?.alt || `AI-generated image for ${query}`,
      id: pick?.id || 0,
    };
  } catch {
    return {
      src: "",
      alt: query,
      id: 0,
    };
  }
}
