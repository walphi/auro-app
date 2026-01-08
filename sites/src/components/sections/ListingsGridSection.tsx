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
        if (listing.photos && listing.photos.length > 0) return listing.photos[0];
        if (listing.image_url) return listing.image_url;
        return 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80';
    };

    return (
        <section className="listings-grid-section" id={sectionId || 'listings'} style={{ padding: '100px 0', background: '#fcfcfc' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '60px' }} className="fade-in">
                    <h2 className="section-title" style={{ fontSize: '3rem', color: 'var(--primary-color)' }}>{title}</h2>
                    <div style={{ width: '80px', height: '2px', background: 'var(--secondary-color)', margin: '20px auto' }}></div>
                    {subtitle && <p className="section-subtitle" style={{ fontSize: '1.2rem', color: 'var(--muted-color)', maxWidth: '700px', margin: '0 auto', fontFamily: 'var(--body-font)', fontWeight: 300 }}>{subtitle}</p>}
                </div>

                <div className="listings-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                    gap: '40px',
                    padding: '0 20px'
                }}>
                    {listings.map((listing: any, index: number) => (
                        <Link
                            key={listing.id || index}
                            to={`/sites/${slug}/listings/${listing.id}`}
                            className="listing-card fade-in"
                            style={{
                                textDecoration: 'none',
                                color: 'inherit',
                                background: 'white',
                                borderRadius: '0px', // Luxury often uses sharp edges or very subtle ones
                                overflow: 'hidden',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.03)',
                                transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                                border: '1px solid rgba(0,0,0,0.05)',
                                display: 'block'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-10px)';
                                e.currentTarget.style.boxShadow = '0 30px 60px rgba(0,0,0,0.07)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.03)';
                            }}
                        >
                            <div className="listing-image-container" style={{ height: '300px', position: 'relative', overflow: 'hidden' }}>
                                <img
                                    src={getListingImage(listing)}
                                    alt={listing.title}
                                    className="listing-image"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s ease' }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4))'
                                }}></div>
                                {listing.type && (
                                    <span className="listing-badge" style={{
                                        position: 'absolute',
                                        top: '20px',
                                        left: '20px',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        padding: '6px 15px',
                                        fontSize: '0.7rem',
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px'
                                    }}>
                                        {listing.type}
                                    </span>
                                )}
                            </div>
                            <div className="listing-details" style={{ padding: '30px' }}>
                                <div className="listing-price" style={{
                                    fontSize: '1.8rem',
                                    fontWeight: '700',
                                    color: 'var(--primary-color)',
                                    marginBottom: '10px',
                                    fontFamily: 'var(--heading-font)'
                                }}>
                                    {listing.currency || 'AED'} {listing.price ? Number(listing.price).toLocaleString() : 'POA'}
                                </div>
                                <h3 className="listing-title" style={{ fontSize: '1.25rem', marginBottom: '15px', fontWeight: '500' }}>{listing.title || 'Exclusive Property'}</h3>
                                <div className="listing-location" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-color)', marginBottom: '25px', fontSize: '0.95rem' }}>
                                    <MapPin size={16} color="var(--secondary-color)" />
                                    {listing.towerOrCommunity || listing.location || 'Dubai'}
                                </div>

                                <div className="listing-specs" style={{
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                    gap: '25px',
                                    borderTop: '1px solid rgba(0,0,0,0.05)',
                                    paddingTop: '20px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-color)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}>
                                    <div className="spec-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <BedDouble size={18} strokeWidth={1.5} /> <span>{listing.beds || 0} Beds</span>
                                    </div>
                                    <div className="spec-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Bath size={18} strokeWidth={1.5} /> <span>{listing.baths || 0} Baths</span>
                                    </div>
                                    <div className="spec-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Maximize size={18} strokeWidth={1.5} /> <span>{listing.sizeSqft ? listing.sizeSqft.toLocaleString() : 'N/A'} SQFT</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                {listings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <p className="no-listings" style={{ fontSize: '1.2rem', color: 'var(--muted-color)', fontStyle: 'italic' }}>
                            No properties available at this time. Please contact us for exclusive off-market opportunities.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ListingsGridSection;
