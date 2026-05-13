/**
 * Whisper ASR service using Transformers.js for browser-based transcription
 * Provides fallback for languages not supported by Web Speech API (Somali, Tigrinya, Dari)
 */

// Types for Transformers.js
interface TranscriptionOutput {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WhisperPipeline = any;

interface TranscriptionOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
  chunk_length_s?: number;
  stride_length_s?: number;
  return_timestamps?: boolean;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  duration: number;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

export interface WhisperServiceState {
  isLoaded: boolean;
  isLoading: boolean;
  loadProgress: number;
  error: string | null;
  modelId: string;
}

// Languages that need Whisper fallback (not well supported by Web Speech API)
export const WHISPER_REQUIRED_LANGUAGES = ['so', 'ti', 'prs', 'fa'] as const;
export type WhisperLanguage = (typeof WHISPER_REQUIRED_LANGUAGES)[number];

// Language code mapping for Whisper
const LANGUAGE_MAP: Record<string, string> = {
  so: 'somali',
  ti: 'tigrinya',
  prs: 'persian', // Dari is a variety of Persian
  fa: 'persian',
  sw: 'swahili',
  ar: 'arabic',
  tr: 'turkish',
  en: 'english',
};

class WhisperService {
  private pipeline: WhisperPipeline | null = null;
  private state: WhisperServiceState = {
    isLoaded: false,
    isLoading: false,
    loadProgress: 0,
    error: null,
    modelId: 'Xenova/whisper-small',
  };
  private listeners: Set<(state: WhisperServiceState) => void> = new Set();

  /**
   * Check if a language requires Whisper (not supported by Web Speech API)
   */
  requiresWhisper(languageCode: string): boolean {
    return WHISPER_REQUIRED_LANGUAGES.includes(languageCode as WhisperLanguage);
  }

  /**
   * Get current service state
   */
  getState(): WhisperServiceState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: WhisperServiceState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private updateState(updates: Partial<WhisperServiceState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((cb) => cb(this.state));
  }

  /**
   * Load the Whisper model
   */
  async loadModel(modelId?: string): Promise<void> {
    if (this.state.isLoaded && (!modelId || modelId === this.state.modelId)) {
      return;
    }

    if (this.state.isLoading) {
      // Wait for current loading to complete
      return new Promise((resolve, reject) => {
        const checkLoaded = () => {
          if (this.state.isLoaded) {
            resolve();
          } else if (this.state.error) {
            reject(new Error(this.state.error));
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }

    const targetModel = modelId || this.state.modelId;
    this.updateState({
      isLoading: true,
      loadProgress: 0,
      error: null,
      modelId: targetModel,
    });

    try {
      // Dynamic import of Transformers.js
      const { pipeline } = await import('@xenova/transformers');

      this.pipeline = await pipeline('automatic-speech-recognition', targetModel, {
        progress_callback: (progress: { progress: number; status: string }) => {
          if (progress.progress) {
            this.updateState({ loadProgress: Math.round(progress.progress) });
          }
        },
        // Use WebGPU if available, fallback to WASM
        device: 'webgpu',
        dtype: 'fp16',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      this.updateState({
        isLoaded: true,
        isLoading: false,
        loadProgress: 100,
      });
    } catch (error) {
      // Fallback to WASM if WebGPU fails
      try {
        const { pipeline } = await import('@xenova/transformers');

        this.pipeline = await pipeline('automatic-speech-recognition', targetModel, {
          progress_callback: (progress: { progress: number; status: string }) => {
            if (progress.progress) {
              this.updateState({ loadProgress: Math.round(progress.progress) });
            }
          },
        });

        this.updateState({
          isLoaded: true,
          isLoading: false,
          loadProgress: 100,
        });
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error
          ? fallbackError.message
          : 'Failed to load Whisper model';

        this.updateState({
          isLoading: false,
          error: errorMessage,
        });

        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Transcribe audio blob to text
   */
  async transcribe(
    audioBlob: Blob,
    languageCode: string
  ): Promise<TranscriptionResult> {
    const startTime = performance.now();

    // Ensure model is loaded
    if (!this.state.isLoaded) {
      await this.loadModel();
    }

    if (!this.pipeline) {
      throw new Error('Whisper model not loaded');
    }

    // Convert blob to audio data
    const audioData = await this.blobToAudioData(audioBlob);
    const whisperLang = LANGUAGE_MAP[languageCode] || languageCode;

    // Run transcription
    const result = await this.pipeline(audioData, {
      language: whisperLang,
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const duration = (performance.now() - startTime) / 1000;

    // Process segments if available
    const segments = result.chunks?.map((chunk: { text: string; timestamp: [number, number] }) => ({
      text: chunk.text,
      start: chunk.timestamp[0],
      end: chunk.timestamp[1],
    }));

    return {
      text: result.text.trim(),
      language: languageCode,
      confidence: this.estimateConfidence(result.text),
      duration,
      segments,
    };
  }

  /**
   * Convert audio blob to Float32Array for Whisper
   */
  private async blobToAudioData(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Whisper expects mono audio at 16kHz
      const numberOfChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const sampleRate = audioBuffer.sampleRate;

      // Resample if needed
      let audioData: Float32Array;

      if (sampleRate === 16000 && numberOfChannels === 1) {
        audioData = audioBuffer.getChannelData(0);
      } else {
        // Mix down to mono and resample
        const targetLength = Math.round(length * 16000 / sampleRate);
        audioData = new Float32Array(targetLength);

        for (let i = 0; i < targetLength; i++) {
          const sourceIndex = Math.round(i * sampleRate / 16000);
          let sample = 0;

          for (let channel = 0; channel < numberOfChannels; channel++) {
            sample += audioBuffer.getChannelData(channel)[sourceIndex] || 0;
          }

          audioData[i] = sample / numberOfChannels;
        }
      }

      return audioData;
    } finally {
      await audioContext.close();
    }
  }

  /**
   * Estimate confidence based on transcription output
   * This is a heuristic since Whisper doesn't provide confidence scores directly
   */
  private estimateConfidence(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    // Base confidence
    let confidence = 0.7;

    // Penalize very short transcriptions
    if (text.length < 10) {
      confidence -= 0.1;
    }

    // Penalize transcriptions with many special characters
    const specialCharRatio = (text.match(/[^\w\s]/g) || []).length / text.length;
    if (specialCharRatio > 0.2) {
      confidence -= 0.15;
    }

    // Penalize repeated words (may indicate hallucination)
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Check if Whisper is available (Transformers.js can be loaded)
   */
  async isAvailable(): Promise<boolean> {
    try {
      await import('@xenova/transformers');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Unload the model to free memory
   */
  unload(): void {
    this.pipeline = null;
    this.updateState({
      isLoaded: false,
      loadProgress: 0,
    });
  }
}

// Singleton instance
export const whisperService = new WhisperService();

/**
 * Hook-friendly function to transcribe with automatic model loading
 */
export async function transcribeAudio(
  audioBlob: Blob,
  languageCode: string,
  onProgress?: (progress: number) => void
): Promise<TranscriptionResult> {
  // Subscribe to progress updates
  let unsubscribe: (() => void) | undefined;

  if (onProgress) {
    unsubscribe = whisperService.subscribe((state) => {
      if (state.isLoading) {
        onProgress(state.loadProgress);
      }
    });
  }

  try {
    return await whisperService.transcribe(audioBlob, languageCode);
  } finally {
    unsubscribe?.();
  }
}
