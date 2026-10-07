import React from 'react'
import ReactDOM from 'react-dom/client'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import App from './App.jsx'
import './index.css'

posthog.init('phc_wuQMMjdEMy9RbS3QmQv4qwdZwKQYrfpk4wTBBdVYWzh9', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-05-30',
})

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PostHogProvider client={posthog}>
            <App />
        </PostHogProvider>
    </React.StrictMode>,
)
