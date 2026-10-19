import { useEffect, useRef } from 'react'

export const mediaControlsSupported = typeof navigator !== 'undefined' && 'mediaSession' in navigator

/** Dix secondes de silence (WAV 8 kHz) : les commandes multimédia n'apparaissent qu'avec un son en cours. */
function silence(): string {
  const samples = 8000 * 10
  const buffer = new ArrayBuffer(44 + samples)
  const v = new DataView(buffer)
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
  ascii(0, 'RIFF')
  v.setUint32(4, 36 + samples, true)
  ascii(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 8000, true)
  v.setUint32(28, 8000, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  ascii(36, 'data')
  v.setUint32(40, samples, true)
  new Uint8Array(buffer, 44).fill(128)
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

export interface MediaControls {
  title: string
  artist: string
  /** bouton du casque, lecture / pause */
  onPlay: () => void
  /** piste suivante */
  onNext: () => void
  /** piste précédente */
  onPrevious: () => void
}

/**
 * Le compteur comme un lecteur de musique : écran verrouillé, montre connectée et boutons du casque
 * le pilotent (lecture / pause = +1 maille, suivant = rang terminé, précédent = −1).
 */
export function useMediaControls(enabled: boolean, controls: MediaControls): boolean {
  const latest = useRef(controls)
  useEffect(() => { latest.current = controls })
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!enabled || !mediaControlsSupported) return
    const url = silence()
    const a = new Audio(url)
    a.loop = true
    audio.current = a
    a.play().catch(() => {})
    const session = navigator.mediaSession
    const keepPlaying = (action: () => void) => () => {
      action()
      // le système met la lecture en pause : elle doit continuer pour garder les commandes
      a.play().catch(() => {})
      session.playbackState = 'playing'
    }
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', keepPlaying(() => latest.current.onPlay())],
      ['pause', keepPlaying(() => latest.current.onPlay())],
      ['nexttrack', keepPlaying(() => latest.current.onNext())],
      ['previoustrack', keepPlaying(() => latest.current.onPrevious())],
    ]
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // action inconnue de ce navigateur
      }
    }
    session.playbackState = 'playing'
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null)
        } catch {
          // idem
        }
      }
      session.metadata = null
      session.playbackState = 'none'
      a.pause()
      audio.current = null
      URL.revokeObjectURL(url)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !mediaControlsSupported || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: controls.title,
      artist: controls.artist,
      album: 'Mon Crochet',
      artwork: [{ src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' }],
    })
  }, [enabled, controls.title, controls.artist])

  return enabled && mediaControlsSupported
}
