/**
 * Multi-Language AI Service
 * 
 * Provides translation and localization for AI responses.
 * Features:
 * - Automatic language detection
 * - Response translation
 * - Localized prompts
 * - Cultural context awareness
 */

import OpenAI from 'openai';

// Types
export type SupportedLanguage = 
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' 
  | 'ja' | 'ko' | 'zh' | 'ar' | 'hi' | 'ru' | 'pl';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
    currency: string;
  };
}

export interface TranslationOptions {
  preserveFormatting?: boolean;
  formalTone?: boolean;
  legalContext?: boolean;
  targetAudience?: 'technical' | 'business' | 'general';
}

// Language configurations
export const LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: { decimal: '.', thousands: ',', currency: '$' },
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: '€' },
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousands: ' ', currency: '€' },
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: '€' },
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: '€' },
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: 'R$' },
  },
  nl: {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    direction: 'ltr',
    dateFormat: 'DD-MM-YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: '€' },
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    dateFormat: 'YYYY/MM/DD',
    numberFormat: { decimal: '.', thousands: ',', currency: '¥' },
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    dateFormat: 'YYYY.MM.DD',
    numberFormat: { decimal: '.', thousands: ',', currency: '₩' },
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: { decimal: '.', thousands: ',', currency: '¥' },
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: '٫', thousands: '٬', currency: 'ر.س' },
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: '.', thousands: ',', currency: '₹' },
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: ' ', currency: '₽' },
  },
  pl: {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: ' ', currency: 'zł' },
  },
};

// Localized system prompts
const SYSTEM_PROMPTS: Record<SupportedLanguage, string> = {
  en: 'You are a helpful contract analysis assistant. Provide clear, professional responses.',
  es: 'Eres un asistente útil de análisis de contratos. Proporciona respuestas claras y profesionales.',
  fr: 'Vous êtes un assistant d\'analyse de contrats utile. Fournissez des réponses claires et professionnelles.',
  de: 'Sie sind ein hilfreicher Vertragsanalyse-Assistent. Geben Sie klare, professionelle Antworten.',
  it: 'Sei un utile assistente per l\'analisi dei contratti. Fornisci risposte chiare e professionali.',
  pt: 'Você é um assistente útil de análise de contratos. Forneça respostas claras e profissionais.',
  nl: 'U bent een behulpzame contractanalyse-assistent. Geef duidelijke, professionele antwoorden.',
  ja: 'あなたは契約分析の有能なアシスタントです。明確でプロフェッショナルな回答を提供してください。',
  ko: '당신은 유용한 계약 분석 어시스턴트입니다. 명확하고 전문적인 답변을 제공하세요.',
  zh: '您是一位乐于助人的合同分析助手。请提供清晰、专业的回复。',
  ar: 'أنت مساعد مفيد لتحليل العقود. قدم ردودًا واضحة ومهنية.',
  hi: 'आप एक सहायक अनुबंध विश्लेषण सहायक हैं। स्पष्ट, पेशेवर प्रतिक्रियाएं प्रदान करें।',
  ru: 'Вы полезный помощник по анализу контрактов. Предоставляйте четкие, профессиональные ответы.',
  pl: 'Jesteś pomocnym asystentem analizy umów. Udzielaj jasnych, profesjonalnych odpowiedzi.',
};

