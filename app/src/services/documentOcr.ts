/**
 * Document OCR Service - Extract and translate text from images
 * Uses Ollama with vision-capable models (LLaVA, Gemma vision)
 */

import { ollamaClient } from './ollama';

export interface OcrResult {
  text: string;
  language: string;
  confidence: number;
  documentType?: DocumentType;
  fields?: ExtractedField[];
  processingTime: number;
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DocumentType =
  | 'identity_document'
  | 'medical_record'
  | 'legal_document'
  | 'travel_document'
  | 'certificate'
  | 'letter'
  | 'form'
  | 'unknown';

export interface TranslatedOcrResult extends OcrResult {
  translatedText: string;
  targetLanguage: string;
  translationConfidence: number;
}

// Vision model configurations
const VISION_MODELS = {
  default: 'gemma4:e4b',
  fast: 'llava:7b',
  gemma: 'gemma4:e4b',
} as const;

// Document type detection prompts
const DOCUMENT_TYPE_PROMPT = `Analyze this image and identify the document type. Respond with only one of these types:
- identity_document (ID card, passport, driver's license)
- medical_record (prescriptions, lab results, medical forms)
- legal_document (contracts, declarations, court documents)
- travel_document (visas, travel permits, refugee documents)
- certificate (birth, marriage, education certificates)
- letter (official correspondence)
- form (application forms, registration forms)
- unknown

Document type:`;

// OCR extraction prompt
const OCR_PROMPT = `Extract all visible text from this document image.
- Preserve the original language and script
- Maintain the document structure (headings, fields, values)
- Include any handwritten text if legible
- Format as structured text with clear field labels

Extracted text:`;

// Translation prompt template
const TRANSLATION_PROMPT = (sourceLang: string, targetLang: string) => `
Translate the following text from ${sourceLang} to ${targetLang}.
Maintain the document structure and field labels.
If any text is unclear or ambiguous, mark it with [?].

Text to translate:`;

class DocumentOcrService {
  private modelId: string = VISION_MODELS.default;
  private isAvailable: boolean | null = null;

