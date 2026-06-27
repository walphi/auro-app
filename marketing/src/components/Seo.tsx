import { Helmet } from "react-helmet-async";
import type { ReactNode } from "react";

interface SeoProps {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  robots?: string;
  jsonLd?: Record<string, any>;
  children?: ReactNode;
}

export function Seo({
  metaTitle,
  metaDescription,
  canonicalUrl: canonical,
  ogImage = "https://auroapp.com/auro-og.jpg",
  ogType = "website",
  robots = "index, follow, max-image-preview:large, max-snippet:-1",
  jsonLd,
}: SeoProps) {
  const title = `${metaTitle} | AURO`;
  const url = canonical;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={metaDescription} />
      <meta name="robots" content={robots} />
      {url && <link rel="canonical" href={url} />}

      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={ogType} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={metaTitle} />
      <meta property="og:site_name" content="AURO" />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={metaTitle} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
