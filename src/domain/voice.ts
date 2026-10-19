// Commandes vocales du compteur : ce que l'on dit en crochetant, en français ou en anglais.

export type VoiceCommand = 'add' | 'remove' | 'finish' | 'reset'

/** mots entiers, accents compris (\b ne connaît pas « é ») */
const words = (alternatives: string[]) => new RegExp(`(?<!\\p{L})(?:${alternatives.join('|')})(?!\\p{L})`, 'gu')

const COMMANDS: [VoiceCommand, RegExp][] = [
  // « rang terminé », « rang suivant », « next row », « row done »
  ['finish', words([String.raw`(?:rang|tour)s?\s+(?:terminée?s?|suivant|fini)`, String.raw`(?:next|done)\s+(?:row|round)`,
    String.raw`(?:row|round)\s+(?:done|finished|complete)`, 'terminé', 'suivant'])],
  ['reset', words([String.raw`(?:remettre\s+à\s+)?zéro`, 'zero', 'reset'])],
  ['remove', words([String.raw`moins(?:\s+une?)?`, 'annuler', 'retour', String.raw`minus(?:\s+one)?`, 'back', 'undo'])],
  ['add', words([String.raw`plus(?:\s+une?)?`, 'mailles?', 'stitch(?:es)?', String.raw`plus\s+one`, 'count', 'encore', 'ok'])],
]

/** Commandes reconnues dans une phrase, dans l'ordre où elles sont dites. */
export function voiceCommands(transcript: string): VoiceCommand[] {
  let text = ` ${transcript.toLowerCase()} `
  const found: { at: number, command: VoiceCommand }[] = []
  for (const [command, re] of COMMANDS) {
    text = text.replace(re, (m, ...rest) => {
      found.push({ at: rest[rest.length - 2] as number, command })
      // une commande reconnue n'en déclenche pas une autre (« rang terminé » n'ajoute pas de maille)
      return ' '.repeat(m.length)
    })
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.command)
}
