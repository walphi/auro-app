export const SITE_URL = "https://auroapp.com";
export const SITE_NAME = "AURO";
export const SITE_DESCRIPTION = "The AI-first lead nurturing and qualification multi-agent system for Dubai real estate.";
export const SITE_LOGO = `${SITE_URL}/auro-og.png`;
export const SITE_LOCALE = "en_US";

export function canonicalUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean.endsWith("/") ? clean : `${clean}/`}`;
}

export const SITE_ADDRESS = {
  addressCountry: "AE",
  addressRegion: "Dubai",
  addressLocality: "Dubai",
};

export const SITE_CONTACT = {
  telephone: "",
  email: "pw@auroapp.com",
  contactType: "Sales",
  whatsApp: "",
};

export const NAV_LINKS = [
  { label: "00 // HOME", to: "/" },
  { label: "01 // HOW IT WORKS", to: "/#how-it-works" },
  { label: "02 // REVENUE", to: "/#revenue" },
  { label: "03 // ABOUT", to: "/#about" },
  { label: "04 // INSIGHTS", to: "/insights" },
  { label: "05 // FAQ", to: "/faq" },
  { label: "06 // PRODUCT UPDATES", to: "/product-updates" },
  { label: "07 // CONTACT", to: "/#cta" },
] as const;
