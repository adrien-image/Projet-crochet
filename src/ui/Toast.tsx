import type { Toast } from '../hooks/useToast'

export function ToastView({ toast, onHide }: { toast: Toast | null, onHide: () => void }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.at} className={`toast ${toast.error ? 'error' : ''}`}>
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" className="toast-action" onClick={() => { toast.action?.run(); onHide() }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
