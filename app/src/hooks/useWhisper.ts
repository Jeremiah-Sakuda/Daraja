import { useState, useCallback, useEffect } from 'react';
import {
  whisperService,
  transcribeAudio,
  WhisperServiceState,
  TranscriptionResult,
  WHISPER_REQUIRED_LANGUAGES,
} from '../services/whisper';

export interface UseWhisperOptions {
  autoLoad?: boolean;
  modelId?: string;
}

export interface UseWhisperReturn {
  // State
  isLoaded: boolean;
  isLoading: boolean;
  isTranscribing: boolean;
  loadProgress: number;
  error: string | null;

  // Methods
  loadModel: () => Promise<void>;
  transcribe: (audioBlob: Blob, languageCode: string) => Promise<TranscriptionResult>;
  unload: () => void;

  // Helpers
  requiresWhisper: (languageCode: string) => boolean;
  isAvailable: () => Promise<boolean>;
}

/**
 * Hook for using Whisper ASR in components
 */
export function useWhisper(options: UseWhisperOptions = {}): UseWhisperReturn {
  const { autoLoad = false, modelId } = options;

  const [state, setState] = useState<WhisperServiceState>(whisperService.getState());
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Subscribe to service state changes
  useEffect(() => {
    const unsubscribe = whisperService.subscribe(setState);
    return unsubscribe;
  }, []);

  // Auto-load model if requested
  useEffect(() => {
    if (autoLoad && !state.isLoaded && !state.isLoading) {
      whisperService.loadModel(modelId).catch(console.error);
    }
  }, [autoLoad, modelId, state.isLoaded, state.isLoading]);

  const loadModel = useCallback(async () => {
    await whisperService.loadModel(modelId);
  }, [modelId]);

  const transcribe = useCallback(
    async (audioBlob: Blob, languageCode: string): Promise<TranscriptionResult> => {
      setIsTranscribing(true);
      try {
        return await transcribeAudio(audioBlob, languageCode);
      } finally {
        setIsTranscribing(false);
      }
    },
    []
  );

  const unload = useCallback(() => {
    whisperService.unload();
  }, []);

  const requiresWhisper = useCallback((languageCode: string): boolean => {
    return whisperService.requiresWhisper(languageCode);
  }, []);

  const isAvailable = useCallback(async (): Promise<boolean> => {
    return whisperService.isAvailable();
  }, []);

  return {
    isLoaded: state.isLoaded,
    isLoading: state.isLoading,
    isTranscribing,
    loadProgress: state.loadProgress,
    error: state.error,
    loadModel,
    transcribe,
    unload,
    requiresWhisper,
    isAvailable,
  };
}

/**
 * List of language codes that require Whisper for transcription
 */
export { WHISPER_REQUIRED_LANGUAGES };
