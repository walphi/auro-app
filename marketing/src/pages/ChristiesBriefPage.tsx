import React from "react";
import { Seo } from "../components/Seo.tsx";
import { canonicalUrl } from "../lib/site.ts";
import LuxuryDeck from "../components/LuxuryDeck.tsx";
import { christiesSlides } from "../data/christiesSlides.ts";

export default function ChristiesBriefPage() {
  return (
    <>
      <Seo
        metaTitle="Performance & Architecture Optimization Brief — Christie's International Real Estate Dubai"
        metaDescription="A strategic brief prepared for Christie's International Real Estate Dubai detailing performance architecture optimization through Auro App's intelligent middleware layer."
        canonicalUrl={canonicalUrl("/brief/christies/")}
        robots="noindex, nofollow"
      />
      <LuxuryDeck slides={christiesSlides} />
    </>
  );
}
