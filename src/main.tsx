/**
 * main.tsx
 * React 18 entry point. Registers the PWA service worker.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Register Vite PWA service worker (generated at build time)
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onNeedRefresh() {
    // Could show a toast: "New version available — tap to update"
    console.info('[PWA] New content available, refresh to update.')
  },
  onOfflineReady() {
    console.info('[PWA] App ready for offline use.')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
