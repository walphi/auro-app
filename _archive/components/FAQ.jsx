import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqData = [
    {
        question: "What exactly is AURO?",
        answer: "AURO is an AI-first qualifying agent designed specifically for Dubai's elite real estate sector. It acts as a dedicated, 24/7 intelligent layer that instantly engages, qualifies, and scores inbound leads from all channels before seamlessly handing over only the most viable prospects to your human sales team."
    },
    {
        question: "How does AURO guarantee a higher quality of leads?",
        answer: "AURO utilizes a Multi-Agent AI Architecture that performs deep financial, interest, and timeline qualification. It handles all initial objections and repetitive queries, ensuring your human agents only speak to prospects who are genuinely ready to discuss a purchase, leading to a significant increase in sales readiness."
    },
    {
        question: "How is AURO different from a standard chatbot?",
        answer: "Standard chatbots provide fixed, script-based answers. AURO’s agents are Context-Aware and utilize Retrieval-Augmented Generation (RAG) to understand and recall your entire portfolio, engaging in complex, personalized, and persistent qualification conversations until a lead is fully scored or disqualified."
    },
    {
        question: "Which channels does AURO integrate with?",
        answer: "AURO seamlessly integrates with all key lead generation channels, including your website, landing pages, and, critically for the Dubai market, it is optimized to handle the chaotic flood of WhatsApp leads, bringing order to the inflow."
    },
    {
        question: "How secure is our confidential lead and project data?",
        answer: "Security is paramount. AURO is built with Enterprise-Grade Security, featuring end-to-end encryption for all conversations and data. We ensure full compliance with UAE data privacy laws and international standards like GDPR."
    },
    {
        question: "How long does it take to implement AURO?",
        answer: "AURO is designed as a \"Plug & Play\" system. Implementation time is significantly accelerated, as we configure your dedicated, branded multi-agent CRM on a private subdomain and perform the crucial custom AI training using your project knowledge."
    },
    {
        question: "Does AURO replace our existing CRM?",
        answer: "No. AURO is designed to enhance your existing technology stack. It integrates directly with all major CRMs (e.g., Salesforce, HubSpot, Zoho), ensuring a seamless handover of fully qualified and scored leads into your existing pipeline for your sales team to manage."
    },
    {
        question: "How often is the AI updated and maintained?",
        answer: "AURO's performance is managed via a continuous monthly retainer. This covers all system maintenance, performance monitoring, infrastructure costs, and, crucially, continuous AI updates and retraining to maintain maximum efficiency and adapt to market shifts."
    },
    {
        question: "What is the investment required to get started?",
        answer: "Our partnership begins with a one-time setup fee. This investment covers the proprietary AI training, customization of your multi-agent architecture, data migration, and full integration into your existing systems, ensuring immediate readiness."
    },
    {
        question: "How is the ongoing service priced?",
        answer: "Following the initial setup, the service is managed through a predictable monthly retainer. This fee covers all ongoing operational costs, dedicated support, platform updates, and access to your private, multi-agent CRM environment on a dedicated subdomain."
    },
    {
        question: "How quickly will we see an ROI?",
        answer: "Clients typically report rapid returns due to a dramatic increase in sales team efficiency and a significant reduction in the time wasted on pre-qualification. AURO is structured as a value-add platform designed to pay for itself by maximizing the conversion rate of your existing marketing spend."
    }
];

const FAQ = () => {
    const [openIndex, setOpenIndex] = useState(null);

    const toggleAccordion = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="py-20 px-6 relative z-10">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-5xl font-bold mb-6">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">Frequently Asked Questions</span>
                    </h2>
                    <p className="text-slate-400 text-lg">
                        Everything you need to know about the AURO platform.
                    </p>
                </div>

                <div className="space-y-4">
                    {faqData.map((item, index) => (
                        <div
                            key={index}
                            className={`group rounded-2xl border transition-all duration-300 ${openIndex === index
                                ? 'bg-white/10 border-amber-500/30 shadow-lg shadow-amber-900/10'
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                }`}
                        >
                            <button
                                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                                onClick={() => toggleAccordion(index)}
                            >
                                <span className={`text-lg font-medium transition-colors ${openIndex === index ? 'text-amber-100' : 'text-slate-200 group-hover:text-white'
                                    }`}>
                                    {item.question}
                                </span>
                                <div className={`p-2 rounded-full transition-all duration-300 ${openIndex === index ? 'bg-amber-500/20 text-amber-400 rotate-180' : 'bg-white/5 text-slate-400 group-hover:text-white'
                                    }`}>
                                    <ChevronDown size={20} />
                                </div>
                            </button>

                            <div
                                className={`grid transition-all duration-300 ease-in-out ${openIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                    }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="px-6 pb-6 pt-0 text-slate-400 leading-relaxed">
                                        {item.answer}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FAQ;
