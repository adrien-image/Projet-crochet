import { useState } from 'react'
import App from './App'
import { ConfirmProvider } from './ui/Confirm'
import { ErrorBoundary } from './ui/ErrorBoundary'
import type { Lang } from './i18n'

export default function Root() {
  // changer de langue re-rend toute l'application (les textes sont lus à chaque rendu)
  const [, setCurrent] = useState<Lang>()
  return (
    // dernier filet : une erreur imprévue affiche un message (avec « Réessayer ») au lieu d'une page blanche
    <ErrorBoundary>
      <ConfirmProvider>
        <App onLang={setCurrent} />
      </ConfirmProvider>
    </ErrorBoundary>
  )
}
