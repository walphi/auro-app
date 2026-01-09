import React from 'react';
import './StatsSection.css';

interface StatsSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const StatsSection: React.FC<StatsSectionProps> = ({ content, sectionId }) => {
    const title = content?.title || '';
    const stats = content?.stats || [];

    return (
        <section className="stats-section" id={sectionId || 'stats'}>
            <div className="container">
                {title && <h2 className="section-title">{title}</h2>}
                <div className="stats-grid">
                    {stats.map((stat: any, index: number) => (
                        <div key={index} className="stat-card">
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-label">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default StatsSection;
