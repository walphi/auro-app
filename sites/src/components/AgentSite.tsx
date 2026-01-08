
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAgentSiteWithDocument, type AgentConfig, type SiteDocument, type Page, trackEvent } from '../api/agentSites';
import Navigation from './Navigation';
import SectionRenderer from './SectionRenderer';
import './AgentSite.css';

interface AgentSiteProps {
    pageId?: string;
}

const AgentSite: React.FC<AgentSiteProps> = ({ pageId = 'home' }) => {
    const { slug, listingId } = useParams<{ slug: string, listingId?: string }>();
    const [config, setConfig] = useState<AgentConfig | null>(null);
    const [siteDocument, setSiteDocument] = useState<SiteDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await getAgentSiteWithDocument(slug);
                console.log('[AgentSite] Successfully fetched data:', {
                    name: data.config.name,
                    slug: data.config.slug,
                    hasDocument: !!data.document,
                    pageId
                });
                setConfig(data.config);
                setSiteDocument(data.document);

                // Track page view
                trackEvent('page_view', { slug, pageId, listingId });

                // Apply design system
                applyDesignSystem(data.document, data.config);
            } catch (err: any) {
                console.error('Error fetching agent site:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [slug, pageId, listingId]);

    const applyDesignSystem = (doc: SiteDocument | null, cfg: AgentConfig) => {
        const root = window.document.documentElement;

        // Luxury Defaults
        const defaults = {
            primary: '#1a1a1a',
            secondary: '#c9a227',
            accent: '#c9a55c',
            bg: '#ffffff',
            text: '#1a1a1a',
            muted: '#888888',
            headingFont: "'Playfair Display', serif",
            bodyFont: "'Inter', sans-serif"
        };

        if (doc?.site?.designSystem) {
            const { colors, fonts } = doc.site.designSystem;
            root.style.setProperty('--primary-color', colors.primary || defaults.primary);
            root.style.setProperty('--secondary-color', colors.secondary || defaults.secondary);
            root.style.setProperty('--accent-color', colors.accent || defaults.accent);
            root.style.setProperty('--background-color', colors.background || defaults.bg);
            root.style.setProperty('--text-color', colors.text || defaults.text);
            root.style.setProperty('--muted-color', colors.muted || defaults.muted);
            root.style.setProperty('--heading-font', fonts.heading || defaults.headingFont);
            root.style.setProperty('--body-font', fonts.body || defaults.bodyFont);
        } else {
            root.style.setProperty('--primary-color', cfg.primaryColor || defaults.primary);
            root.style.setProperty('--secondary-color', cfg.secondaryColor || defaults.secondary);
            root.style.setProperty('--heading-font', defaults.headingFont);
            root.style.setProperty('--body-font', defaults.bodyFont);
        }
    };

    if (loading) {
        return (
            <div className="loader-container">
                <div className="spinner"></div>
                <h2 style={{ fontFamily: 'var(--heading-font)' }}>Loading exceptional properties...</h2>
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="error-container">
                <h1>{error === 'Not published yet' ? 'Coming Soon' : 'Property Haven Not Found'}</h1>
                <p>{error === 'Not published yet' ? "This agent site is not published yet. Please contact the broker for the correct link." : (error || "We couldn't find the agent site you're looking for.")}</p>
                <a href="/" className="cta-button">Back Home</a>
            </div>
        );
    }

    if (siteDocument) {
        return <DocumentBasedSite config={config} document={siteDocument} pageId={pageId} listingId={listingId} />;
    }

    return <LegacySinglePageSite config={config} />;
};

interface DocumentBasedSiteProps {
    config: AgentConfig;
    document: SiteDocument;
    pageId: string;
    listingId?: string;
}

const DocumentBasedSite: React.FC<DocumentBasedSiteProps> = ({ config, document: doc, pageId, listingId }) => {
    // Robust page matching
    const currentPage: Page | undefined = doc.pages?.find(p =>
        p.id?.toLowerCase() === pageId?.toLowerCase() ||
        (pageId === 'home' && (p.id?.toLowerCase() === 'home' || p.id?.toLowerCase() === 'index')) ||
        (pageId === 'listings' && (p.id?.toLowerCase() === 'properties' || p.id?.toLowerCase() === 'listings' || p.id?.toLowerCase() === 'listingsgrid'))
    ) || doc.pages?.[0];

    // Handle listing detail special case
    const isListingDetail = pageId === 'listing-detail' && listingId;
    const listings = doc.listings || config.listings || [];
    const currentListing = isListingDetail ? listings.find(l => l.id === listingId) : null;

    if (!currentPage && !isListingDetail) {
        return (
            <div className="error-container">
                <h1>Page Not Found</h1>
                <p>The requested page could not be found.</p>
                <a href={`/sites/${config.slug}`} className="cta-button">Back to Home</a>
            </div>
        );
    }

    return (
        <div className="agent-site agent-site--document fade-in">
            {doc.nav?.items && (
                <Navigation
                    items={doc.nav.items}
                    brandName={doc.site?.name || config.name}
                    logoUrl={config.logoUrl}
                />
            )}

            <main className="site-content">
                {isListingDetail ? (
                    <SectionRenderer
                        section={{ type: 'listingDetail', content: { listing: currentListing }, id: 'listing-detail' }}
                        listings={listings}
                        config={config}
                        designSystem={doc.site?.designSystem}
                    />
                ) : (
                    currentPage?.sections?.map((section, index) => (
                        <SectionRenderer
                            key={section.id || index}
                            section={section}
                            listings={listings}
                            config={config}
                            designSystem={doc.site?.designSystem}
                        />
                    ))
                )}
            </main>

            <footer className="footer">
                <div className="footer-container">
                    <div className="footer-brand">
                        <div className="footer-logo">{doc.site?.name || config.name}</div>
                        <p className="footer-tagline">Excellence in Luxury Real Estate</p>
                    </div>
                    <div className="footer-info">
                        <p>&copy; {new Date().getFullYear()} {config.name} | {config.company}</p>
                        <p className="footer-credits">Powered by Auro APP</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Legacy fallback
const LegacySinglePageSite: React.FC<{ config: AgentConfig }> = ({ config: _config }) => {
    // ... (Keep existing implementation for safety but wrap in luxury styles)
    return <div className="agent-site">Legacy Content</div>;
};

export default AgentSite;
