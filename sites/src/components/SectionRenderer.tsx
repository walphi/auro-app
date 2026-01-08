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

interface SectionRendererProps {
    section: Section;
    listings?: Listing[];
    config?: AgentConfig;
    designSystem?: DesignSystem;
}

const ListingDetailSection: React.FC<{ content: any }> = ({ content }) => {
    const listing = content?.listing;
    if (!listing) return <div>Listing not found</div>;
    return (
        <section className="listing-detail-section" style={{ padding: '100px 20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: '2.5rem', marginBottom: '20px' }}>{listing.title}</h1>
            <div className="listing-gallery" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '40px' }}>
                <img src={listing.photos?.[0]} alt={listing.title} style={{ width: '100%', height: '500px', objectFit: 'cover', borderRadius: '12px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <img src={listing.photos?.[1]} style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '12px' }} />
                    <img src={listing.photos?.[2]} style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '12px' }} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '60px' }}>
                <div>
                    <h2 style={{ fontFamily: 'var(--heading-font)', marginBottom: '20px' }}>Description</h2>
                    <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-color)' }}>{listing.description}</p>
                </div>
                <div style={{ background: 'var(--background-color)', padding: '30px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary-color)', marginBottom: '20px' }}>
                        {listing.currency} {Number(listing.price).toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                        <div><strong>Location:</strong> {listing.towerOrCommunity}</div>
                        <div><strong>Beds:</strong> {listing.beds}</div>
                        <div><strong>Baths:</strong> {listing.baths}</div>
                        <div><strong>Size:</strong> {listing.sizeSqft} SQFT</div>
                    </div>
                    <button style={{ width: '100%', background: 'var(--secondary-color)', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Enquire Now
                    </button>
                </div>
            </div>
        </section>
    );
};

const SectionRenderer: React.FC<SectionRendererProps> = ({ section, listings, config, designSystem }) => {
    const { type, content, id } = section;

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
            return <ListingDetailSection content={content} />;
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
