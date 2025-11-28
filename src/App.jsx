import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import DashboardApp from './Dashboard';
import HomePage from './marketing/pages/Home';
import SolutionsPage from './marketing/pages/Solutions';
import RoiPage from './marketing/pages/Roi';
import AboutPage from './marketing/pages/About';
import Navbar from './marketing/components/Navbar';
import Footer from './marketing/components/Footer';

// Scroll to top on route change
const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

// Layout wrapper for marketing pages to include Navbar and Footer
const MarketingLayout = ({ children }) => {
    return (
        <div className="font-sans antialiased text-white bg-[#030305] selection:bg-amber-500/30 selection:text-white">
            <Navbar />
            <main>{children}</main>
            <Footer />
        </div>
    );
};

import { getCalApi } from "@calcom/embed-react";

function App() {
    useEffect(() => {
        (async function () {
            const cal = await getCalApi();
            cal("ui", { "theme": "dark", "styles": { "branding": { "brandColor": "#000000" } }, "hideEventTypeDetails": false, "layout": "month_view" });
        })();
    }, []);

    return (
        <Router>
            <ScrollToTop />
            <Routes>
                {/* Marketing Routes */}
                <Route path="/" element={<MarketingLayout><HomePage /></MarketingLayout>} />
                <Route path="/solutions" element={<MarketingLayout><SolutionsPage /></MarketingLayout>} />
                <Route path="/roi" element={<MarketingLayout><RoiPage /></MarketingLayout>} />
                <Route path="/about" element={<MarketingLayout><AboutPage /></MarketingLayout>} />

                {/* Dashboard Route - No Navbar/Footer, full screen app */}
                <Route path="/dashboard" element={<DashboardApp />} />
            </Routes>
        </Router>
    );
}

export default App;