// Common phrases for UI
export const UI_TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    analyzing: 'Analyzing contract...',
    error: 'An error occurred',
    tryAgain: 'Try again',
    send: 'Send',
    clear: 'Clear',
    copy: 'Copy',
    download: 'Download',
    loading: 'Loading...',
    noResults: 'No results found',
    risks: 'Risks',
    obligations: 'Obligations',
    keyTerms: 'Key Terms',
    summary: 'Summary',
    recommendations: 'Recommendations',
  },
  es: {
    analyzing: 'Analizando contrato...',
    error: 'Ocurrió un error',
    tryAgain: 'Intentar de nuevo',
    send: 'Enviar',
    clear: 'Limpiar',
    copy: 'Copiar',
    download: 'Descargar',
    loading: 'Cargando...',
    noResults: 'No se encontraron resultados',
    risks: 'Riesgos',
    obligations: 'Obligaciones',
    keyTerms: 'Términos Clave',
    summary: 'Resumen',
    recommendations: 'Recomendaciones',
  },
  fr: {
    analyzing: 'Analyse du contrat...',
    error: 'Une erreur s\'est produite',
    tryAgain: 'Réessayer',
    send: 'Envoyer',
    clear: 'Effacer',
    copy: 'Copier',
    download: 'Télécharger',
    loading: 'Chargement...',
    noResults: 'Aucun résultat trouvé',
    risks: 'Risques',
    obligations: 'Obligations',
    keyTerms: 'Termes Clés',
    summary: 'Résumé',
    recommendations: 'Recommandations',
  },
  de: {
    analyzing: 'Vertrag wird analysiert...',
    error: 'Ein Fehler ist aufgetreten',
    tryAgain: 'Erneut versuchen',
    send: 'Senden',
    clear: 'Löschen',
    copy: 'Kopieren',
    download: 'Herunterladen',
    loading: 'Laden...',
    noResults: 'Keine Ergebnisse gefunden',
    risks: 'Risiken',
    obligations: 'Verpflichtungen',
    keyTerms: 'Schlüsselbegriffe',
    summary: 'Zusammenfassung',
    recommendations: 'Empfehlungen',
  },
  it: {
    analyzing: 'Analisi del contratto...',
    error: 'Si è verificato un errore',
    tryAgain: 'Riprova',
    send: 'Invia',
    clear: 'Cancella',
    copy: 'Copia',
    download: 'Scarica',
    loading: 'Caricamento...',
    noResults: 'Nessun risultato trovato',
    risks: 'Rischi',
    obligations: 'Obblighi',
    keyTerms: 'Termini Chiave',
    summary: 'Riepilogo',
    recommendations: 'Raccomandazioni',
  },
  pt: {
    analyzing: 'Analisando contrato...',
    error: 'Ocorreu um erro',
    tryAgain: 'Tentar novamente',
    send: 'Enviar',
    clear: 'Limpar',
    copy: 'Copiar',
    download: 'Baixar',
    loading: 'Carregando...',
    noResults: 'Nenhum resultado encontrado',
    risks: 'Riscos',
    obligations: 'Obrigações',
    keyTerms: 'Termos Chave',
    summary: 'Resumo',
    recommendations: 'Recomendações',
  },
  nl: {
    analyzing: 'Contract analyseren...',
    error: 'Er is een fout opgetreden',
    tryAgain: 'Opnieuw proberen',
    send: 'Verzenden',
    clear: 'Wissen',
    copy: 'Kopiëren',
    download: 'Downloaden',
    loading: 'Laden...',
    noResults: 'Geen resultaten gevonden',
    risks: 'Risico\'s',
    obligations: 'Verplichtingen',
    keyTerms: 'Belangrijke Termen',
    summary: 'Samenvatting',
    recommendations: 'Aanbevelingen',
  },
  ja: {
    analyzing: '契約を分析中...',
    error: 'エラーが発生しました',
    tryAgain: '再試行',
    send: '送信',
    clear: 'クリア',
    copy: 'コピー',
    download: 'ダウンロード',
    loading: '読み込み中...',
    noResults: '結果が見つかりません',
    risks: 'リスク',
    obligations: '義務',
    keyTerms: '重要用語',
    summary: '概要',
    recommendations: '推奨事項',
  },
  ko: {
    analyzing: '계약 분석 중...',
    error: '오류가 발생했습니다',
    tryAgain: '다시 시도',
    send: '보내기',
    clear: '지우기',
    copy: '복사',
    download: '다운로드',
    loading: '로딩 중...',
    noResults: '결과를 찾을 수 없습니다',
    risks: '위험',
    obligations: '의무',
    keyTerms: '핵심 용어',
    summary: '요약',
    recommendations: '권장 사항',
  },
  zh: {
    analyzing: '正在分析合同...',
    error: '发生错误',
    tryAgain: '重试',
    send: '发送',
    clear: '清除',
    copy: '复制',
    download: '下载',
    loading: '加载中...',
    noResults: '未找到结果',
    risks: '风险',
    obligations: '义务',
    keyTerms: '关键术语',
    summary: '摘要',
    recommendations: '建议',
  },
  ar: {
    analyzing: 'جاري تحليل العقد...',
    error: 'حدث خطأ',
    tryAgain: 'حاول مرة أخرى',
    send: 'إرسال',
    clear: 'مسح',
    copy: 'نسخ',
    download: 'تحميل',
    loading: 'جاري التحميل...',
    noResults: 'لم يتم العثور على نتائج',
    risks: 'المخاطر',
    obligations: 'الالتزامات',
    keyTerms: 'الشروط الرئيسية',
    summary: 'ملخص',
    recommendations: 'التوصيات',
  },
  hi: {
    analyzing: 'अनुबंध का विश्लेषण किया जा रहा है...',
    error: 'एक त्रुटि हुई',
    tryAgain: 'पुनः प्रयास करें',
    send: 'भेजें',
    clear: 'साफ़ करें',
    copy: 'कॉपी करें',
    download: 'डाउनलोड करें',
    loading: 'लोड हो रहा है...',
    noResults: 'कोई परिणाम नहीं मिला',
    risks: 'जोखिम',
    obligations: 'दायित्व',
    keyTerms: 'मुख्य शर्तें',
    summary: 'सारांश',
    recommendations: 'सिफारिशें',
  },
  ru: {
    analyzing: 'Анализ контракта...',
    error: 'Произошла ошибка',
    tryAgain: 'Попробовать снова',
    send: 'Отправить',
    clear: 'Очистить',
    copy: 'Копировать',
    download: 'Скачать',
    loading: 'Загрузка...',
    noResults: 'Результаты не найдены',
    risks: 'Риски',
    obligations: 'Обязательства',
    keyTerms: 'Ключевые Термины',
    summary: 'Резюме',
    recommendations: 'Рекомендации',
  },
  pl: {
    analyzing: 'Analizowanie umowy...',
    error: 'Wystąpił błąd',
    tryAgain: 'Spróbuj ponownie',
    send: 'Wyślij',
    clear: 'Wyczyść',
    copy: 'Kopiuj',
    download: 'Pobierz',
    loading: 'Ładowanie...',
    noResults: 'Nie znaleziono wyników',
    risks: 'Ryzyka',
    obligations: 'Zobowiązania',
    keyTerms: 'Kluczowe Terminy',
    summary: 'Podsumowanie',
    recommendations: 'Zalecenia',
  },
};

class MultiLanguageAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Detect the language of input text
   */
  async detectLanguage(text: string): Promise<SupportedLanguage> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Detect the language of the following text. Respond with only the ISO 639-1 two-letter language code (e.g., "en", "es", "fr").',
          },
          { role: 'user', content: text.substring(0, 500) },
        ],
        max_tokens: 5,
        temperature: 0,
      });

      const detected = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      if (detected && detected in LANGUAGES) {
        return detected as SupportedLanguage;
      }

      return 'en'; // Default to English
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en';
    }
  }

  /**
   * Translate text to target language
   */
  async translate(
    text: string,
    targetLanguage: SupportedLanguage,
    options: TranslationOptions = {}
  ): Promise<string> {
    const { preserveFormatting = true, formalTone = true, legalContext = true } = options;

    const languageConfig = LANGUAGES[targetLanguage];
    
    let systemPrompt = `Translate the following text to ${languageConfig.name}.`;
    
    if (preserveFormatting) {
      systemPrompt += ' Preserve all formatting, bullet points, and structure.';
    }
    if (formalTone) {
      systemPrompt += ' Use formal, professional language.';
    }
    if (legalContext) {
      systemPrompt += ' This is legal/contract content - use appropriate legal terminology.';
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || text;
    } catch (error) {
      console.error('Translation failed:', error);
      return text; // Return original on failure
    }
  }

  /**
   * Generate AI response in specified language
   */
  async generateResponse(
    prompt: string,
    language: SupportedLanguage,
    context?: string
  ): Promise<string> {
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
    const languageConfig = LANGUAGES[language];

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${systemPrompt} Always respond in ${languageConfig.name}. ${
          languageConfig.direction === 'rtl' ? 'Format text for right-to-left reading.' : ''
        }`,
      },
    ];

    if (context) {
      messages.push({
        role: 'user',
        content: `Context:\n${context}`,
      });
    }

    messages.push({ role: 'user', content: prompt });

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Response generation failed:', error);
      throw error;
    }
  }

  /**
   * Get localized system prompt
   */
  getSystemPrompt(language: SupportedLanguage): string {
    return SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
  }

  /**
   * Get UI translation
   */
  getUIText(language: SupportedLanguage, key: string): string {
    return UI_TRANSLATIONS[language]?.[key] || UI_TRANSLATIONS.en[key] || key;
  }

  /**
   * Get language configuration
   */
  getLanguageConfig(language: SupportedLanguage): LanguageConfig {
    return LANGUAGES[language] || LANGUAGES.en;
  }

  /**
   * Format number for locale
   */
  formatNumber(value: number, language: SupportedLanguage): string {
    const _config = LANGUAGES[language];
    return new Intl.NumberFormat(language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Format date for locale
   */
  formatDate(date: Date, language: SupportedLanguage): string {
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  /**
   * Format currency for locale
   */
  formatCurrency(value: number, language: SupportedLanguage, currency?: string): string {
    const _config = LANGUAGES[language];
    const currencyCode = currency || this.getCurrencyCode(language);
    
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  }

  /**
   * Get default currency code for language
   */
  private getCurrencyCode(language: SupportedLanguage): string {
    const currencyMap: Record<SupportedLanguage, string> = {
      en: 'USD',
      es: 'EUR',
      fr: 'EUR',
      de: 'EUR',
      it: 'EUR',
      pt: 'BRL',
      nl: 'EUR',
      ja: 'JPY',
      ko: 'KRW',
      zh: 'CNY',
      ar: 'SAR',
      hi: 'INR',
      ru: 'RUB',
      pl: 'PLN',
    };
    return currencyMap[language] || 'USD';
  }
}

export const multiLanguageAI = new MultiLanguageAIService();
