import React from 'react';
import './AboutSection.css';

interface AboutSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const AboutSection: React.FC<AboutSectionProps> = ({ content, config, sectionId }) => {
    const title = content?.title || 'About Me';
    const text = content?.text || content?.bio || config?.bio || '';
    const imageUrl = content?.imageUrl || config?.profilePhotoUrl;

    return (
        <section className="about-section" id={sectionId || 'about'}>
            <div className="about-container">
                <div className="about-content">
                    <h2 className="about-title">{title}</h2>
                    <div className="about-text">
                        {text.split('\n').map((paragraph: string, index: number) => (
                            <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                </div>
                {imageUrl && (
                    <div className="about-image-wrapper">
                        <img src={imageUrl} alt="About" className="about-image" />
                    </div>
                )}
            </div>
        </section>
    );
};

export default AboutSection;
