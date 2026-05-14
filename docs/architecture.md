# Daraja System Architecture

## Overview

Daraja is a self-distilling translation pipeline designed for low-resource humanitarian language pairs. The system uses large language models to generate synthetic parallel data, which is then used to fine-tune a smaller, deployable model.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DARAJA ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: DATA COLLECTION                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │    NLLB     │    │  Masakhane  │    │ Flores-200  │                      │
│  │  (parallel) │    │  (African)  │    │ (benchmark) │                      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                      │
│         │                  │                  │                              │
│         └──────────────────┼──────────────────┘                              │
│                            ▼                                                 │
│                  ┌─────────────────────┐                                     │
│                  │    Seed Corpus      │                                     │
│                  │  (~15-50K pairs)    │                                     │
│                  └─────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: SYNTHETIC GENERATION                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                     ┌───────────────────┐                                    │
│                     │   Gemma 31B IT    │                                    │
│                     │  (Teacher Model)  │                                    │
│                     └─────────┬─────────┘                                    │
│                               │                                              │
│          ┌────────────────────┼────────────────────┐                         │
│          ▼                    ▼                    ▼                         │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                   │
│  │    Back-      │   │   Paraphrase  │   │   Domain      │                   │
│  │  Translation  │   │  Augmentation │   │   Dialogue    │                   │
│  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘                   │
│          │                   │                   │                           │
│          └───────────────────┼───────────────────┘                           │
│                              ▼                                               │
│                  ┌─────────────────────┐                                     │
│                  │   Synthetic Corpus  │                                     │
│                  │   (~50-100K pairs)  │                                     │
│                  └─────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: VALIDATION                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐      ┌─────────────────────┐                        │
│  │   Synthetic Corpus  │─────▶│   LaBSE Embeddings  │                        │
│  └─────────────────────┘      └──────────┬──────────┘                        │
│                                          │                                   │
│                                          ▼                                   │
│                               ┌─────────────────────┐                        │
│                               │  Semantic Similarity │                       │
│                               │     Filtering        │                       │
│                               │   (threshold: 0.75)  │                       │
│                               └──────────┬──────────┘                        │
│                                          │                                   │
│                                          ▼                                   │
│                               ┌─────────────────────┐                        │
│                               │   Validated Corpus  │                        │
│                               └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: DISTILLATION                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐      ┌─────────────────────┐                        │
│  │  Validated Corpus   │─────▶│    Gemma E4B        │                        │
│  │  + Domain Tags      │      │   (Student Model)   │                        │
│  └─────────────────────┘      └──────────┬──────────┘                        │
│                                          │                                   │
│                                          ▼                                   │
│                               ┌─────────────────────┐                        │
│                               │   Unsloth QLoRA     │                        │
│                               │   Fine-tuning       │                        │
│                               └──────────┬──────────┘                        │
│                                          │                                   │
│                                          ▼                                   │
│                               ┌─────────────────────┐                        │
│                               │  Daraja Model       │                        │
│                               │  (GGUF q4_k_m)      │                        │
│                               └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 5: DEPLOYMENT                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐                                                     │
│  │    Ollama Server    │◀─────────────────────────┐                          │
│  │  (Local Inference)  │                          │                          │
│  └──────────┬──────────┘                          │                          │
│             │                                     │                          │
│             ▼                                     │                          │
│  ┌─────────────────────────────────────────────────────────┐                 │
│  │                    DARAJA WEB APP                        │                │
│  │  ┌─────────────────────────────────────────────────────┐ │                │
│  │  │                                                     │ │                │
│  │  │   ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │ │                │
│  │  │   │  Voice   │  │ Document │  │   Translation    │ │ │                │
│  │  │   │  Input   │  │ Capture  │  │   Display        │ │ │                │
│  │  │   └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │ │                │
│  │  │        │             │                 │           │ │                │
│  │  │        └─────────────┼─────────────────┘           │ │                │
│  │  │                      ▼                             │ │                │
│  │  │          ┌─────────────────────┐                   │ │                │
│  │  │          │  Confidence Router  │                   │ │                │
│  │  │          │  (High/Med/Low)     │                   │ │                │
│  │  │          └─────────────────────┘                   │ │                │
│  │  │                                                     │ │                │
│  │  └─────────────────────────────────────────────────────┘ │                │
│  │                                                          │                │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │                │
│  │  │  IndexedDB  │  │   Service   │  │    PWA      │       │                │
│  │  │  (Offline)  │  │   Worker    │  │  Manifest   │       │                │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │                │
│  └──────────────────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Data Collection Pipeline

**Purpose:** Gather existing parallel corpora to bootstrap the translation system.

**Components:**
- `SeedDataLoader` - Unified interface for loading from multiple sources
- OPUS API integration for NLLB, WikiMatrix, Masakhane
- HuggingFace Datasets integration for Flores-200
- Religious content filtering (JW300 explicitly excluded)

**Output:** Deduplicated parallel text files (~15-50K pairs per language pair)

### 2. Synthetic Generation Pipeline

**Purpose:** Expand training data using a large teacher model.

**Components:**
- `GemmaTranslationModel` - Wrapper for Gemma 31B inference
- `CorpusGenerator` - Orchestrates generation methods
- Back-translation module
- Paraphrase augmentation module
- Domain dialogue generator

**Output:** Synthetic parallel corpus with generation logs for reproducibility

### 3. Validation Pipeline

**Purpose:** Filter synthetic data to ensure quality.

**Components:**
- `EmbeddingModel` - LaBSE multilingual embeddings
- `CorpusValidator` - Semantic similarity filtering
- Quality scoring and reporting

**Output:** Filtered corpus with quality scores and validation report

### 4. Distillation Pipeline

**Purpose:** Transfer translation capabilities to a deployable model.

**Components:**
- `UnslothTrainer` - Efficient QLoRA fine-tuning
- Domain-tagged training data formatter
- GGUF export for Ollama

**Output:** Quantized model ready for local deployment

### 5. Demo Application

**Purpose:** Provide offline-capable translation interface.

**Components:**
- React + Vite frontend
- Voice input with Web Audio API
- Ollama API client
- Confidence routing system
- IndexedDB for offline storage
- PWA service worker

## Data Flow

```
User Input (Voice/Text)
        │
        ▼
┌───────────────────┐
│ Transcription     │ (if voice)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Ollama API        │
│ (Daraja Model)    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Confidence        │
│ Scoring           │
└────────┬──────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ High  │ │ Low   │
│ Conf. │ │ Conf. │
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
Display    Flag for
directly   review
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| ML Training | Unsloth, PyTorch, Transformers |
| Embeddings | sentence-transformers, LaBSE |
| Inference | Ollama, GGUF quantization |
| Frontend | React, Vite, TailwindCSS |
| Offline | IndexedDB, Service Workers |
| Data | HuggingFace Datasets, OPUS |

## Security Considerations

- All model inference runs locally (no data leaves device)
- Session data stored in IndexedDB (encrypted at rest by browser)
- No personal data transmitted to external servers
- HTTPS required for PWA installation
