import { createContext, useContext } from 'react'

export interface ConfirmRequest {
  title: string
  message?: string
  confirm?: string
  danger?: boolean
}

export type ConfirmFn = (r: ConfirmRequest) => Promise<boolean>
export const ConfirmContext = createContext<ConfirmFn>(async () => false)

/** Demande une confirmation dans une boîte de dialogue de l'application (remplace window.confirm). */
export const useConfirm = () => useContext(ConfirmContext)
