import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { installErrorHandlers } from './lib/errorLog'
import { initTheme } from './lib/theme'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// Apply the saved light or dark mode before the first page draws, so there is no flash
initTheme()

// Must run before the app renders, so errors thrown anywhere are captured
installErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

// Lets the browser offer "Install app". Only on the live site, not during development.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}