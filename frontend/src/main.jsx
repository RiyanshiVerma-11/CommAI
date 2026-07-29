import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA Service Worker for offline caching and auto-updates
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[PWA] New content available. Refreshing...')
  },
  onOfflineReady() {
    console.log('[PWA] CommAI App is ready to work offline.')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
