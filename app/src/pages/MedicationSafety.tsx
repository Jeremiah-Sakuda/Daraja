import { useState, useCallback, useRef } from 'react';
import {
  Pill,
  Camera,
  Upload,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { documentOcrService } from '../services/documentOcr';
import { translate } from '../services/translation';
import type { ConfidenceLevel } from '../types/translation';
import { ConfidenceBadge } from '../components/translation/ConfidenceBadge';

interface MedicationInfo {
  name: string;
  dosage: string;
  frequency: string;
  warnings: string[];
  sideEffects: string[];
  rawText: string;
  translatedText: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
}

interface ProcessingState {
  step: 'idle' | 'capturing' | 'extracting' | 'analyzing' | 'translating' | 'complete' | 'error';
  message: string;
}

export function MedicationSafety() {
  const [sourceLang] = useState('en'); // Medication labels usually in English
  const [targetLang, setTargetLang] = useState('sw');
  const [imageData, setImageData] = useState<string | null>(null);
  const [medication, setMedication] = useState<MedicationInfo | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ step: 'idle', message: '' });
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImageData(result);
      processMedicationImage(result);
    };
    reader.readAsDataURL(file);
  }, [targetLang]);

  const handleCameraCapture = useCallback(() => {
    // Trigger file input with camera capture on mobile
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  }, []);

  const processMedicationImage = async (base64Image: string) => {
    setMedication(null);

    try {
      // Step 1: Extract text from image
      setProcessing({ step: 'extracting', message: 'Reading medication label...' });

      const ocrResult = await documentOcrService.extractText(base64Image);

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        setProcessing({ step: 'error', message: 'Could not read text from image. Please try again with a clearer photo.' });
        return;
      }

      // Step 2: Analyze medication information
      setProcessing({ step: 'analyzing', message: 'Analyzing medication information...' });

      const medicationDetails = parseMedicationInfo(ocrResult.text);

      // Step 3: Translate to target language
      setProcessing({ step: 'translating', message: 'Translating to your language...' });

      let translatedText = ocrResult.text;
      let translationConfidence = 0.5;
      let confidenceLevel: ConfidenceLevel = 'medium';

      try {
        const translationResult = await translate({
          text: ocrResult.text,
          sourceLang,
          targetLang,
          domain: 'medical',
        });
        translatedText = translationResult.translatedText;
        translationConfidence = translationResult.confidence;
        confidenceLevel = translationResult.confidenceLevel;
      } catch {
        // Keep original text if translation fails
        console.warn('Translation failed, using original text');
      }

      setMedication({
        ...medicationDetails,
        rawText: ocrResult.text,
        translatedText,
        confidence: translationConfidence,
        confidenceLevel,
      });

      setProcessing({ step: 'complete', message: '' });
    } catch (error) {
      console.error('Medication processing error:', error);
      setProcessing({
        step: 'error',
        message: error instanceof Error ? error.message : 'Failed to process medication image',
      });
    }
  };

  const parseMedicationInfo = (text: string): Omit<MedicationInfo, 'rawText' | 'translatedText' | 'confidence' | 'confidenceLevel'> => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Extract medication name (usually first prominent line)
    const name = lines[0] || 'Unknown Medication';

    // Look for dosage patterns
    const dosagePatterns = [
      /(\d+\s*(?:mg|ml|mcg|g|tablets?|capsules?|pills?))/gi,
      /(?:dose|dosage|strength)[:\s]*([^\n]+)/i,
    ];
    let dosage = 'See label';
    for (const pattern of dosagePatterns) {
      const match = text.match(pattern);
      if (match) {
        dosage = match[1] || match[0];
        break;
      }
    }

    // Look for frequency patterns
    const frequencyPatterns = [
      /(?:take|use)\s+(?:one|two|three|1|2|3)\s+(?:time|tablet|capsule|pill)s?\s+(?:daily|per day|a day|every)/gi,
      /(\d+\s*(?:times?|x)\s*(?:daily|per day|a day))/gi,
      /(?:every\s+\d+\s*hours?)/gi,
      /(once|twice|three times)\s+(?:daily|a day|per day)/gi,
    ];
    let frequency = 'See label';
    for (const pattern of frequencyPatterns) {
      const match = text.match(pattern);
      if (match) {
        frequency = match[0];
        break;
      }
    }

    // Extract warnings
    const warningKeywords = ['warning', 'caution', 'do not', 'avoid', 'danger', 'not for', 'keep out'];
    const warnings: string[] = [];
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (warningKeywords.some(kw => lowerLine.includes(kw))) {
        warnings.push(line);
      }
    }

    // Extract side effects
    const sideEffectKeywords = ['side effect', 'may cause', 'drowsiness', 'dizziness', 'nausea', 'allergic'];
    const sideEffects: string[] = [];
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (sideEffectKeywords.some(kw => lowerLine.includes(kw))) {
        sideEffects.push(line);
      }
    }

    return {
      name,
      dosage,
      frequency,
      warnings: warnings.slice(0, 5), // Limit to 5 most important
      sideEffects: sideEffects.slice(0, 5),
    };
  };

  const handleCopy = useCallback(() => {
    if (!medication) return;

    const textToCopy = `${medication.name}\n\nDosage: ${medication.dosage}\nFrequency: ${medication.frequency}\n\n${medication.translatedText}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [medication]);

  const handleReset = useCallback(() => {
    setImageData(null);
    setMedication(null);
    setProcessing({ step: 'idle', message: '' });
  }, []);

  const getTargetLanguageName = (code: string): string => {
    const names: Record<string, string> = {
      sw: 'Swahili',
      so: 'Somali',
      ar: 'Arabic',
      ti: 'Tigrinya',
    };
    return names[code] || code;
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="section-header flex items-center gap-2">
          <Pill className="w-6 h-6" />
          Medication Safety
        </h1>
        <p className="text-sm text-daraja-500">
          Photograph a medication label to understand dosage and safety information
        </p>
      </div>

      {/* Safety Warning Banner */}
      <div className="p-4 rounded-xl bg-caution-50 border border-caution-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-caution-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-caution-700">Important Safety Notice</p>
            <p className="text-sm text-caution-600 mt-1">
              This tool provides translation assistance only. Always confirm medication
              instructions with a healthcare provider or pharmacist before use.
            </p>
          </div>
        </div>
      </div>

      {/* Language Selection */}
      <div className="card">
        <label className="form-label">Translate to</label>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="input-field"
        >
          <option value="sw">Swahili</option>
          <option value="so">Somali</option>
        </select>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Image capture/upload buttons */}
      {!imageData && processing.step === 'idle' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-daraja-700 uppercase tracking-wide">
            Photograph Medication Label
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleCameraCapture}
              className="btn-primary flex-col py-6"
            >
              <Camera className="w-8 h-8 mb-2" />
              <span>Take Photo</span>
            </button>

            <button
              onClick={handleUploadClick}
              className="btn-secondary flex-col py-6"
            >
              <Upload className="w-8 h-8 mb-2" />
              <span>Upload Image</span>
            </button>
          </div>

          <p className="text-xs text-daraja-400 text-center">
            For best results, photograph the label in good lighting with text clearly visible
          </p>
        </div>
      )}

      {/* Processing state */}
      {processing.step !== 'idle' && processing.step !== 'complete' && processing.step !== 'error' && (
        <div className="card flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-daraja-500 animate-spin mb-4" />
          <p className="text-daraja-600 font-medium">{processing.message}</p>
        </div>
      )}

      {/* Error state */}
      {processing.step === 'error' && (
        <div className="card space-y-4">
          <div className="p-4 rounded-xl bg-alert-50 border border-alert-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-alert-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-alert-700">Processing Error</p>
                <p className="text-sm text-alert-600 mt-1">{processing.message}</p>
              </div>
            </div>
          </div>

          <button onClick={handleReset} className="btn-primary w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      )}

      {/* Image preview */}
      {imageData && processing.step !== 'error' && (
        <div className="card">
          <img
            src={imageData}
            alt="Medication label"
            className="w-full rounded-lg object-contain max-h-48"
          />
        </div>
      )}

      {/* Results */}
      {medication && processing.step === 'complete' && (
        <div className="space-y-4 animate-slide-up">
          {/* Medication Name & Confidence */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-daraja-900">{medication.name}</h2>
              <ConfidenceBadge level={medication.confidenceLevel} score={medication.confidence} />
            </div>

            {/* Key Information Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-trust-50 border border-trust-200">
                <div className="flex items-center gap-2 mb-1">
                  <Pill className="w-4 h-4 text-trust-600" />
                  <span className="text-xs font-medium text-trust-700">Dosage</span>
                </div>
                <p className="text-sm font-semibold text-trust-800">{medication.dosage}</p>
              </div>

              <div className="p-3 rounded-lg bg-daraja-50 border border-daraja-200">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-daraja-600" />
                  <span className="text-xs font-medium text-daraja-700">Frequency</span>
                </div>
                <p className="text-sm font-semibold text-daraja-800">{medication.frequency}</p>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {medication.warnings.length > 0 && (
            <div className="card border-alert-200 bg-alert-50">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-alert-600" />
                <h3 className="font-semibold text-alert-700">Warnings</h3>
              </div>
              <ul className="space-y-2">
                {medication.warnings.map((warning, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-alert-700">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Side Effects */}
          {medication.sideEffects.length > 0 && (
            <div className="card border-caution-200 bg-caution-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-caution-600" />
                <h3 className="font-semibold text-caution-700">Possible Side Effects</h3>
              </div>
              <ul className="space-y-1">
                {medication.sideEffects.map((effect, i) => (
                  <li key={i} className="text-sm text-caution-700">• {effect}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Translated Full Text */}
          <div className="card">
            <h3 className="text-sm font-semibold text-daraja-700 uppercase tracking-wide mb-3">
              Full Translation ({getTargetLanguageName(targetLang)})
            </h3>
            <div className="p-4 rounded-lg bg-daraja-50 border border-daraja-200">
              <p className="text-daraja-800 whitespace-pre-wrap">{medication.translatedText}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleCopy} className="btn-secondary flex-1">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Information
                </>
              )}
            </button>

            <button onClick={handleReset} className="btn-ghost flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Scan Another
            </button>
          </div>

          {/* Verification Reminder */}
          {medication.confidenceLevel === 'low' && (
            <div className="p-4 rounded-xl bg-alert-50 border border-alert-200">
              <p className="text-sm text-alert-700">
                <strong>Low confidence translation.</strong> Please verify this information
                with a healthcare provider or pharmacist before taking this medication.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
