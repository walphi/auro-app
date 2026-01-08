import React from 'react';
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
    const title = content?.title || 'Exclusive Properties';
    const subtitle = content?.subtitle || 'Handpicked luxury residences for the discerning client.';

    const getListingImage = (listing: any) => {
        if (listing.photos && listing.photos.length > 0) return listing.photos[0];
        if (listing.image_url) return listing.image_url;
        return 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80';
    };

    return (
        <section className="listings-grid-section" id={sectionId || 'listings'} style={{ padding: '80px 0' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                    <h2 className="section-title">{title}</h2>
                    {subtitle && <p className="section-subtitle" style={{ fontSize: '1.1rem', color: 'var(--muted-color)', maxWidth: '700px', margin: '0 auto' }}>{subtitle}</p>}
                </div>

                <div className="listings-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: '30px',
                    padding: '0 20px'
                }}>
                    {listings.map((listing: any, index: number) => (
                        <div key={listing.id || index} className="listing-card" style={{
                            background: 'white',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                            transition: 'transform 0.3s ease',
                            border: '1px solid rgba(0,0,0,0.05)'
                        }}>
                            <div className="listing-image-container" style={{ height: '250px', position: 'relative', overflow: 'hidden' }}>
                                <img
                                    src={getListingImage(listing)}
                                    alt={listing.title}
                                    className="listing-image"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {listing.type && (
                                    <span className="listing-badge" style={{
                                        position: 'absolute',
                                        top: '15px',
                                        left: '15px',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        padding: '5px 12px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        {listing.type}
                                    </span>
                                )}
                            </div>
                            <div className="listing-details" style={{ padding: '25px' }}>
                                <div className="listing-price" style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '800',
                                    color: 'var(--primary-color)',
                                    marginBottom: '10px'
                                }}>
                                    {listing.currency || 'AED'} {listing.price ? Number(listing.price).toLocaleString() : 'POA'}
                                </div>
                                <h3 className="listing-title" style={{ fontSize: '1.2rem', marginBottom: '10px' }}>{listing.title || 'Exclusive Property'}</h3>
                                <div className="listing-location" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--muted-color)', marginBottom: '20px' }}>
                                    <MapPin size={16} />
                                    {listing.towerOrCommunity || listing.location || 'Dubai'}
                                </div>

                                <div className="listing-specs" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    borderTop: '1px solid rgba(0,0,0,0.05)',
                                    paddingTop: '15px',
                                    fontSize: '0.9rem',
                                    fontWeight: '600'
                                }}>
                                    <div className="spec-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <BedDouble size={18} /> {listing.beds || 0}
                                    </div>
                                    <div className="spec-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Bath size={18} /> {listing.baths || 0}
                                    </div>
                                    <div className="spec-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Maximize size={18} /> {listing.sizeSqft ? listing.sizeSqft.toLocaleString() : 'N/A'} <span style={{ fontSize: '0.7rem' }}>SQFT</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {listings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <p className="no-listings">No properties available at this time. Please contact us for exclusive off-market opportunities.</p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ListingsGridSection;
