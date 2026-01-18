export interface ProfanityCheckResult {
  isClean: boolean;
  foundWords: string[];
  sanitizedText?: string;
}

export class ProfanityFilter {
  private static readonly BANNED_WORDS = [
    // Español
    'puta',
    'puto',
    'cabrón',
    'cabron',
    'gilipollas',
    'idiota',
    'imbécil',
    'imbecil',
    'mierda',
    'joder',
    'coño',
    'cono',
    'hostia',
    'tonto',
    'estúpido',
    'estupido',
    'pendejo',
    'hijo de puta',
    'hijoputa',
    'maricón',
    'maricon',
    'perra',
    'zorra',
    'maldito',
    'carajo',
    'chingada',
    'chingar',
    'verga',
    'pinche',
    'culero',

    // Inglés
    'fuck',
    'shit',
    'bitch',
    'asshole',
    'bastard',
    'damn',
    'crap',
    'dick',
    'cock',
    'pussy',
    'ass',
    'motherfucker',
    'fag',
    'retard',
    'slut',
    'whore',
    'nigger',
    'nigga',
    'cunt',
    'twat',
    'prick',
    'wanker',
    'bollocks',

    // Catalán
    'merda',
    'cony',
    'fill de puta',
    'gilipolles',
    'imbècil',
    'maricó',
    'puta',
    'puto',
    'cabrón',
    'hostia',
    'collons',

    // Francés
    'merde',
    'putain',
    'connard',
    'salope',
    'con',
    'enculé',
    'enfoiré',
    'chier',
    'bite',
    'couille',
    'fils de pute',
    'bâtard',
    'batard',

    // Variaciones con números y símbolos
    'p*ta',
    'p0rn',
    'p0rno',
    's3x',
    'f*ck',
    'sh*t',
    'a$$',
    'b*tch',

    // Palabras ofensivas adicionales
    'nazi',
    'hitler',
    'racista',
    'facha',
    'terrorista',
    'violador',
    'asesino',
    'matar',
    'suicidio',
    'drogas',
    'cocaína',
    'cocaina',
  ];

  private static readonly WHITELIST = [
    'suspenso',
    'suspender',
    'asunto',
    'casual',
    'clase',
    'clásico',
    'clasico',
    'análisis',
    'analisis',
    'bassist',
    'assistant',
    'passion',
    'compassion',
  ];

  static check(text: string): ProfanityCheckResult {
    if (!text || typeof text !== 'string') {
      return { isClean: true, foundWords: [] };
    }

    const normalizedText = this.normalize(text);
    const foundWords: string[] = [];

    const isWhitelisted = this.WHITELIST.some((word) =>
      normalizedText.toLowerCase().includes(word.toLowerCase()),
    );

    if (isWhitelisted) {
      return { isClean: true, foundWords: [] };
    }

    for (const bannedWord of this.BANNED_WORDS) {
      const pattern = new RegExp(`\\b${this.escapeRegex(bannedWord)}\\b`, 'gi');
      if (pattern.test(normalizedText)) {
        foundWords.push(bannedWord);
      }
    }

    return {
      isClean: foundWords.length === 0,
      foundWords: foundWords,
      sanitizedText: this.sanitize(text),
    };
  }

  private static normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/ç/g, 'c')
      .replace(/[0]/g, 'o')
      .replace(/[1]/g, 'i')
      .replace(/[3]/g, 'e')
      .replace(/[4]/g, 'a')
      .replace(/[5]/g, 's')
      .replace(/[7]/g, 't')
      .replace(/[8]/g, 'b')
      .replace(/[@]/g, 'a')
      .replace(/[$]/g, 's')
      .replace(/[*]/g, '')
      .replace(/[_]/g, ' ')
      .replace(/[-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static sanitize(text: string): string {
    let sanitized = text;

    for (const bannedWord of this.BANNED_WORDS) {
      const pattern = new RegExp(`\\b${this.escapeRegex(bannedWord)}\\b`, 'gi');
      sanitized = sanitized.replace(pattern, '***');
    }

    return sanitized;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static checkObject(
    obj: Record<string, any>,
    fields: string[],
  ): ProfanityCheckResult {
    const allFoundWords: string[] = [];

    for (const field of fields) {
      if (obj[field]) {
        const result = this.check(String(obj[field]));
        if (!result.isClean) {
          allFoundWords.push(...result.foundWords);
        }
      }
    }

    return {
      isClean: allFoundWords.length === 0,
      foundWords: [...new Set(allFoundWords)],
    };
  }

  static getErrorMessage(
    foundWords: string[],
    lang: 'es' | 'en' | 'cat' | 'fr' = 'es',
  ): string {
    const messages = {
      es: `Tu mensaje contiene lenguaje inapropiado. Por favor, revisa el contenido y vuelve a intentarlo.`,
      en: `Your message contains inappropriate language. Please review the content and try again.`,
      cat: `El teu missatge conté llenguatge inadequat. Si us plau, revisa el contingut i torna-ho a intentar.`,
      fr: `Votre message contient un langage inapproprié. Veuillez revoir le contenu et réessayer.`,
    };

    return messages[lang] || messages.es;
  }
}
