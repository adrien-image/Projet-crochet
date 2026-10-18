import { Component, type ReactNode } from 'react'
import { t } from '../i18n'

interface Props { children: ReactNode, label?: string }
interface State { error: Error | null }

/** Isole une erreur de rendu (onglet, aperçu 3D…) au lieu de faire tomber toute l'application. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="empty" role="alert">
        <div className="empty-icon" aria-hidden="true">🧶</div>
        <h3>{t('Cette partie n\'a pas pu s\'afficher')}</h3>
        <div className="empty-text">{this.props.label ?? t('Une erreur inattendue est survenue. Vos données ne sont pas touchées.')}</div>
        <button type="button" className="btn primary" onClick={() => this.setState({ error: null })}>{t('Réessayer')}</button>
      </div>
    )
  }
}
