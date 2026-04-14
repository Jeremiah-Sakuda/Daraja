# Daraja

**Self-distilling translation for low-resource humanitarian language pairs**

Daraja (Swahili for "bridge") is a translation pipeline that creates offline-capable translation models for language pairs underserved by commercial translation services. It targets humanitarian use cases like refugee status determination interviews, medical intake, and legal documentation.

## The Problem

Millions of displaced people speak languages poorly served by existing translation tools. A Somali-speaking refugee meeting with a Swahili-speaking caseworker has no reliable translation option. Google Translate doesn't support direct Somali↔Swahili. Professional interpreters are scarce and expensive. Critical miscommunication happens.

## Our Approach

Daraja uses a self-distilling pipeline:

1. **Seed Collection** — Gather existing parallel corpora (OPUS, JW300, Flores-200)
2. **Synthetic Generation** — Use Gemma 31B to generate additional training pairs via back-translation and paraphrase augmentation
3. **Validation** — Filter generated pairs using semantic similarity (LaBSE embeddings)
4. **Distillation** — Fine-tune Gemma E4B using Unsloth QLoRA to create a compact, fast model
5. **Deployment** — Package for Ollama with offline-first PWA demo

## Target Language Pairs

| Source | Target | Status |
|--------|--------|--------|
| Somali | Swahili | 🔄 In Progress |
| Tigrinya | Arabic | Planned |
| Dari | Turkish | Planned |

## Repository Structure

```
daraja/
├── pipeline/          # Data generation & training notebooks
├── models/            # Ollama Modelfiles & quantization configs
├── workflows/         # Structured interview schemas (RSD, medical, legal)
├── app/               # React + Vite demo application
├── docs/              # Technical documentation
└── demo/              # Demo video assets
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.ai) installed locally

### Running the Demo App

```bash
cd app
npm install
npm run dev
```

### Running the Pipeline (Kaggle)

The pipeline notebooks are designed to run on Kaggle with GPU acceleration:

1. Upload notebooks from `pipeline/notebooks/` to Kaggle
2. Enable GPU accelerator (T4 or P100)
3. Run notebooks in sequence (01 → 05)

## Key Features

- **Confidence Routing** — Low-confidence translations are flagged for human review
- **Offline-First** — Works without internet after initial model download
- **Voice Input** — Speak directly in source language
- **Structured Workflows** — Pre-built forms for RSD interviews, medical intake
- **Bilingual Export** — Generate PDFs with source and target text side-by-side

## Evaluation

| Metric | Baseline (E4B) | Daraja | Improvement |
|--------|---------------|--------|-------------|
| BLEU | TBD | TBD | Target: +15 |
| chrF++ | TBD | TBD | — |

## Contributing

Contributions welcome, especially:
- Native speaker evaluation for translation quality
- Additional language pair support
- Accessibility improvements

## License

Apache 2.0 — See [LICENSE](LICENSE)

## Acknowledgments

- [Unsloth](https://github.com/unslothai/unsloth) for efficient fine-tuning
- [OPUS](https://opus.nlpl.eu/) for parallel corpora
- [Flores-200](https://github.com/facebookresearch/flores) for evaluation data
