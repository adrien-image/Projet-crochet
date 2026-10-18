import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import Root from './Root'
import { detectLang, setLang } from './i18n'
import { loadSettings } from './storage/settings'

// langue : choix enregistré, sinon celle du navigateur
setLang(loadSettings().lang ?? detectLang())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

// Hors connexion : service worker uniquement en production (en dev, il masquerait les rechargements)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
