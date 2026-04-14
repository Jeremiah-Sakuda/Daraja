/**
 * PDF Generation Utilities
 *
 * Generates bilingual PDF documents from completed interview sessions.
 * Uses jsPDF for client-side PDF generation.
 */

import type { WorkflowSession, WorkflowSchema } from '../services/workflow';
import type { ConfidenceLevel } from '../services/confidence';

// PDF configuration
export interface PDFConfig {
  pageSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fonts: {
    title: string;
    heading: string;
    body: string;
  };
  colors: {
    primary: string;
    secondary: string;
    text: string;
    muted: string;
    flagged: string;
    success: string;
    warning: string;
    danger: string;
  };
}

const DEFAULT_CONFIG: PDFConfig = {
  pageSize: 'a4',
  orientation: 'portrait',
  margins: {
    top: 40,
    right: 40,
    bottom: 40,
    left: 40,
  },
  fonts: {
    title: 'helvetica',
    heading: 'helvetica',
    body: 'helvetica',
  },
  colors: {
    primary: '#B45309',
    secondary: '#78350F',
    text: '#1F2937',
    muted: '#6B7280',
    flagged: '#FEF3C7',
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
  },
};

// Export data structure
export interface PDFExportData {
  workflow: WorkflowSchema;
  session: WorkflowSession;
  responses: Array<{
    sectionTitle: string;
    fieldLabel: string;
    sourceText: string;
    translatedText: string;
    confidence: number;
    confidenceLevel: ConfidenceLevel;
    flagged: boolean;
  }>;
  metadata: {
    exportedAt: string;
    languagePair: string;
    interviewDuration?: string;
  };
}

/**
 * Generate PDF from export data
 * Returns a blob containing the PDF file
 */
