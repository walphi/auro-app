import React from 'react';
import { type Section, type Listing, type AgentConfig, type DesignSystem } from '../api/agentSites';
import HeroSection from './sections/HeroSection';
import AboutSection from './sections/AboutSection';
import ServicesSection from './sections/ServicesSection';
import ListingsGridSection from './sections/ListingsGridSection';
import TestimonialsSection from './sections/TestimonialsSection';
import ContactSection from './sections/ContactSection';
import CTABandSection from './sections/CTABandSection';
import StatsSection from './sections/StatsSection';
import FocusAreasSection from './sections/FocusAreasSection';
import ListingDetailSection from './sections/ListingDetailSection';

interface SectionRendererProps {
    section: Section;
    listings?: Listing[];
    config?: AgentConfig;
    designSystem?: DesignSystem;
}

const SectionRenderer: React.FC<SectionRendererProps> = ({ section, listings, config, designSystem }) => {
    const { type, content, id } = section;

    console.log(`[SectionRenderer] Rendering section: ${type}`, { id, contentKeys: Object.keys(content || {}) });

    const commonProps = {
        content,
        listings,
        config,
        designSystem,
        sectionId: id
    };

    switch (type) {
        case 'hero':
            return <HeroSection {...commonProps} />;
        case 'about':
            return <AboutSection {...commonProps} />;
        case 'services':
            return <ServicesSection {...commonProps} />;
        case 'listingsGrid':
            return <ListingsGridSection {...commonProps} />;
        case 'testimonials':
            return <TestimonialsSection {...commonProps} />;
        case 'contact':
            return <ContactSection {...commonProps} />;
        case 'ctaBand':
            return <CTABandSection {...commonProps} />;
        case 'stats':
            return <StatsSection {...commonProps} />;
        case 'focusAreas':
            return <FocusAreasSection {...commonProps} />;
        case 'listingDetail':
            return <ListingDetailSection content={content as any} config={config} designSystem={designSystem} />;
        default:
            console.warn(`[SectionRenderer] Unknown section type: ${type}`);
            return (
                <section className="section section-generic" id={id}>
                    <div className="container">
                        <h2>{content?.title || 'Section'}</h2>
                        {content?.text && <p>{content.text}</p>}
                    </div>
                </section>
            );
    }
};

export default SectionRenderer;
