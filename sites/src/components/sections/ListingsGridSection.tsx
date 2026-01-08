import React from 'react';

interface ListingsGridSectionProps {
    content: Record<string, any>;
    listings?: any[];
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const ListingsGridSection: React.FC<ListingsGridSectionProps> = ({ content, listings = [], sectionId }) => {
    const title = content?.title || 'Featured Properties';
    const subtitle = content?.subtitle || '';

    return (
        <section className="listings-grid-section" id={sectionId || 'listings'}>
            <div className="container">
                <h2 className="section-title">{title}</h2>
                {subtitle && <p className="section-subtitle">{subtitle}</p>}
                <div className="listings-grid">
                    {listings.map((listing: any, index: number) => (
                        <div key={listing.id || index} className="listing-card">
                            {listing.image_url && (
                                <img src={listing.image_url} alt={listing.title} className="listing-image" />
                            )}
                            <div className="listing-content">
                                <h3>{listing.title}</h3>
                                {listing.price && <p className="listing-price">{listing.price}</p>}
                                {listing.location && <p className="listing-location">{listing.location}</p>}
                            </div>
                        </div>
                    ))}
                    {listings.length === 0 && (
                        <p className="no-listings">No properties available at this time.</p>
                    )}
                </div>
            </div>
        </section>
    );
};

export default ListingsGridSection;
