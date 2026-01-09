import React from 'react';
import { MessageCircle, Phone, Mail, MapPin } from 'lucide-react';
import './ContactSection.css';

interface ContactSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const ContactSection: React.FC<ContactSectionProps> = ({ content, config, sectionId }) => {
    const title = content?.title || 'Connect with Excellence';
    const subtitle = content?.subtitle || 'Get in touch for bespoke real estate solutions.';

    const whatsappNumber = config?.leadConfig?.whatsappNumber || config?.phone;
    const email = config?.email;

    // Address often comes from config.location or content
    const address = config?.location || config?.address || content?.address;

    const whatsappLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent("Hi, I'm interested in your real estate services.")}`
        : null;

    return (
        <section className="contact-section" id={sectionId || 'contact'}>
            <div className="container">
                <div className="contact-grid">
                    <div className="contact-info fade-in-up">
                        <div className="section-header" style={{ textAlign: 'left', marginBottom: '60px', padding: 0 }}>
                            <span className="subtitle">Contact</span>
                            <h2 className="section-title">{title}</h2>
                            <p className="section-subtitle" style={{ margin: '20px 0', textAlign: 'left' }}>{subtitle}</p>
                        </div>

                        <div className="contact-details">
                            {whatsappNumber && (
                                <div className="contact-item">
                                    <Phone size={24} />
                                    <div>
                                        <h4>Phone & WhatsApp</h4>
                                        <span>{whatsappNumber}</span>
                                    </div>
                                </div>
                            )}
                            {email && (
                                <div className="contact-item">
                                    <Mail size={24} />
                                    <div>
                                        <h4>Email</h4>
                                        <a href={`mailto:${email}`}>{email}</a>
                                    </div>
                                </div>
                            )}
                            {address && (
                                <div className="contact-item">
                                    <MapPin size={24} />
                                    <div>
                                        <h4>Office</h4>
                                        <span>{address}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="contact-form-wrapper glass fade-in">
                        <h3>Enquire Now</h3>
                        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
                            <div className="form-group">
                                <label>Your Name</label>
                                <input type="text" placeholder="e.g. John Doe" />
                            </div>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input type="email" placeholder="e.g. john@example.com" />
                            </div>
                            <div className="form-group">
                                <label>Message</label>
                                <textarea rows={1} placeholder="How can I help you?"></textarea>
                            </div>

                            {whatsappLink && (
                                <a
                                    href={whatsappLink}
                                    className="whatsapp-button"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <MessageCircle size={20} />
                                    Send via WhatsApp
                                </a>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ContactSection;
