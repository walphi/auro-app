import React from 'react';
import { MessageCircle, MapPin, BedDouble, Bath, Maximize, ChevronLeft, ChevronRight } from 'lucide-react';
import { type Listing } from '../../api/agentSites';
import './ListingDetailSection.css';

interface ListingDetailSectionProps {
    content: {
        listing: Listing;
    };
    config?: any;
    designSystem?: any;
}

const ListingDetailSection: React.FC<ListingDetailSectionProps> = ({ content, config }) => {
    const { listing } = content;
    const [activePhoto, setActivePhoto] = React.useState(0);

    if (!listing) {
        return (
            <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
                <h2>Listing not found</h2>
                <p>The property you are looking for is no longer available.</p>
            </div>
        );
    }

    const nextPhoto = () => {
        if (listing.photos && listing.photos.length > 0) {
            setActivePhoto((prev) => (prev + 1) % listing.photos.length);
        }
    };

    const prevPhoto = () => {
        if (listing.photos && listing.photos.length > 0) {
            setActivePhoto((prev) => (prev - 1 + listing.photos.length) % listing.photos.length);
        }
    };

    const whatsappNumber = config?.leadConfig?.whatsappNumber || config?.phone;
    const enquiryLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in "${listing.title}" (${listing.id}).`)}`
        : '#contact';

    return (
        <section className="listing-detail-section fade-in">
            <div className="container">
                <div className="listing-header">
                    <div className="header-main">
                        <span className="listing-tag">{listing.type}</span>
                        <h1 className="listing-title">{listing.title}</h1>
                        <div className="listing-location">
                            <MapPin size={18} />
                            <span>{listing.towerOrCommunity}</span>
                        </div>
                    </div>
                    <div className="header-price">
                        {listing.currency} {Number(listing.price).toLocaleString()}
                    </div>
                </div>

                <div className="listing-gallery-main">
                    <div className="gallery-primary">
                        <img
                            src={listing.photos?.[activePhoto] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'}
                            alt={listing.title}
                        />
                        {listing.photos && listing.photos.length > 1 && (
                            <div className="gallery-nav">
                                <button onClick={prevPhoto}><ChevronLeft /></button>
                                <button onClick={nextPhoto}><ChevronRight /></button>
                                <span className="photo-counter">{activePhoto + 1} / {listing.photos.length}</span>
                            </div>
                        )}
                    </div>
                    {listing.photos && listing.photos.length > 1 && (
                        <div className="gallery-thumbnails">
                            {listing.photos.slice(0, 4).map((photo, i) => (
                                <div
                                    key={i}
                                    className={`thumbnail ${i === activePhoto ? 'active' : ''}`}
                                    onClick={() => setActivePhoto(i)}
                                >
                                    <img src={photo} alt={`${listing.title} ${i + 1}`} />
                                    {i === 3 && listing.photos.length > 4 && (
                                        <div className="more-photos">+{listing.photos.length - 4}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="listing-info-grid">
                    <div className="info-main">
                        <div className="listing-specs-bar">
                            <div className="spec-item">
                                <BedDouble size={20} />
                                <div>
                                    <span className="spec-value">{listing.beds}</span>
                                    <span className="spec-label">Bedrooms</span>
                                </div>
                            </div>
                            <div className="spec-item">
                                <Bath size={20} />
                                <div>
                                    <span className="spec-value">{listing.baths}</span>
                                    <span className="spec-label">Bathrooms</span>
                                </div>
                            </div>
                            <div className="spec-item">
                                <Maximize size={20} />
                                <div>
                                    <span className="spec-value">{listing.sizeSqft?.toLocaleString()}</span>
                                    <span className="spec-label">Sq. Ft.</span>
                                </div>
                            </div>
                        </div>

                        <div className="listing-description">
                            <h3>Description</h3>
                            {listing.description ? (
                                <p>{listing.description}</p>
                            ) : (
                                <p>Experience urban luxury at its finest. This exceptional residence offers premium finishes, breathtaking views, and a lifestyle of unparalleled convenience in one of Dubai's most sought-after locations.</p>
                            )}
                        </div>

                        {listing.features && listing.features.length > 0 && (
                            <div className="listing-features">
                                <h3>Amenities</h3>
                                <ul>
                                    {listing.features.map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="info-sidebar">
                        <div className="enquiry-card glass">
                            <h3>Interested in this property?</h3>
                            <p>Contact the listing agent for more information or to schedule a private viewing.</p>

                            <a href={enquiryLink} className="enquiry-button" target="_blank" rel="noopener noreferrer">
                                <MessageCircle size={20} />
                                Enquire via WhatsApp
                            </a>

                            <div className="agent-mini-profile">
                                {config?.profilePhotoUrl && <img src={config.profilePhotoUrl} alt={config.name} />}
                                <div>
                                    <div className="mini-name">{config?.name}</div>
                                    <div className="mini-title">{config?.designation}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ListingDetailSection;
