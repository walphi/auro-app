import React from 'react';

interface TestimonialsSectionProps {
    content: Record<string, any>;
    config?: any;
    designSystem?: any;
    sectionId?: string;
}

const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ content, sectionId }) => {
    const title = content?.title || 'What Clients Say';
    const testimonials = content?.testimonials || [];

    return (
        <section className="testimonials-section" id={sectionId || 'testimonials'}>
            <div className="container">
                <h2 className="section-title">{title}</h2>
                <div className="testimonials-grid">
                    {testimonials.map((testimonial: any, index: number) => (
                        <div key={index} className="testimonial-card">
                            <blockquote>"{testimonial.quote}"</blockquote>
                            <div className="testimonial-author">
                                {testimonial.avatar && (
                                    <img src={testimonial.avatar} alt={testimonial.name} className="testimonial-avatar" />
                                )}
                                <div>
                                    <strong>{testimonial.name}</strong>
                                    {testimonial.title && <span>{testimonial.title}</span>}
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
