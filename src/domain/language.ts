// Langue d'un patron, d'après son vocabulaire de crochet (pour choisir la langue de l'OCR).

export type PatternLanguage = 'fra' | 'eng' | 'spa' | 'deu' | 'ita' | 'por' | 'nld'

/** mots et abréviations propres à chaque langue (les mots communs à plusieurs langues n'y sont pas) */
const WORDS: Record<PatternLanguage, RegExp> = {
  fra: /\b(?:rangs?|tours?|ms|ml|mc|aug|mailles?|anneau|magique|crochet|fil|rembourrer|couper)\b/gi,
  eng: /\b(?:rnds?|rounds?|rows?|sc|hdc|inc|dec|stitch(?:es)?|magic|ring|yarn|stuff|fasten|off|each)\b/gi,
  spa: /\b(?:vueltas?|vtas?|hileras?|pb|pa|mpa|aum|dism|puntos?|anillo|cadenetas?|hilo|rellenar|cada)\b/gi,
  deu: /\b(?:runden?|reihen?|fm|stb|hstb|km|lm|zun|abn|maschen?|fadenring|luftmaschen?|garn|füllen|jede)\b/gi,
  ita: /\b(?:giri|giro|mb|ma|mma|maglie|maglia|anello|catenella|filo|imbottire|ogni|volte)\b/gi,
  por: /\b(?:carreiras?|voltas?|pbx|corr|pontos?|anel|correntinhas?|linha|encher|cada|vezes)\b/gi,
  nld: /\b(?:toeren?|vaste|stk|hv|losse|meerd|mind|steken|magische|garen|vullen|elke|keer)\b/gi,
}

/** Langue la plus probable, ou null si le texte est trop court ou sans vocabulaire de crochet. */
export function patternLanguage(text: string): PatternLanguage | null {
  let best: PatternLanguage | null = null
  let score = 0
  for (const lang of Object.keys(WORDS) as PatternLanguage[]) {
    const n = text.match(WORDS[lang])?.length ?? 0
    if (n > score) {
      best = lang
      score = n
    }
  }
  return score >= 4 ? best : null
}
