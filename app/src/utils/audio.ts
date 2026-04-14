/**
 * Audio Utilities
 *
 * Helper functions for audio recording, processing, and playback.
 */

// Supported audio formats
export const SUPPORTED_FORMATS = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mp3',
  wav: 'audio/wav',
} as const;

export type AudioFormat = keyof typeof SUPPORTED_FORMATS;

/**
 * Check if audio recording is supported
 */
export function isRecordingSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Get the best supported MIME type for recording
 */
export function getBestMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return SUPPORTED_FORMATS.webm;
  }

  // Prefer webm, then ogg, then wav
  const preferences = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
  ];

  for (const mimeType of preferences) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return SUPPORTED_FORMATS.webm;
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<{
  granted: boolean;
  stream?: MediaStream;
  error?: string;
}> {
  if (!isRecordingSupported()) {
    return {
      granted: false,
      error: 'Audio recording is not supported in this browser',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    return { granted: true, stream };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('NotAllowed') || message.includes('Permission denied')) {
      return {
        granted: false,
        error: 'Microphone permission was denied. Please allow access to record.',
      };
    }

    if (message.includes('NotFound')) {
      return {
        granted: false,
        error: 'No microphone found. Please connect a microphone.',
      };
    }

    return {
      granted: false,
      error: `Failed to access microphone: ${message}`,
    };
  }
}

/**
 * Convert audio blob to base64 data URL
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert base64 data URL to Blob
 */
export function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';

  const byteCharacters = atob(data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Create an audio URL from a blob
 */
export function createAudioUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revoke an audio URL to free memory
 */
export function revokeAudioUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Get audio duration from blob
 */
export async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = createAudioUrl(blob);

    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      revokeAudioUrl(url);
    };

    audio.onerror = () => {
      revokeAudioUrl(url);
      reject(new Error('Failed to load audio'));
    };

    audio.src = url;
  });
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Audio level analyzer for visualization
 */
export class AudioLevelAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  /**
   * Initialize with a media stream
   */
  connect(stream: MediaStream): void {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
  }

  /**
   * Get current audio level (0-1)
   */
  getLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;

    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate RMS
    let sum = 0;
    for (const value of this.dataArray) {
      sum += value * value;
    }
    const rms = Math.sqrt(sum / this.dataArray.length);

    // Normalize to 0-1 (max value is 255)
    return Math.min(1, rms / 128);
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.dataArray) return null;

    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
  }
}

/**
 * Audio playback helper
 */
export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;

  /**
   * Load audio from blob
   */
  load(blob: Blob): void {
    this.unload();
    this.url = createAudioUrl(blob);
    this.audio = new Audio(this.url);
  }

  /**
   * Load audio from URL
   */
  loadUrl(url: string): void {
    this.unload();
    this.url = url;
    this.audio = new Audio(url);
  }

  /**
   * Play audio
   */
  async play(): Promise<void> {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }
    await this.audio.play();
  }

  /**
   * Pause audio
   */
  pause(): void {
    this.audio?.pause();
  }

  /**
   * Stop and reset to beginning
   */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  /**
   * Seek to position (0-1)
   */
  seek(position: number): void {
    if (this.audio && this.audio.duration) {
      this.audio.currentTime = position * this.audio.duration;
    }
  }

  /**
   * Get current position (0-1)
   */
  getPosition(): number {
    if (!this.audio || !this.audio.duration) return 0;
    return this.audio.currentTime / this.audio.duration;
  }

  /**
   * Get duration in seconds
   */
  getDuration(): number {
    return this.audio?.duration || 0;
  }

  /**
   * Check if playing
   */
  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: EventListener): void {
    this.audio?.addEventListener(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: EventListener): void {
    this.audio?.removeEventListener(event, callback);
  }

  /**
   * Unload and cleanup
   */
  unload(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }

    if (this.url && this.url.startsWith('blob:')) {
      revokeAudioUrl(this.url);
    }
    this.url = null;
  }
}

/**
 * Concatenate multiple audio blobs
 * Note: This is a simplified version - for production,
 * consider using the Web Audio API for proper concatenation
 */
export async function concatenateAudioBlobs(blobs: Blob[]): Promise<Blob> {
  const combinedArrayBuffer = await Promise.all(
    blobs.map((blob) => blob.arrayBuffer())
  );

  const totalLength = combinedArrayBuffer.reduce(
    (acc, buf) => acc + buf.byteLength,
    0
  );

  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of combinedArrayBuffer) {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return new Blob([combined], { type: blobs[0]?.type || 'audio/webm' });
}

/**
 * Trim silence from audio (simplified version)
 * In production, this would analyze actual audio data
 */
export function estimateSpeechDuration(
  totalDuration: number,
  averageLevel: number
): number {
  // Estimate based on average audio level
  // Higher levels suggest more speech content
  const speechRatio = Math.min(1, averageLevel * 2);
  return totalDuration * speechRatio;
}
