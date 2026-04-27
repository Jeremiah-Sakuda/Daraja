import { useState, useCallback, useRef, useEffect } from 'react';
import { Camera, Upload, X, RotateCcw, Check, Loader2, AlertCircle } from 'lucide-react';
import { useDocumentOcr } from '../../hooks/useDocumentOcr';

interface DocumentCaptureProps {
  onCapture: (imageData: string) => void;
  onExtractedText?: (text: string, confidence?: number) => void;
  onTranslatedText?: (text: string, confidence?: number) => void;
  targetLanguage?: string;
  isProcessing?: boolean;
}

export function DocumentCapture({
  onCapture,
  onExtractedText,
  onTranslatedText,
  targetLanguage = 'en',
  isProcessing = false,
}: DocumentCaptureProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrAvailable, setOcrAvailable] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    isProcessing: isOcrProcessing,
    result: ocrResult,
    error: ocrError,
    extractText,
    extractAndTranslate,
    checkAvailability,
  } = useDocumentOcr();

  // Check OCR availability on mount
  useEffect(() => {
    checkAvailability().then(setOcrAvailable);
  }, [checkAvailability]);

  // Start camera capture
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCapturing(true);
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
      console.error('Camera error:', err);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  // Capture photo from video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageData);
      onCapture(imageData);
      stopCamera();
    }
  }, [onCapture, stopCamera]);

  // Handle file upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setCapturedImage(imageData);
        onCapture(imageData);
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsDataURL(file);
    },
    [onCapture]
  );

  // Clear captured image
  const clearImage = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Extract text using OCR service
  const handleExtractText = useCallback(async () => {
    if (!capturedImage) return;

    try {
      if (onTranslatedText && targetLanguage) {
        // Extract and translate
        const result = await extractAndTranslate(capturedImage, targetLanguage);
        if (result) {
          onExtractedText?.(result.text, result.confidence);
          onTranslatedText(result.translatedText, result.translationConfidence);
        }
      } else if (onExtractedText) {
        // Extract only
        const result = await extractText(capturedImage);
        if (result) {
          onExtractedText(result.text, result.confidence);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Text extraction failed');
    }
  }, [capturedImage, onExtractedText, onTranslatedText, targetLanguage, extractText, extractAndTranslate]);

  return (
    <div className="space-y-4">
      {/* Camera view */}
      {isCapturing && (
        <div className="relative rounded-2xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-[4/3] object-cover"
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={stopCamera}
              className="btn-icon bg-white/20 text-white hover:bg-white/30"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center
                         shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full border-4 border-daraja-600" />
            </button>
          </div>
        </div>
      )}

      {/* Captured image preview */}
      {capturedImage && !isCapturing && (
        <div className="relative rounded-2xl overflow-hidden">
          <img
            src={capturedImage}
            alt="Captured document"
            className="w-full aspect-[4/3] object-cover"
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={clearImage}
              className="btn-icon bg-white/90 shadow-md"
              aria-label="Clear image"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Extract text button */}
          {(onExtractedText || onTranslatedText) && (
            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              {ocrAvailable === false && (
                <div className="bg-amber-100 text-amber-800 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Vision model not available. Ensure Ollama is running with LLaVA.</span>
                </div>
              )}
              <button
                onClick={handleExtractText}
                disabled={isProcessing || isOcrProcessing || ocrAvailable === false}
                className="btn-primary w-full"
              >
                {isProcessing || isOcrProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {onTranslatedText ? 'Extracting & translating...' : 'Extracting text...'}
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    {onTranslatedText ? 'Extract & Translate' : 'Extract Text'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Capture buttons */}
      {!isCapturing && !capturedImage && (
        <div className="flex gap-3">
          <button
            onClick={startCamera}
            className="btn-secondary flex-1"
          >
            <Camera className="w-5 h-5 mr-2" />
            Take Photo
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary flex-1"
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Retake button */}
      {capturedImage && !isCapturing && (
        <button onClick={clearImage} className="btn-ghost w-full">
          <RotateCcw className="w-4 h-4 mr-2" />
          Take new photo
        </button>
      )}

      {/* Error message */}
      {(error || ocrError) && (
        <p className="text-sm text-alert-500 text-center">{error || ocrError}</p>
      )}

      {/* OCR Result preview */}
      {ocrResult && 'text' in ocrResult && (
        <div className="bg-daraja-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-daraja-500">
            <span>Detected: {ocrResult.documentType || 'Document'}</span>
            <span>Confidence: {Math.round(ocrResult.confidence * 100)}%</span>
          </div>
          <p className="text-sm text-daraja-700 line-clamp-3">{ocrResult.text}</p>
          {'translatedText' in ocrResult && (
            <div className="border-t border-daraja-200 pt-2 mt-2">
              <p className="text-sm text-daraja-600 line-clamp-3">
                {ocrResult.translatedText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      {!capturedImage && !isCapturing && (
        <p className="text-xs text-daraja-400 text-center">
          Capture a document or ID card to extract text
        </p>
      )}
    </div>
  );
}
