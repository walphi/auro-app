import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';

const WaitlistForm = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        businessType: '',
        otherBusinessType: '',
        isDldRegistered: '',
        leadVolume: '',
        coordinationChallenges: [],
        coordinationChallenges: [],
        crmSystem: '',
        otherCrmSystem: '',
        brokerCount: '',
        urgency: '',
        name: '',
        companyName: '',
        email: '',
        phone: ''
    });

    const totalSteps = 4;

    if (!isOpen) return null;

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCheckboxChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].includes(value)
                ? prev[field].filter(item => item !== value)
                : [...prev[field], value]
        }));
    };

    const handleNext = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Here you would send the data to your backend
        console.log('Form submitted:', formData);
        alert('Thank you! We will be in touch soon.');
        onClose();
    };

    const isStepValid = () => {
        switch (currentStep) {
            case 1:
                return formData.businessType && formData.isDldRegistered;
            case 2:
                return formData.leadVolume && formData.coordinationChallenges.length > 0;
            case 3:
                return formData.crmSystem && formData.brokerCount;
            case 4:
                return formData.urgency && formData.name && formData.companyName && formData.email && formData.phone;
            default:
                return false;
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-[#00000078] border border-white/10 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto backdrop-blur-md">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#00000078] backdrop-blur-md border-b border-white/10 p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Request Early Access</h2>
                        <p className="text-sm text-slate-400 mt-1">Step {currentStep} of {totalSteps}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 pt-4">
                    <div className="w-full bg-white/10 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-amber-500 to-yellow-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Form Content */}
                <div className="p-6">
                    {/* Step 1: Identity & Intent */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Establish Your Identity</h3>
                                <p className="text-slate-400 text-sm">Help us understand your organization</p>
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-3">
                                    What best describes your organization and your role?
                                </label>
                                <div className="space-y-2">
                                    {['Real Estate Developer', 'Real Estate Agency', 'Brokerage Firm', 'Other'].map((option) => (
                                        <label key={option} className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:border-amber-500/50 cursor-pointer transition-colors bg-white/5">
                                            <input
                                                type="radio"
                                                name="businessType"
                                                value={option}
                                                checked={formData.businessType === option}
                                                onChange={(e) => handleInputChange('businessType', e.target.value)}
                                                className="w-4 h-4 text-amber-500 accent-amber-500"
                                            />
                                            <span className="text-slate-200">{option}</span>
                                        </label>
                                    ))}
                                </div>
                                {formData.businessType === 'Other' && (
                                    <input
                                        type="text"
                                        placeholder="Please specify..."
                                        value={formData.otherBusinessType}
                                        onChange={(e) => handleInputChange('otherBusinessType', e.target.value)}
                                        className="mt-3 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-3">
                                    Are you a DLD/RERA-registered developer or agency in the UAE?
                                </label>
                                <div className="flex gap-4">
                                    {['Yes', 'No'].map((option) => (
                                        <label key={option} className="flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border border-white/10 hover:border-amber-500/50 cursor-pointer transition-colors bg-white/5">
                                            <input
                                                type="radio"
                                                name="isDldRegistered"
                                                value={option}
                                                checked={formData.isDldRegistered === option}
                                                onChange={(e) => handleInputChange('isDldRegistered', e.target.value)}
                                                className="w-4 h-4 text-amber-500 accent-amber-500"
                                            />
                                            <span className="text-slate-200 font-medium">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Quantify Pain Point */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Quantify Your Challenge</h3>
                                <p className="text-slate-400 text-sm">Understanding your current lead volume and pain points</p>
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-3">
                                    Approximately how many new leads (inquiries) do you receive per month?
                                </label>
                                <div className="space-y-2">
                                    {['Under 1,000', '1,000–5,000', '5,000–10,000', '10,000+'].map((option) => (
                                        <label key={option} className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:border-amber-500/50 cursor-pointer transition-colors bg-white/5">
                                            <input
                                                type="radio"
                                                name="leadVolume"
                                                value={option}
                                                checked={formData.leadVolume === option}
                                                onChange={(e) => handleInputChange('leadVolume', e.target.value)}
                                                className="w-4 h-4 text-amber-500 accent-amber-500"
                                            />
                                            <span className="text-slate-200">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-3">
                                    What is the biggest challenge in moving a lead from WhatsApp to a confirmed Sales Center appointment? (Select all that apply)
                                </label>
                                <div className="space-y-2">
                                    {[
                                        'Slow response time',
                                        'Broker scheduling conflicts',
                                        'Lack of lead qualification',
                                        'Manual CRM data entry',
                                        'Other'
                                    ].map((option) => (
                                        <label key={option} className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:border-amber-500/50 cursor-pointer transition-colors bg-white/5">
                                            <input
                                                type="checkbox"
                                                value={option}
                                                checked={formData.coordinationChallenges.includes(option)}
                                                onChange={() => handleCheckboxChange('coordinationChallenges', option)}
                                                className="w-4 h-4 text-amber-500 accent-amber-500 rounded"
                                            />
                                            <span className="text-slate-200">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Technical Fit */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Assess Technical Fit</h3>
                                <p className="text-slate-400 text-sm">Understanding your current infrastructure</p>
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-3">
                                    Which CRM or ERP system does your sales team currently use?
                                </label>
                                <select
                                    value={formData.crmSystem}
                                    onChange={(e) => handleInputChange('crmSystem', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-amber-500 focus:outline-none"
                                >
                                    <option value="" className="bg-[#030305] text-white">Select your CRM...</option>
                                    <option value="Salesforce" className="bg-[#030305] text-white">Salesforce</option>
                                    <option value="HubSpot" className="bg-[#030305] text-white">HubSpot</option>
                                    <option value="Zoho" className="bg-[#030305] text-white">Zoho</option>
                                    <option value="Proprietary System" className="bg-[#030305] text-white">Proprietary System</option>
                                    <option value="Other" className="bg-[#030305] text-white">Other</option>
                                </select>
                                {formData.crmSystem === 'Other' && (
                                    <input
                                        type="text"
                                        placeholder="Please specify your CRM..."
                                        value={formData.otherCrmSystem}
                                        onChange={(e) => handleInputChange('otherCrmSystem', e.target.value)}
                                        className="mt-3 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none animate-fade-in-up"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-3">
                                    How many brokers/sales agents would AURO need to manage calendars for?
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Number of brokers..."
                                    value={formData.brokerCount}
                                    onChange={(e) => handleInputChange('brokerCount', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Final Commitment */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Final Details</h3>
                                <p className="text-slate-400 text-sm">We're almost done! Just a few more details</p>
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-3">
                                    What is your target deployment timeline for a solution like AURO?
                                </label>
                                <div className="space-y-2">
                                    {[
                                        'Within 1-3 Months (High Priority)',
                                        '3-6 Months',
                                        '6+ Months (Information Gathering)'
                                    ].map((option) => (
                                        <label key={option} className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:border-amber-500/50 cursor-pointer transition-colors bg-white/5">
                                            <input
                                                type="radio"
                                                name="urgency"
                                                value={option}
                                                checked={formData.urgency === option}
                                                onChange={(e) => handleInputChange('urgency', e.target.value)}
                                                className="w-4 h-4 text-amber-500 accent-amber-500"
                                            />
                                            <span className="text-slate-200">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-white font-medium mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        placeholder="John Smith"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white font-medium mb-2">Company Name *</label>
                                    <input
                                        type="text"
                                        placeholder="Acme Developers"
                                        value={formData.companyName}
                                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-2">Work Email *</label>
                                <input
                                    type="email"
                                    placeholder="john@company.com"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-white font-medium mb-2">Direct Phone Number (WhatsApp preferred) *</label>
                                <input
                                    type="tel"
                                    placeholder="+971 50 123 4567"
                                    value={formData.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="sticky bottom-0 z-10 bg-[#00000078] backdrop-blur-md border-t border-white/10 p-6 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStep === 1}
                        className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={20} />
                        Back
                    </button>

                    {currentStep < totalSteps ? (
                        <button
                            onClick={handleNext}
                            disabled={!isStepValid()}
                            className="flex items-center gap-2 px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-full font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                            <ChevronRight size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!isStepValid()}
                            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-full font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/30"
                        >
                            <CheckCircle2 size={20} />
                            Submit Request
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WaitlistForm;
