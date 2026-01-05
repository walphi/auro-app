
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AgentSite from './components/AgentSite.tsx';
import './App.css';

function App() {
  return (
    <Router basename="/sites">
      <Routes>
        <Route path="/:slug" element={<AgentSite />} />
        <Route path="/" element={<div className="home-placeholder"><h1>Auro Agent Sites</h1><p>Public site renderer</p></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
