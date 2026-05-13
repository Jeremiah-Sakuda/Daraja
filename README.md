# Daraja

**Self-distilling translation for low-resource humanitarian language pairs**

Daraja (Swahili for "bridge") is a translation pipeline that creates offline-capable translation models for language pairs underserved by commercial translation services. It targets humanitarian use cases like refugee status determination interviews, medical intake, and legal documentation.

## The Problem

Millions of displaced people speak languages poorly served by existing translation tools. A Somali-speaking refugee meeting with a Swahili-speaking caseworker has no reliable translation option. Google Translate doesn't support direct Somali↔Swahili. Professional interpreters are scarce and expensive. Critical miscommunication happens.

## Our Approach

Daraja uses a fine-tuning pipeline:

1. **Data Collection** — NLLB parallel corpus (630K Somali-Swahili pairs from OPUS)
2. **Filtering** — Remove religious content, length outliers, bad ratios (281K pairs retained)
3. **Training** — Fine-tune Gemma 4 E2B using QLoRA (50K pairs, 2 epochs)
4. **Quantization** — Convert to Q4_K_M GGUF for efficient inference
5. **Deployment** — Package for Ollama with offline-first PWA demo

## Target Language Pairs

| Source | Target | Model | Status |
|--------|--------|-------|--------|
| Somali | Swahili | `daraja-so-sw` | ✅ Trained |
| Tigrinya | Arabic | — | 🔮 Planned |
| Dari | Turkish | — | 🔮 Planned |

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

**Somali → Swahili (daraja-so-sw)**

| Domain | chrF++ | Empty Output Rate | Notes |
|--------|--------|-------------------|-------|
| Medical | 44.4 | 10% | ✅ Demo-ready |
| Legal | 38.3 | 50% | ⚠️ High variance |
| Educational | 16.9 | 70% | ❌ Vocabulary gap |
| **Overall** | **33.4** | **43%** | |

**Model:** Gemma 4 E2B fine-tuned with QLoRA (r=32, alpha=64)
**Training:** 50K filtered NLLB pairs, 2 epochs, final loss 1.67
**Quantization:** Q4_K_M GGUF (3.4 GB)

See [DEV_LOG.md](DEV_LOG.md) for detailed diagnostics on the educational domain gap.

## Known Limitations

1. **Unidirectional only** — Somali→Swahili works; Swahili→Somali requires separate model
2. **Educational vocabulary gap** — Words like `macalinka` (teacher), `fasalka` (grade) return empty outputs due to NLLB corpus bias
3. **43% empty output rate** — Significant failure rate on legal/educational queries
4. **Medical domain strongest** — Use for clinic intake, symptom description; other domains need augmentation

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
