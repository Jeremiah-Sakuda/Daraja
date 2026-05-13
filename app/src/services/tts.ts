/**
 * Text-to-Speech service using Web Speech API
 * Provides offline-capable speech synthesis for Swahili and other languages
 *
 * Future: Integrate Coqui XTTS for higher quality Somali/Swahili voices
 */

export interface TTSOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface TTSState {
  isSpeaking: boolean;
  isSupported: boolean;
  availableVoices: SpeechSynthesisVoice[];
}

// Language code mapping for Web Speech API
const LANGUAGE_CODES: Record<string, string> = {
  sw: 'sw-KE', // Swahili (Kenya)
  so: 'so-SO', // Somali
  en: 'en-US', // English
  ar: 'ar-SA', // Arabic
  ti: 'ti-ER', // Tigrinya
};

class TTSService {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isSupported = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.isSupported = true;
      this.loadVoices();

      // Voices may load asynchronously
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (this.synthesis) {
      this.voices = this.synthesis.getVoices();
    }
  }

  /**
   * Get available voices for a language
   */
  getVoicesForLanguage(langCode: string): SpeechSynthesisVoice[] {
    const targetLang = LANGUAGE_CODES[langCode] || langCode;
    return this.voices.filter(
      (v) => v.lang.startsWith(targetLang.split('-')[0])
    );
  }

  /**
   * Get the best voice for a language
   */
  private getBestVoice(langCode: string): SpeechSynthesisVoice | null {
    const voices = this.getVoicesForLanguage(langCode);

    // Prefer local/offline voices
    const localVoice = voices.find((v) => v.localService);
    if (localVoice) return localVoice;

    // Fall back to any voice for the language
    if (voices.length > 0) return voices[0];

    // Fall back to English if target language not available
    if (langCode !== 'en') {
      console.warn(
        `No voice found for ${langCode}, falling back to English`
      );
      return this.getBestVoice('en');
    }

    return null;
  }

  /**
   * Speak text in the specified language
   */
  speak(text: string, options: TTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis || !this.isSupported) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);

      // Set language
      const langCode = options.lang || 'sw';
      const voice = this.getBestVoice(langCode);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = LANGUAGE_CODES[langCode] || langCode;
      }

      // Set other options
      utterance.rate = options.rate ?? 0.9; // Slightly slower for clarity
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Speech error: ${event.error}`));
      };

      this.currentUtterance = utterance;
      this.synthesis.speak(utterance);
    });
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * Pause ongoing speech
   */
  pause(): void {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis?.speaking ?? false;
  }

  /**
   * Get current state
   */
  getState(): TTSState {
    return {
      isSpeaking: this.isSpeaking(),
      isSupported: this.isSupported,
      availableVoices: this.voices,
    };
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(langCode: string): boolean {
    return this.getVoicesForLanguage(langCode).length > 0;
  }
}

// Singleton instance
export const ttsService = new TTSService();

/**
 * React hook for TTS (for future use in components)
 */
export function useTTS() {
  return {
    speak: (text: string, options?: TTSOptions) => ttsService.speak(text, options),
    stop: () => ttsService.stop(),
    pause: () => ttsService.pause(),
    resume: () => ttsService.resume(),
    isSpeaking: () => ttsService.isSpeaking(),
    isSupported: ttsService.getState().isSupported,
    getVoices: (lang: string) => ttsService.getVoicesForLanguage(lang),
  };
}
