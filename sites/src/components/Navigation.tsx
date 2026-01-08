import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { type NavItem } from '../api/agentSites';
import './Navigation.css';

interface NavigationProps {
    items: NavItem[];
    brandName?: string;
    logoUrl?: string;
}

const Navigation: React.FC<NavigationProps> = ({ items, brandName, logoUrl }) => {
    const { slug } = useParams<{ slug: string }>();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    const getFullPath = (path: string) => {
        // Ensure path starts with /
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        // Map common AI paths to our routing structure if needed, 
        // but generally /about -> /:slug/about
        if (normalizedPath === '/' || normalizedPath === '/home' || normalizedPath === '/index') {
            return `/${slug}`;
        }

        return `/${slug}${normalizedPath}`;
    };

    return (
        <nav className="site-navigation">
            <div className="nav-container">
                <div className="nav-brand">
                    <Link to={`/${slug}`} className="nav-brand-link">
                        {logoUrl ? (
                            <img src={logoUrl} alt={brandName} className="nav-logo" />
                        ) : (
                            <span className="nav-brand-text">{brandName || 'Agent Site'}</span>
                        )}
                    </Link>
                </div>

                <button
                    className="nav-toggle"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle navigation"
                >
                    <span className="nav-toggle-bar"></span>
                    <span className="nav-toggle-bar"></span>
                    <span className="nav-toggle-bar"></span>
                </button>

                <ul className={`nav-links ${mobileMenuOpen ? 'nav-links--open' : ''}`}>
                    {items.map((item, index) => (
                        <li key={index} className="nav-item">
                            {item.type === 'page' ? (
                                <Link
                                    to={getFullPath(item.path)}
                                    className="nav-link"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ) : item.type === 'button' ? (
                                <a
                                    href={item.action || '#'}
                                    className="nav-link nav-link--cta"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {item.label}
                                </a>
                            ) : (
                                <a href={item.path} className="nav-link" target="_blank" rel="noopener noreferrer">
                                    {item.label}
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
};

export default Navigation;
