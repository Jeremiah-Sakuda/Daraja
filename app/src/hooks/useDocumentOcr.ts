import { useState, useCallback } from 'react';
import {
  documentOcrService,
  OcrResult,
  TranslatedOcrResult,
} from '../services/documentOcr';

export interface UseDocumentOcrReturn {
  // State
  isProcessing: boolean;
  result: OcrResult | TranslatedOcrResult | null;
  error: string | null;

  // Actions
  extractText: (imageData: string) => Promise<OcrResult | null>;
  extractAndTranslate: (
    imageData: string,
    targetLanguage: string
  ) => Promise<TranslatedOcrResult | null>;
  checkAvailability: () => Promise<boolean>;
  clear: () => void;
}

/**
 * Hook for document OCR functionality
 */
export function useDocumentOcr(): UseDocumentOcrReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OcrResult | TranslatedOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractText = useCallback(async (imageData: string): Promise<OcrResult | null> => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const ocrResult = await documentOcrService.extractText(imageData);
      setResult(ocrResult);
      return ocrResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR extraction failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const extractAndTranslate = useCallback(
    async (imageData: string, targetLanguage: string): Promise<TranslatedOcrResult | null> => {
      setIsProcessing(true);
      setError(null);
      setResult(null);

      try {
        const translatedResult = await documentOcrService.extractAndTranslate(
          imageData,
          targetLanguage
        );
        setResult(translatedResult);
        return translatedResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'OCR and translation failed';
        setError(errorMessage);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    return documentOcrService.checkAvailability();
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    isProcessing,
    result,
    error,
    extractText,
    extractAndTranslate,
    checkAvailability,
    clear,
  };
}
