import React from 'react';
import { MessageCircle } from 'lucide-react';
import './HeroSection.css';

interface HeroSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const HeroSection: React.FC<HeroSectionProps> = ({ content, config, designSystem, sectionId }) => {
    const headline = content?.headline || content?.title || config?.name || 'Welcome';
    const subheadline = content?.subheadline || content?.subtitle || config?.designation || '';
    const ctaText = content?.ctaText || config?.leadConfig?.ctaTexts?.primary || 'Get in Touch';
    const backgroundImage = content?.backgroundImage || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80';

    const whatsappNumber = config?.leadConfig?.whatsappNumber || config?.phone;
    const ctaLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent("Hi, I'm interested in your properties.")}`
        : '#contact';

    return (
        <section
            className="hero-section"
            id={sectionId || 'hero'}
            style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${backgroundImage})` }}
        >
            <div className="hero-content">
                <h1 className="hero-headline">{headline}</h1>
                {subheadline && <p className="hero-subheadline">{subheadline}</p>}
                <a
                    href={ctaLink}
                    className="hero-cta"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <MessageCircle size={20} />
                    {ctaText}
                </a>
            </div>
        </section>
    );
};

export default HeroSection;
