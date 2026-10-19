import { useEffect, useRef, useState } from 'react'
import { voiceCommands, type VoiceCommand } from '../domain/voice'

interface Recognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: { resultIndex: number, results: ArrayLike<{ isFinal: boolean, 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
type RecognitionClass = new () => Recognition

/** Reconnaissance vocale du navigateur (Chrome, Edge, Safari), lue au moment de l'utiliser. */
function recognitionClass(): RecognitionClass | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass, webkitSpeechRecognition?: RecognitionClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const voiceSupported = () => typeof window !== 'undefined' && !!recognitionClass()

/** Écoute les commandes vocales tant que `enabled` est vrai ; renvoie l'erreur éventuelle (micro refusé…). */
export function useVoiceCommands(enabled: boolean, lang: string, onCommand: (c: VoiceCommand) => void): { listening: boolean, error: string | null } {
  const latest = useRef(onCommand)
  useEffect(() => { latest.current = onCommand })
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const Ctor = recognitionClass()
    if (!enabled || !Ctor) return
    let stopped = false
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        for (const c of voiceCommands(e.results[i][0].transcript)) latest.current(c)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopped = true
        setError(e.error)
      }
    }
    // la reconnaissance s'arrête d'elle-même après un silence : on la relance
    rec.onend = () => {
      setListening(false)
      if (!stopped) setTimeout(() => { if (!stopped) start() }, 300)
    }
    const start = () => {
      try {
        rec.start()
        setListening(true)
        setError(null)
      } catch {
        // déjà démarrée
      }
    }
    start()
    return () => {
      stopped = true
      rec.onend = null
      rec.stop()
      setListening(false)
    }
  }, [enabled, lang])
  return { listening: enabled && listening, error: enabled ? error : null }
}
