import React from 'react';
import { MessageCircle } from 'lucide-react';

interface CTABandSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const CTABandSection: React.FC<CTABandSectionProps> = ({ content, config, sectionId }) => {
    const title = content?.title || content?.headline || 'Ready to Get Started?';
    const subtitle = content?.subtitle || content?.text || '';
    const ctaText = content?.ctaText || 'Contact Us';

    const whatsappNumber = config?.leadConfig?.whatsappNumber || config?.phone;
    const ctaLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent("Hi, I'm interested in your properties.")}`
        : '#contact';

    return (
        <section className="cta-band-section" id={sectionId || 'cta'}>
            <div className="container">
                <div className="cta-content">
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                    <a
                        href={ctaLink}
                        className="cta-button"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <MessageCircle size={20} />
                        {ctaText}
                    </a>
                </div>
            </div>
        </section>
    );
};

export default CTABandSection;
