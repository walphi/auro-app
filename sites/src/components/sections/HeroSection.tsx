import React from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import './HeroSection.css';

interface HeroSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const HeroSection: React.FC<HeroSectionProps> = ({ content, config, sectionId }) => {
    const title = content?.title || content?.headline || config?.name || 'Luxury Real Estate';
    const subtitle = content?.subtitle || content?.subheadline || config?.designation || '';
    const ctaText = content?.cta?.text || content?.ctaText || 'Enquire Now';
    const backgroundImage = content?.backgroundImage || content?.image || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80';

    const whatsappNumber = config?.leadConfig?.whatsappNumber || config?.phone;
    const ctaLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent("Hi, I'm interested in your properties.")}`
        : '#contact';

    return (
        <section
            className="hero-section luxury-hero fade-in"
            id={sectionId || 'hero'}
            style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            }}
        >
            <div className="hero-overlay"></div>
            <div className="hero-content-wrapper">
                <div className="hero-content glass-card fade-in-up">
                    <h1 className="hero-title">{title}</h1>
                    <div className="hero-divider"></div>
                    {subtitle && <p className="hero-subtitle">{subtitle}</p>}
                    <a
                        href={ctaLink}
                        className="hero-cta-button luxury-button"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <MessageCircle size={20} />
                        <span>{ctaText}</span>
                    </a>
                </div>
            </div>
            <div className="scroll-indicator">
                <ChevronDown size={32} className="bounce" />
            </div>
        </section>
    );
};

export default HeroSection;
