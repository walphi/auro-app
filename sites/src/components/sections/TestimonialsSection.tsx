import React from 'react';
import './TestimonialsSection.css';

interface TestimonialsSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ content, sectionId }) => {
    const title = content?.title || 'Client Experiences';
    const testimonials = content?.testimonials || content?.items || [];

    return (
        <section className="testimonials-section" id={sectionId || 'testimonials'}>
            <div className="container">
                <div className="section-header fade-in-up">
                    <span className="subtitle">Testimonials</span>
                    <h2 className="section-title">{title}</h2>
                    <div className="divider"></div>
                </div>

                <div className="testimonials-grid">
                    {testimonials.map((t: any, index: number) => (
                        <div key={index} className="testimonial-card fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                            <div className="quote-icon">“</div>
                            <p className="testimonial-quote">{t.quote || t.text}</p>
                            <div className="testimonial-author">
                                <div className="author-info">
                                    <h4>{t.name || 'Anonymous Client'}</h4>
                                    {t.role && <span>{t.role}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default TestimonialsSection;
