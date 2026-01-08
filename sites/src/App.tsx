
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AgentSite from './components/AgentSite.tsx';
import './App.css';

function App() {
  return (
    <Router basename="/sites">
      <Routes>
        {/* Multi-page routes - Order is important, most specific first if they overlap, but these are unique enough */}
        <Route path="/:slug/about" element={<AgentSite pageId="about" />} />
        <Route path="/:slug/listings" element={<AgentSite pageId="listings" />} />
        <Route path="/:slug/contact" element={<AgentSite pageId="contact" />} />

        {/* Home page route for the slug */}
        <Route path="/:slug" element={<AgentSite pageId="home" />} />

        {/* Fallback routes */}
        <Route path="/" element={<div className="home-placeholder"><h1>Auro Agent Sites</h1><p>Public site renderer</p></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
