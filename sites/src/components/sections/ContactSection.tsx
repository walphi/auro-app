import React from 'react';
import { MessageCircle, Phone, Mail, MapPin } from 'lucide-react';

interface ContactSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const ContactSection: React.FC<ContactSectionProps> = ({ content, config, sectionId }) => {
    const title = content?.title || 'Get in Touch';
    const subtitle = content?.subtitle || '';

    const whatsappNumber = config?.leadConfig?.whatsappNumber || config?.phone;
    const email = config?.email;
    const address = config?.address;

    const whatsappLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent("Hi, I'm interested in your properties.")}`
        : null;

    return (
        <section className="contact-section" id={sectionId || 'contact'}>
            <div className="container">
                <h2 className="section-title">{title}</h2>
                {subtitle && <p className="section-subtitle">{subtitle}</p>}

                <div className="contact-grid">
                    <div className="contact-info">
                        {whatsappNumber && (
                            <div className="contact-item">
                                <Phone size={20} />
                                <span>{whatsappNumber}</span>
                            </div>
                        )}
                        {email && (
                            <div className="contact-item">
                                <Mail size={20} />
                                <a href={`mailto:${email}`}>{email}</a>
                            </div>
                        )}
                        {address && (
                            <div className="contact-item">
                                <MapPin size={20} />
                                <span>{address}</span>
                            </div>
                        )}
                    </div>

                    {whatsappLink && (
                        <div className="contact-cta">
                            <a
                                href={whatsappLink}
                                className="whatsapp-button"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <MessageCircle size={24} />
                                Chat on WhatsApp
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default ContactSection;