  /**
   * Check if vision model is available
   */
  async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    try {
      const available = await ollamaClient.isAvailable();
      if (!available) {
        this.isAvailable = false;
        return false;
      }

      // Check if a vision model is available (Gemma 4 has multimodal support)
      const models = await ollamaClient.listModels();
      const hasVisionModel = models.some(
        (m) =>
          m.name.includes('llava') ||
          m.name.includes('vision') ||
          m.name.includes('gemma4') ||
          m.name.includes('gemma')
      );

      this.isAvailable = hasVisionModel;
      return hasVisionModel;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Set the vision model to use
   */
  setModel(modelId: string): void {
    this.modelId = modelId;
  }

  /**
   * Extract text from a document image
   */
  async extractText(imageData: string): Promise<OcrResult> {
    const startTime = performance.now();

    const available = await this.checkAvailability();
    if (!available) {
      throw new Error('Vision model not available. Please ensure Ollama is running with a vision model.');
    }

    // Remove data URL prefix if present
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');

    try {
      // First, detect document type
      const typeResponse = await this.callVisionModel(base64Image, DOCUMENT_TYPE_PROMPT);
      const documentType = this.parseDocumentType(typeResponse);

      // Then extract text
      const textResponse = await this.callVisionModel(base64Image, OCR_PROMPT);
      const extractedText = textResponse.trim();

      // Detect language from extracted text
      const language = await this.detectLanguage(extractedText);

      // Parse structured fields if applicable
      const fields = this.parseFields(extractedText, documentType);

      const processingTime = performance.now() - startTime;

      return {
        text: extractedText,
        language,
        confidence: this.estimateConfidence(extractedText),
        documentType,
        fields,
        processingTime,
      };
    } catch (error) {
      throw new Error(
        `OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract and translate text from a document image
   */
  async extractAndTranslate(
    imageData: string,
    targetLanguage: string
  ): Promise<TranslatedOcrResult> {
    // First extract the text
    const ocrResult = await this.extractText(imageData);

    // Then translate
    const translatedText = await this.translate(
      ocrResult.text,
      ocrResult.language,
      targetLanguage
    );

    return {
      ...ocrResult,
      translatedText,
      targetLanguage,
      translationConfidence: this.estimateTranslationConfidence(
        ocrResult.text,
        translatedText
      ),
    };
  }

  /**
   * Call the vision model with an image and prompt
   */
  private async callVisionModel(base64Image: string, prompt: string): Promise<string> {
    // For Ollama, we need to use the /api/generate endpoint with images
    const response = await fetch(`http://localhost:11434/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelId,
        prompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision model request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * Translate extracted text
   */
  private async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const prompt = `${TRANSLATION_PROMPT(sourceLang, targetLang)}\n\n${text}`;

    const response = await ollamaClient.generate({
      model: 'daraja-so-sw', // Use appropriate Daraja model based on language pair
      prompt,
      options: {
        temperature: 0.3,
        top_p: 0.9,
      },
    });

    return response.response.trim();
  }

  /**
   * Detect the language of extracted text
   */
  private async detectLanguage(text: string): Promise<string> {
    // Simple heuristic-based detection based on character sets
    // In production, could use a language detection model

    // Check for Ethiopic script (Tigrinya, Amharic)
    if (/[\u1200-\u137F]/.test(text)) {
      return 'ti'; // Tigrinya
    }

    // Check for Arabic script (Arabic, Dari/Persian)
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) {
      // Dari tends to use more Persian-specific characters
      if (/[\u067E\u0686\u0698\u06AF]/.test(text)) {
        return 'prs'; // Dari
      }
      return 'ar'; // Arabic
    }

    // Check for Latin characters with Somali-specific patterns
    const somaliBigrams = ['aa', 'dh', 'kh', 'sh', 'ay', 'ey', 'oo'];
    const lowerText = text.toLowerCase();
    const hasSomaliBigrams = somaliBigrams.some((bg) => lowerText.includes(bg));
    if (hasSomaliBigrams && /[xqc]/.test(lowerText)) {
      return 'so'; // Somali
    }

    // Check for Swahili patterns
    const swahiliWords = ['na', 'ya', 'wa', 'ni', 'kwa', 'katika'];
    const hasSwahiliWords = swahiliWords.some((w) =>
      new RegExp(`\\b${w}\\b`, 'i').test(text)
    );
    if (hasSwahiliWords) {
      return 'sw'; // Swahili
    }

    // Check for Turkish patterns
    if (/[ğıİşüöç]/i.test(text)) {
      return 'tr'; // Turkish
    }

    // Default to English
    return 'en';
  }

  /**
   * Parse document type from model response
   */
  private parseDocumentType(response: string): DocumentType {
    const types: DocumentType[] = [
      'identity_document',
      'medical_record',
      'legal_document',
      'travel_document',
      'certificate',
      'letter',
      'form',
    ];

    const lowerResponse = response.toLowerCase();
    for (const type of types) {
      if (lowerResponse.includes(type.replace('_', ' ')) || lowerResponse.includes(type)) {
        return type;
      }
    }

    return 'unknown';
  }

  /**
   * Parse structured fields from extracted text
   */
  private parseFields(text: string, _documentType: DocumentType): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const lines = text.split('\n');

    // Common field patterns
    const fieldPatterns = [
      /^(.+?):\s*(.+)$/,
      /^(.+?)\s*[-–—]\s*(.+)$/,
      /^([A-Z][a-z\s]+):\s*(.+)$/,
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      for (const pattern of fieldPatterns) {
        const match = trimmedLine.match(pattern);
        if (match && match[1] && match[2]) {
          fields.push({
            name: match[1].trim(),
            value: match[2].trim(),
            confidence: 0.7, // Default confidence
          });
          break;
        }
      }
    }

    return fields;
  }

  /**
   * Estimate OCR confidence based on text characteristics
   */
  private estimateConfidence(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    let confidence = 0.7;

    // Penalize very short extractions
    if (text.length < 20) {
      confidence -= 0.2;
    }

    // Penalize many question marks (unclear text)
    const questionMarkRatio = (text.match(/\?/g) || []).length / text.length;
    if (questionMarkRatio > 0.05) {
      confidence -= 0.15;
    }

    // Penalize many special characters
    const specialCharRatio = (text.match(/[^\w\s\n.,;:'"()-]/g) || []).length / text.length;
    if (specialCharRatio > 0.1) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Estimate translation confidence
   */
  private estimateTranslationConfidence(source: string, translated: string): number {
    if (!translated || translated.trim().length === 0) {
      return 0;
    }

    let confidence = 0.7;

    // Length ratio check
    const ratio = translated.length / (source.length || 1);
    if (ratio < 0.3 || ratio > 3) {
      confidence -= 0.2;
    }

    // Check for [?] markers indicating uncertainty
    const uncertaintyMarkers = (translated.match(/\[\?\]/g) || []).length;
    confidence -= uncertaintyMarkers * 0.1;

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Analyze document and generate Q&A summary
   * Provides: translation, summary, key fields, and required actions
   */
  async analyzeDocument(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<DocumentAnalysis> {
    const prompt = `Analyze this ${sourceLanguage} document and provide a structured response in ${targetLanguage}:

Document text:
${text}

Provide your response in this exact format:
SUMMARY: (2-3 sentence summary of the document's purpose)
KEY_FIELDS:
- Field name: value
- Field name: value
REQUIRED_ACTIONS:
- Action 1
- Action 2
DEADLINES: (any dates or deadlines mentioned, or "None specified")

Response:`;

    try {
      const response = await ollamaClient.generate({
        model: 'daraja-so-sw',
        prompt,
        options: {
          temperature: 0.3,
          num_predict: 500,
        },
      });

      return this.parseDocumentAnalysis(response.response, targetLanguage);
    } catch (error) {
      console.error('Document analysis failed:', error);
      return {
        summary: 'Unable to analyze document',
        keyFields: [],
        requiredActions: [],
        deadlines: 'Unknown',
        confidence: 0,
      };
    }
  }

  /**
   * Parse the structured analysis response
   */
  private parseDocumentAnalysis(response: string, _targetLanguage: string): DocumentAnalysis {
    const lines = response.split('\n');
    let summary = '';
    const keyFields: { name: string; value: string }[] = [];
    const requiredActions: string[] = [];
    let deadlines = 'None specified';
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('SUMMARY:')) {
        currentSection = 'summary';
        summary = trimmed.replace('SUMMARY:', '').trim();
      } else if (trimmed.startsWith('KEY_FIELDS:')) {
        currentSection = 'fields';
      } else if (trimmed.startsWith('REQUIRED_ACTIONS:')) {
        currentSection = 'actions';
      } else if (trimmed.startsWith('DEADLINES:')) {
        currentSection = 'deadlines';
        deadlines = trimmed.replace('DEADLINES:', '').trim();
      } else if (trimmed.startsWith('-')) {
        const content = trimmed.substring(1).trim();
        if (currentSection === 'fields' && content.includes(':')) {
          const [name, ...valueParts] = content.split(':');
          keyFields.push({ name: name.trim(), value: valueParts.join(':').trim() });
        } else if (currentSection === 'actions') {
          requiredActions.push(content);
        }
      } else if (currentSection === 'summary' && trimmed) {
        summary += ' ' + trimmed;
      }
    }

    return {
      summary: summary || 'Document summary not available',
      keyFields,
      requiredActions,
      deadlines,
      confidence: summary ? 0.7 : 0.3,
    };
  }
}

export interface DocumentAnalysis {
  summary: string;
  keyFields: { name: string; value: string }[];
  requiredActions: string[];
  deadlines: string;
  confidence: number;
}

// Singleton instance
export const documentOcrService = new DocumentOcrService();

/**
 * Convenience function for quick OCR extraction
 */
export async function extractDocumentText(imageData: string): Promise<OcrResult> {
  return documentOcrService.extractText(imageData);
}

/**
 * Convenience function for OCR with translation
 */
export async function extractAndTranslateDocument(
  imageData: string,
  targetLanguage: string
): Promise<TranslatedOcrResult> {
  return documentOcrService.extractAndTranslate(imageData, targetLanguage);
}

/**
 * Convenience function for document analysis/Q&A
 */
export async function analyzeDocument(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<DocumentAnalysis> {
  return documentOcrService.analyzeDocument(text, sourceLanguage, targetLanguage);
}
