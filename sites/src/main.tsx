import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import './index.css'
import App from './App.tsx'

posthog.init('phc_wuQMMjdEMy9RbS3QmQv4qwdZwKQYrfpk4wTBBdVYWzh9', {
  api_host: 'https://us.i.posthog.com',
})

console.log('[Agents SPA] Mounting application...');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
