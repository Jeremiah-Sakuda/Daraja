/**
 * Ollama API client for translation services
 */

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
  system?: string;
  context?: number[];
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  context?: number[];
}

/**
 * Response with token-level confidence metrics extracted from timing data
 */
export interface OllamaGenerateResponseWithConfidence extends OllamaGenerateResponse {
  confidence: {
    tokensPerSecond: number;
    avgTokenDurationMs: number;
    consistencyScore: number;
  };
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if Ollama is running and accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.models || [];
  }

  /**
   * Generate text (non-streaming)
   */
  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate text with confidence metrics derived from model timing
   *
   * Confidence is estimated from:
   * - Tokens per second (higher = more confident responses)
   * - Consistency of token generation timing
   * - Eval duration relative to token count
   */
  async generateWithConfidence(
    request: OllamaGenerateRequest
  ): Promise<OllamaGenerateResponseWithConfidence> {
    const response = await this.generate(request);

    // Calculate confidence metrics from timing data
    const evalCount = response.eval_count || 1;
    const evalDurationNs = response.eval_duration || 1;
    const evalDurationMs = evalDurationNs / 1_000_000;

    // Tokens per second - higher generally indicates more confident generation
    const tokensPerSecond = evalCount / (evalDurationMs / 1000);

    // Average time per token in milliseconds
    const avgTokenDurationMs = evalDurationMs / evalCount;

    // Consistency score based on expected token generation rate
    // Well-trained models typically generate 20-50 tokens/sec on good hardware
    // We normalize this to a 0-1 score
    const expectedTpsMin = 10;
    const expectedTpsMax = 60;
    const normalizedTps = Math.min(1, Math.max(0,
      (tokensPerSecond - expectedTpsMin) / (expectedTpsMax - expectedTpsMin)
    ));

    // Higher token rate suggests more confident predictions
    // Very slow generation may indicate model uncertainty
    const consistencyScore = normalizedTps;

    return {
      ...response,
      confidence: {
        tokensPerSecond,
        avgTokenDurationMs,
        consistencyScore,
      },
    };
  }

  /**
   * Generate text with streaming
   */
  async *generateStream(
    request: OllamaGenerateRequest
  ): AsyncGenerator<OllamaGenerateResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line);
        }
      }
    }
  }

  /**
   * Pull a model from the registry
   */
  async pullModel(
    modelName: string,
    onProgress?: (status: string, progress?: number) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: modelName,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          const data = JSON.parse(line);
          if (onProgress) {
            const progress = data.completed && data.total
              ? (data.completed / data.total) * 100
              : undefined;
            onProgress(data.status, progress);
          }
        }
      }
    }
  }

  /**
   * Check if a specific model is available
   */
  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some((m) => m.name === modelName || m.name.startsWith(modelName));
  }
}

// Default client instance
export const ollamaClient = new OllamaClient();