export async function generatePDF(
  data: PDFExportData,
  config: Partial<PDFConfig> = {}
): Promise<Blob> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Dynamically import jsPDF to reduce initial bundle size
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: cfg.orientation,
    unit: 'pt',
    format: cfg.pageSize,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - cfg.margins.left - cfg.margins.right;

  let yPosition = cfg.margins.top;

  // Helper functions
  const addPage = () => {
    doc.addPage();
    yPosition = cfg.margins.top;
    addPageHeader();
  };

  const checkPageBreak = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - cfg.margins.bottom) {
      addPage();
    }
  };

  const addPageHeader = () => {
    doc.setFontSize(8);
    doc.setTextColor(cfg.colors.muted);
    doc.text(
      `${data.workflow.name} - ${data.metadata.languagePair}`,
      cfg.margins.left,
      20
    );
    doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - cfg.margins.right - 30, 20);
  };

  // Title page
  doc.setFontSize(24);
  doc.setTextColor(cfg.colors.primary);
  doc.text(data.workflow.name, pageWidth / 2, yPosition + 40, { align: 'center' });

  yPosition += 70;
  doc.setFontSize(14);
  doc.setTextColor(cfg.colors.text);
  doc.text(data.workflow.description, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 60;
  doc.setFontSize(11);
  doc.setTextColor(cfg.colors.muted);

  const metadata = [
    `Language Pair: ${data.metadata.languagePair}`,
    `Session ID: ${data.session.id}`,
    `Started: ${formatDate(data.session.startedAt)}`,
    `Completed: ${data.session.completedAt ? formatDate(data.session.completedAt) : 'In Progress'}`,
    `Exported: ${formatDate(data.metadata.exportedAt)}`,
  ];

  for (const line of metadata) {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 18;
  }

  // Flags summary
  const flaggedCount = data.responses.filter((r) => r.flagged).length;
  if (flaggedCount > 0) {
    yPosition += 20;
    doc.setFillColor(cfg.colors.flagged);
    doc.roundedRect(cfg.margins.left, yPosition, contentWidth, 40, 4, 4, 'F');

    doc.setFontSize(11);
    doc.setTextColor(cfg.colors.warning);
    doc.text(
      `${flaggedCount} response(s) flagged for human review`,
      pageWidth / 2,
      yPosition + 25,
      { align: 'center' }
    );
  }

  // Start content on new page
  addPage();

  // Group responses by section
  const sections = new Map<string, typeof data.responses>();
  for (const response of data.responses) {
    const existing = sections.get(response.sectionTitle) || [];
    existing.push(response);
    sections.set(response.sectionTitle, existing);
  }

  // Render each section
  for (const [sectionTitle, responses] of sections) {
    checkPageBreak(60);

    // Section header
    doc.setFontSize(14);
    doc.setTextColor(cfg.colors.secondary);
    doc.text(sectionTitle, cfg.margins.left, yPosition);
    yPosition += 25;

    // Draw line under header
    doc.setDrawColor(cfg.colors.primary);
    doc.setLineWidth(1);
    doc.line(cfg.margins.left, yPosition, cfg.margins.left + contentWidth, yPosition);
    yPosition += 15;

    // Render each field
    for (const response of responses) {
      checkPageBreak(80);

      // Field background for flagged items
      if (response.flagged) {
        doc.setFillColor(cfg.colors.flagged);
        doc.roundedRect(
          cfg.margins.left - 5,
          yPosition - 5,
          contentWidth + 10,
          70,
          3,
          3,
          'F'
        );
      }

      // Field label with confidence indicator
      doc.setFontSize(10);
      doc.setTextColor(cfg.colors.muted);
      doc.text(response.fieldLabel, cfg.margins.left, yPosition);

      // Confidence badge
      const confidenceColor = getConfidenceColor(response.confidenceLevel, cfg);
      doc.setTextColor(confidenceColor);
      const confidenceText = `${Math.round(response.confidence * 100)}%`;
      doc.text(confidenceText, cfg.margins.left + contentWidth - 30, yPosition);

      yPosition += 15;

      // Source text (original language)
      doc.setFontSize(11);
      doc.setTextColor(cfg.colors.text);
      const sourceLines = doc.splitTextToSize(
        response.sourceText || '[No response]',
        contentWidth - 20
      );
      doc.text(sourceLines, cfg.margins.left + 10, yPosition);
      yPosition += sourceLines.length * 14 + 8;

      // Translation
      doc.setFontSize(11);
      doc.setTextColor(cfg.colors.primary);
      const translationLines = doc.splitTextToSize(
        response.translatedText || '[Translation pending]',
        contentWidth - 20
      );
      doc.text(translationLines, cfg.margins.left + 10, yPosition);
      yPosition += translationLines.length * 14 + 20;
    }

    yPosition += 10;
  }

  // Footer on last page
  yPosition = pageHeight - cfg.margins.bottom - 40;
  doc.setFontSize(8);
  doc.setTextColor(cfg.colors.muted);
  doc.text(
    'Generated by Daraja - Humanitarian Translation System',
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  doc.text(
    'Translations are machine-generated. Critical information should be verified by qualified interpreters.',
    pageWidth / 2,
    yPosition + 12,
    { align: 'center' }
  );

  // Return as blob
  return doc.output('blob');
}

/**
 * Generate and download PDF
 */
export async function downloadPDF(
  data: PDFExportData,
  filename?: string,
  config?: Partial<PDFConfig>
): Promise<void> {
  const blob = await generatePDF(data, config);

  const defaultFilename = `${data.workflow.id}_${data.session.id}_${formatDateForFilename(new Date())}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Prepare export data from workflow manager
 */
export function prepareExportData(
  workflow: WorkflowSchema,
  session: WorkflowSession,
  languagePairLabel: string
): PDFExportData {
  const responses: PDFExportData['responses'] = [];

  for (const section of workflow.sections) {
    for (const field of section.fields) {
      const response = session.responses.find((r) => r.fieldId === field.id);

      responses.push({
        sectionTitle: section.title,
        fieldLabel: field.label,
        sourceText: response?.sourceText || '',
        translatedText: response?.translatedText || '',
        confidence: response?.confidence || 0,
        confidenceLevel: response?.confidenceLevel || 'low',
        flagged: response?.confidenceLevel === 'low',
      });
    }
  }

  return {
    workflow,
    session,
    responses,
    metadata: {
      exportedAt: new Date().toISOString(),
      languagePair: languagePairLabel,
      interviewDuration: calculateDuration(session.startedAt, session.completedAt),
    },
  };
}

// Helper functions

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDuration(start: string, end?: string): string | undefined {
  if (!end) return undefined;

  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

function getConfidenceColor(level: ConfidenceLevel, cfg: PDFConfig): string {
  switch (level) {
    case 'high':
      return cfg.colors.success;
    case 'medium':
      return cfg.colors.warning;
    case 'low':
      return cfg.colors.danger;
  }
}

/**
 * Print PDF directly
 */
export async function printPDF(
  data: PDFExportData,
  config?: Partial<PDFConfig>
): Promise<void> {
  const blob = await generatePDF(data, config);
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;

  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  document.body.appendChild(iframe);
}

/**
 * Generate PDF summary (single page overview)
 */
export async function generateSummaryPDF(
  data: PDFExportData,
  config?: Partial<PDFConfig>
): Promise<Blob> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: cfg.pageSize,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = cfg.margins.top;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(cfg.colors.primary);
  doc.text(`${data.workflow.name} - Summary`, pageWidth / 2, yPosition, {
    align: 'center',
  });

  yPosition += 40;

  // Session info
  doc.setFontSize(10);
  doc.setTextColor(cfg.colors.muted);
  doc.text(`Session: ${data.session.id}`, cfg.margins.left, yPosition);
  doc.text(`Language: ${data.metadata.languagePair}`, cfg.margins.left + 200, yPosition);

  yPosition += 30;

  // Statistics
  const totalFields = data.responses.length;
  const completedFields = data.responses.filter((r) => r.sourceText.trim()).length;
  const flaggedFields = data.responses.filter((r) => r.flagged).length;
  const avgConfidence =
    data.responses.reduce((sum, r) => sum + r.confidence, 0) / totalFields;

  doc.setFontSize(11);
  doc.setTextColor(cfg.colors.text);

  const stats = [
    `Total Fields: ${totalFields}`,
    `Completed: ${completedFields} (${Math.round((completedFields / totalFields) * 100)}%)`,
    `Flagged for Review: ${flaggedFields}`,
    `Average Confidence: ${Math.round(avgConfidence * 100)}%`,
  ];

  for (const stat of stats) {
    doc.text(stat, cfg.margins.left, yPosition);
    yPosition += 18;
  }

  // Flagged items list
  if (flaggedFields > 0) {
    yPosition += 20;
    doc.setFontSize(12);
    doc.setTextColor(cfg.colors.warning);
    doc.text('Items Requiring Review:', cfg.margins.left, yPosition);
    yPosition += 20;

    doc.setFontSize(10);
    doc.setTextColor(cfg.colors.text);

    for (const response of data.responses.filter((r) => r.flagged)) {
      doc.text(`• ${response.fieldLabel}`, cfg.margins.left + 10, yPosition);
      yPosition += 15;
    }
  }

  return doc.output('blob');
}
