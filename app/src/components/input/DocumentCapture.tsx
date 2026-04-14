import { useState, useCallback, useRef } from 'react';
import { Camera, Upload, X, RotateCcw, Check, Loader2 } from 'lucide-react';

interface DocumentCaptureProps {
  onCapture: (imageData: string) => void;
  onExtractedText?: (text: string) => void;
  isProcessing?: boolean;
}

export function DocumentCapture({
  onCapture,
  onExtractedText,
  isProcessing = false,
}: DocumentCaptureProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Simulate text extraction (in production, this would use OCR or vision model)
  const extractText = useCallback(async () => {
    if (!capturedImage || !onExtractedText) return;

    // Simulated extraction - in production this would call the vision model
    await new Promise((resolve) => setTimeout(resolve, 1000));
    onExtractedText('[Extracted text would appear here in production]');
  }, [capturedImage, onExtractedText]);

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
          {onExtractedText && (
            <div className="absolute bottom-4 left-4 right-4">
              <button
                onClick={extractText}
                disabled={isProcessing}
                className="btn-primary w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Extracting text...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Extract Text
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
      {error && (
        <p className="text-sm text-alert-500 text-center">{error}</p>
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
