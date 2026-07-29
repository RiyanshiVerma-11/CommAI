import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register PWA Service Worker safely
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          console.log('[PWA] New content available. Refreshing...')
        },
        onOfflineReady() {
          console.log('[PWA] CommAI App is ready to work offline.')
        },
      })
    })
    .catch((err) => {
      console.warn('[PWA] Service worker registration skipped:', err)
    })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
