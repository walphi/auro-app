import React from 'react';
import './FocusAreasSection.css';

interface FocusAreasSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const FocusAreasSection: React.FC<FocusAreasSectionProps> = ({ content, sectionId }) => {
    const title = content?.title || 'Key Expertise Areas';
    const areas = content?.areas || [];

    const getAreaImage = (area: any) => {
        if (area.image) return area.image;
        return `https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80`;
    };

    return (
        <section className="focus-areas-section" id={sectionId || 'focus-areas'}>
            <div className="container">
                <div className="section-header fade-in-up">
                    <span className="subtitle">Expertise</span>
                    <h2 className="section-title">{title}</h2>
                    <div className="divider"></div>
                </div>

                <div className="focus-areas-grid">
                    {areas.map((area: any, index: number) => (
                        <div key={index} className="focus-area-card fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                            <img src={getAreaImage(area)} alt={area.name} />
                            <div className="focus-area-overlay">
                                <h3>{area.name}</h3>
                                {area.description && <p>{area.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FocusAreasSection;
