import React from 'react';
import './ServicesSection.css';

interface ServicesSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const ServicesSection: React.FC<ServicesSectionProps> = ({ content, config, sectionId }) => {
    const title = content?.title || 'Our Services';
    const services = content?.items || content?.services || config?.services || [];

    return (
        <section className="services-section" id={sectionId || 'services'}>
            <div className="services-container">
                <h2 className="services-title">{title}</h2>
                <div className="services-grid">
                    {services.map((service: any, index: number) => (
                        <div key={index} className="service-card">
                            <div className="service-icon">{service.icon || '✦'}</div>
                            <h3 className="service-name">{typeof service === 'string' ? service : service.name}</h3>
                            {service.description && <p className="service-description">{service.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ServicesSection;
