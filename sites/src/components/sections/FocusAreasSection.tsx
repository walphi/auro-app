import React from 'react';

interface FocusAreasSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const FocusAreasSection: React.FC<FocusAreasSectionProps> = ({ content, sectionId }) => {
    const title = content?.title || 'Areas of Focus';
    const areas = content?.areas || [];

    return (
        <section className="focus-areas-section" id={sectionId || 'focus-areas'}>
            <div className="container">
                <h2 className="section-title">{title}</h2>
                <div className="focus-areas-grid">
                    {areas.map((area: any, index: number) => (
                        <div key={index} className="focus-area-card">
                            {area.image && <img src={area.image} alt={area.name} />}
                            <h3>{area.name}</h3>
                            {area.description && <p>{area.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FocusAreasSection;
