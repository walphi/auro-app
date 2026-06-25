import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardApp from './Dashboard';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/dashboard" element={<DashboardApp />} />
            </Routes>
        </Router>
    );
}

export default App;
