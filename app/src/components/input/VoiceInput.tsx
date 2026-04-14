import { Mic, MicOff, Square, Loader2 } from 'lucide-react';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';

interface VoiceInputProps {
  onTranscriptionComplete: (text: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
}

export function VoiceInput({
  onTranscriptionComplete,
  isProcessing = false,
  placeholder,
}: VoiceInputProps) {
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    error,
    isSupported,
    startRecording,
    stopRecording,
    clearRecording,
    formatDuration,
  } = useVoiceRecording({
    maxDuration: 120,
    onRecordingComplete: async (blob) => {
      // In production, this would send audio to speech-to-text
      // For demo, we'll simulate transcription
      console.log('Recording complete:', blob.size, 'bytes');

      // Simulate transcription delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock transcription result
      const mockText = "This is a simulated transcription. In production, this would be actual speech-to-text output.";
      onTranscriptionComplete(mockText);
    },
  });

  if (!isSupported) {
    return (
      <div className="text-center p-4">
        <p className="text-daraja-500 text-sm">
          Voice recording is not supported in this browser.
          Please use a modern browser or type your response.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Prompt hint */}
      {placeholder && !isRecording && !audioUrl && (
        <p className="text-sm text-daraja-500 text-center max-w-xs">
          {placeholder}
        </p>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-alert-500">
          <span className="w-3 h-3 bg-alert-500 rounded-full animate-pulse" />
          <span className="font-mono text-lg">{formatDuration(duration)}</span>
        </div>
      )}

      {/* Main button */}
      <div className="flex items-center gap-4">
        {isRecording ? (
          <button
            onClick={stopRecording}
            className="btn-voice recording"
            aria-label="Stop recording"
          >
            <Square className="w-8 h-8" />
          </button>
        ) : isProcessing ? (
          <div className="btn-voice opacity-75 cursor-not-allowed">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <button
            onClick={startRecording}
            className="btn-voice"
            aria-label="Start recording"
          >
            <Mic className="w-8 h-8" />
          </button>
        )}
      </div>

      {/* Instructions */}
      {!isRecording && !audioUrl && !isProcessing && (
        <p className="text-xs text-daraja-400">
          Tap to start recording
        </p>
      )}

      {/* Audio playback */}
      {audioUrl && !isRecording && (
        <div className="w-full space-y-3">
          <audio
            src={audioUrl}
            controls
            className="w-full rounded-xl"
          />
          <button
            onClick={clearRecording}
            className="btn-ghost w-full text-sm"
          >
            <MicOff className="w-4 h-4 mr-2" />
            Clear and record again
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-alert-500 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
