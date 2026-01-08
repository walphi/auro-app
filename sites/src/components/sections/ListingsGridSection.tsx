import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Maximize } from 'lucide-react';
import { type Listing } from '../../api/agentSites';

interface ListingsGridSectionProps {
    content: Record<string, any>;
    listings?: Listing[];
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const ListingsGridSection: React.FC<ListingsGridSectionProps> = ({ content, listings = [], sectionId }) => {
    const { slug } = useParams<{ slug: string }>();
    const title = content?.heading || content?.title || 'Exclusive Properties';
    const subtitle = content?.subheading || content?.subtitle || 'Handpicked luxury residences for the discerning client.';

    const getListingImage = (listing: any) => {
        if (listing.photos && listing.photos.length > 0 && !listing.photos[0].includes('example.com') && !listing.photos[0].includes('url_to_image')) {
            return listing.photos[0];
        }
        if (listing.image_url && !listing.image_url.includes('example.com')) {
            return listing.image_url;
        }
        // Fallback luxury placeholder
        return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';
    };

    return (
        <section className="listings-grid-section" id={sectionId || 'listings'} style={{ padding: '120px 0', background: '#ffffff' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '80px' }} className="fade-in-up">
                    <span style={{
                        textTransform: 'uppercase',
                        letterSpacing: '4px',
                        fontSize: '0.8rem',
                        color: 'var(--secondary-color)',
                        fontWeight: '600',
                        display: 'block',
                        marginBottom: '15px'
                    }}>Curated Selection</span>
                    <h2 className="section-title" style={{
                        fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                        color: 'var(--primary-color)',
                        fontFamily: 'var(--heading-font)',
                        marginBottom: '25px'
                    }}>{title}</h2>
                    <div style={{ width: '50px', height: '1px', background: 'var(--secondary-color)', margin: '0 auto 25px' }}></div>
                    {subtitle && <p className="section-subtitle" style={{
                        fontSize: '1.1rem',
                        color: 'var(--muted-color)',
                        maxWidth: '600px',
                        margin: '0 auto',
                        fontFamily: 'var(--body-font)',
                        fontWeight: 300,
                        lineHeight: '1.8'
                    }}>{subtitle}</p>}
                </div>

                <div className="listings-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                    gap: '50px 30px',
                    padding: '0 20px'
                }}>
                    {listings.map((listing: any, index: number) => (
                        <Link
                            key={listing.id || index}
                            to={`/${slug}/listings/${listing.id}`}
                            className="listing-card fade-in"
                            style={{
                                textDecoration: 'none',
                                color: 'inherit',
                                background: 'white',
                                borderRadius: '0px',
                                overflow: 'hidden',
                                transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
                                display: 'block',
                                position: 'relative'
                            }}
                        >
                            <div className="listing-image-container" style={{
                                height: '450px',
                                position: 'relative',
                                overflow: 'hidden',
                                background: '#f0f0f0'
                            }}>
                                <img
                                    src={getListingImage(listing)}
                                    alt={listing.title}
                                    className="listing-image"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        transition: 'transform 1.2s cubic-bezier(0.19, 1, 0.22, 1)'
                                    }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7))',
                                    opacity: 0.8
                                }}></div>

                                <div style={{
                                    position: 'absolute',
                                    bottom: '30px',
                                    left: '30px',
                                    right: '30px',
                                    color: 'white'
                                }}>
                                    <div style={{
                                        fontSize: '1.8rem',
                                        fontWeight: '600',
                                        marginBottom: '5px',
                                        fontFamily: 'var(--heading-font)'
                                    }}>
                                        {listing.currency || 'AED'} {listing.price ? Number(listing.price).toLocaleString() : 'POA'}
                                    </div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '400', letterSpacing: '0.5px' }}>{listing.title || 'Exclusive Property'}</h3>
                                </div>

                                {listing.type && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '30px',
                                        right: '30px',
                                        background: 'var(--secondary-color)',
                                        color: 'var(--primary-color)',
                                        padding: '8px 20px',
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        letterSpacing: '2px',
                                        backdropFilter: 'blur(5px)'
                                    }}>
                                        {listing.type}
                                    </span>
                                )}
                            </div>
                            <div style={{ padding: '25px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-color)', marginBottom: '15px', fontSize: '0.9rem' }}>
                                    <MapPin size={14} color="var(--secondary-color)" />
                                    <span style={{ letterSpacing: '1px', textTransform: 'uppercase' }}>{listing.towerOrCommunity || listing.location || 'Dubai'}</span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: '20px',
                                    fontSize: '0.8rem',
                                    color: 'var(--primary-color)',
                                    fontWeight: '600',
                                    letterSpacing: '1px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <BedDouble size={16} strokeWidth={1.5} /> <span>{listing.beds || 0} BEDS</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Bath size={16} strokeWidth={1.5} /> <span>{listing.baths || 0} BATHS</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Maximize size={16} strokeWidth={1.5} /> <span>{listing.sizeSqft ? listing.sizeSqft.toLocaleString() : 'N/A'} SQFT</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                {listings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <p style={{ fontSize: '1.2rem', color: 'var(--muted-color)', fontStyle: 'italic', fontWeight: 300 }}>
                            No properties available at this time. Please contact us for exclusive off-market opportunities.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ListingsGridSection;
