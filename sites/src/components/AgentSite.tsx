
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle, Phone, Mail, MapPin, BedDouble, Bath, Maximize } from 'lucide-react';
import { getAgentSiteWithDocument, type AgentConfig, type SiteDocument, type Page, trackEvent } from '../api/agentSites';
import Navigation from './Navigation';
import SectionRenderer from './SectionRenderer';
import './AgentSite.css';

interface AgentSiteProps {
    pageId?: string;
}

const AgentSite: React.FC<AgentSiteProps> = ({ pageId = 'home' }) => {
    const { slug } = useParams<{ slug: string }>();
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
                    listingsCount: data.config.listings?.length || 0,
                    hasDocument: !!data.document,
                    documentPages: data.document?.pages?.length || 0
                });
                setConfig(data.config);
                setSiteDocument(data.document);

                // Track page view
                trackEvent('page_view', { slug, pageId });

                // Apply design system from document or fallback to config
                applyDesignSystem(data.document, data.config);
            } catch (err: any) {
                console.error('Error fetching agent site:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [slug, pageId]);

    const applyDesignSystem = (doc: SiteDocument | null, cfg: AgentConfig) => {
        const root = window.document.documentElement;

        if (doc?.site?.designSystem?.colors) {
            const { colors } = doc.site.designSystem;
            root.style.setProperty('--primary-color', colors.primary || '#c9a227');
            root.style.setProperty('--secondary-color', colors.secondary || '#1a1a2e');
            root.style.setProperty('--accent-color', colors.accent || '#d4af37');
            root.style.setProperty('--background-color', colors.background || '#0f0f1a');
            root.style.setProperty('--text-color', colors.text || '#ffffff');
            root.style.setProperty('--muted-color', colors.muted || '#888888');
        } else if (cfg.styleProfile) {
            if (cfg.styleProfile.primaryColor) {
                root.style.setProperty('--primary-color', cfg.styleProfile.primaryColor);
            }
            if (cfg.styleProfile.secondaryColor) {
                root.style.setProperty('--secondary-color', cfg.styleProfile.secondaryColor);
            }
        } else if (cfg.primaryColor) {
            root.style.setProperty('--primary-color', cfg.primaryColor);
            root.style.setProperty('--secondary-color', cfg.secondaryColor || '#c9a227');
        }
    };

    if (loading) {
        return (
            <div className="loader-container">
                <div className="spinner"></div>
                <h2>Loading your stunning property site...</h2>
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

    // If we have a document, render the multi-page version
    if (siteDocument) {
        return <DocumentBasedSite config={config} document={siteDocument} pageId={pageId} />;
    }

    // Fallback to legacy single-page rendering
    return <LegacySinglePageSite config={config} />;
};

// New document-based multi-page renderer
interface DocumentBasedSiteProps {
    config: AgentConfig;
    document: SiteDocument;
    pageId: string;
}

const DocumentBasedSite: React.FC<DocumentBasedSiteProps> = ({ config, document: doc, pageId }) => {
    // Find the current page - robust matching
    console.log('[DocumentBasedSite] Selecting page:', {
        pageId,
        availablePages: doc.pages?.map(p => p.id),
        hasNav: !!doc.nav,
        hasDesign: !!doc.site?.designSystem
    });

    const currentPage: Page | undefined = doc.pages?.find(p =>
        p.id?.toLowerCase() === pageId?.toLowerCase() ||
        (pageId === 'home' && (p.id?.toLowerCase() === 'home' || p.id?.toLowerCase() === 'index' || p.id?.toLowerCase() === 'main')) ||
        (pageId === 'listings' && (p.id?.toLowerCase() === 'properties' || p.id?.toLowerCase() === 'listings' || p.id?.toLowerCase() === 'listingsgrid'))
    ) || doc.pages?.[0];

    if (!currentPage || !doc.pages || doc.pages.length === 0) {
        console.error('[DocumentBasedSite] No page found for:', pageId, 'Document:', doc);
        return (
            <div className="error-container">
                <h1>Page Not Found</h1>
                <p>We couldn't find the "{pageId}" page for this agent.</p>
                <a href={`/sites/${config.slug}`} className="cta-button">Back to Home</a>
            </div>
        );
    }

    // Merge listings from document or config
    const listings = doc.listings || config.listings || [];

    return (
        <div className="agent-site agent-site--document">
            {/* Navigation */}
            {doc.nav?.items && (
                <Navigation
                    items={doc.nav.items}
                    brandName={doc.site?.name || config.name}
                    logoUrl={config.logoUrl}
                />
            )}

            {/* Page Sections */}
            <main className="site-content">
                {currentPage.sections?.map((section, index) => (
                    <SectionRenderer
                        key={section.id || index}
                        section={section}
                        listings={listings}
                        config={config}
                        designSystem={doc.site?.designSystem}
                    />
                ))}
            </main>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-logo">{doc.site?.name || config.name}</div>
                <div className="footer-company">&copy; {new Date().getFullYear()} {config.name} | {config.company}</div>
                <div className="footer-credits">Powered by Auro APP</div>
            </footer>
        </div>
    );
};

// Legacy single-page renderer (backward compatibility)
interface LegacySinglePageSiteProps {
    config: AgentConfig;
}

const LegacySinglePageSite: React.FC<LegacySinglePageSiteProps> = ({ config }) => {
    const { leadConfig } = config;
    const primaryChannel = leadConfig?.primaryChannel || 'whatsapp';
    const whatsappLink = `https://wa.me/${leadConfig?.whatsappNumber || config.phone}?text=${encodeURIComponent('Hi, I\'m interested in your real estate services.')}`;
    const phoneLink = `tel:${config.phone}`;
    const emailLink = `mailto:${config.email}`;

    const handleCTAClick = () => {
        trackEvent('cta_click', { channel: primaryChannel, agentId: config.id });
    };

    const handleListingClick = (listingTitle: string) => {
        trackEvent('listing_click', { listing: listingTitle, agentId: config.id });
    };

    const getCTAContent = () => {
        const ctaText = leadConfig?.ctaTexts?.primary || (primaryChannel === 'whatsapp' ? 'Chat via WhatsApp' : 'Get in Touch');

        if (primaryChannel === 'whatsapp') {
            return {
                icon: <MessageCircle size={24} />,
                text: ctaText,
                link: whatsappLink
            };
        } else if (primaryChannel === 'phone') {
            return {
                icon: <Phone size={24} />,
                text: ctaText,
                link: phoneLink
            };
        } else {
            return {
                icon: <Mail size={24} />,
                text: ctaText,
                link: emailLink
            };
        }
    };

    const cta = getCTAContent();

    return (
        <div className="agent-site">
            {/* Hero Section */}
            <header className="hero">
                <div className="hero-content">
                    {config.profilePhotoUrl && (
                        <img src={config.profilePhotoUrl} alt={config.name} className="profile-photo" />
                    )}
                    <h1 className="agent-name">{config.name}</h1>
                    <p className="agent-designation">{config.designation} @ {config.company}</p>
                    <a
                        href={cta.link}
                        className="cta-button"
                        onClick={handleCTAClick}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {cta.icon}
                        {cta.text}
                    </a>
                </div>
            </header>

            {/* Listings Grid */}
            <main className="listings-section">
                <h2 className="section-title">Featured Properties</h2>
                <div className="listings-grid">
                    {config.listings && config.listings.length > 0 ? (
                        config.listings.map((listing, index) => (
                            <div
                                key={index}
                                className="listing-card"
                                onClick={() => handleListingClick(listing.title)}
                            >
                                <div className="listing-image-container">
                                    <img
                                        src={listing.photos && listing.photos.length > 0 ? listing.photos[0] : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80'}
                                        alt={listing.title}
                                        className="listing-image"
                                    />
                                    <span className="listing-badge">{listing.type}</span>
                                </div>
                                <div className="listing-details">
                                    <div className="listing-price">
                                        {listing.currency} {listing.price ? Number(listing.price).toLocaleString() : 'POA'}
                                    </div>
                                    <h3 className="listing-title">{listing.title || 'Exclusive Property'}</h3>
                                    <div className="listing-location">
                                        <MapPin size={16} />
                                        {listing.towerOrCommunity || 'Dubai'}
                                    </div>
                                    <div className="listing-specs">
                                        <div className="spec-item">
                                            <BedDouble size={18} />
                                            {listing.beds || 0} Beds
                                        </div>
                                        <div className="spec-item">
                                            <Bath size={18} />
                                            {listing.baths || 0} Baths
                                        </div>
                                        <div className="spec-item">
                                            <Maximize size={18} />
                                            {listing.sizeSqft ? listing.sizeSqft.toLocaleString() : 'N/A'} sqft
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="no-listings">Check back soon for new exclusive properties.</p>
                    )}
                </div>
            </main>

            {/* About Section */}
            {config.bio && (
                <section className="about-section">
                    <div className="about-container">
                        <h2 className="section-title">About Me</h2>
                        <p className="about-text">{config.bio}</p>
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="footer">
                <div className="footer-logo">Auro Agent Sites</div>
                <div className="footer-company">&copy; {new Date().getFullYear()} {config.name} | {config.company}</div>
                <div className="footer-credits">Powered by Auro APP</div>
            </footer>
        </div>
    );
};

export default AgentSite;
