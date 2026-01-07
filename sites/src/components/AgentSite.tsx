
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle, Phone, Mail, MapPin, BedDouble, Bath, Maximize } from 'lucide-react';
import { getAgentSite, type AgentConfig, trackEvent } from '../api/agentSites';
import './AgentSite.css';

const AgentSite: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [config, setConfig] = useState<AgentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await getAgentSite(slug);
                setConfig(data);

                // Track page view
                trackEvent('page_view', { slug });

                // Apply theme from style profile if available
                if (data.styleProfile) {
                    const root = document.documentElement;
                    if (data.styleProfile.primaryColor) {
                        root.style.setProperty('--primary-color', data.styleProfile.primaryColor);
                    }
                    if (data.styleProfile.secondaryColor) {
                        root.style.setProperty('--secondary-color', data.styleProfile.secondaryColor);
                    }
                } else if (data.primaryColor) {
                    // Fallback to agentconfigs columns
                    const root = document.documentElement;
                    root.style.setProperty('--primary-color', data.primaryColor);
                    root.style.setProperty('--secondary-color', data.secondaryColor || '#c9a227');
                }
            } catch (err: any) {
                console.error('Error fetching agent site:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [slug]);

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
