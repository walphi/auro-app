import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import posthog from 'posthog-js';
import {PostHogProvider} from '@posthog/react';
import {SiteApp} from './SiteApp.tsx';
import './index.css';

posthog.init('phc_wuQMMjdEMy9RbS3QmQv4qwdZwKQYrfpk4wTBBdVYWzh9', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-05-30',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <SiteApp />
    </PostHogProvider>
  </StrictMode>,
);
