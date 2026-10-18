import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import { ConfirmContext as Ctx, type ConfirmFn, type ConfirmRequest as Request } from './confirmContext'

/** Remplace window.confirm() par une boîte de dialogue de l'application. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})
  const ask = useCallback<ConfirmFn>((r) => new Promise((resolve) => {
    resolver.current = resolve
    setReq(r)
  }), [])
  const done = (v: boolean) => {
    resolver.current(v)
    setReq(null)
  }
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Dialog open={!!req} title={req?.title ?? ''} size="sm" onClose={() => done(false)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => done(false)}>Annuler</button>
            <button type="button" className={`btn ${req?.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => done(true)}>
              {req?.confirm ?? 'Confirmer'}
            </button>
          </>
        )}>
        {req?.message && <p className="muted">{req.message}</p>}
      </Dialog>
    </Ctx.Provider>
  )
}
