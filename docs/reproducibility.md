# Reproducibility Guide

This guide provides step-by-step instructions to reproduce the Daraja translation pipeline and demo application.

## Prerequisites

### Hardware Requirements

**For Training (Kaggle):**
- Kaggle account with GPU quota
- T4 or P100 GPU (minimum 16GB RAM)

**For Demo Application:**
- Modern computer (8GB+ RAM recommended)
- [Ollama](https://ollama.ai) installed

### Software Requirements

- Python 3.10+
- Node.js 18+
- Git

## Step 1: Clone Repository

```bash
git clone https://github.com/jeremiah-sakuda/daraja.git
cd daraja
```

## Step 2: Run Pipeline Notebooks

Upload the notebooks from `pipeline/notebooks/` to Kaggle and run in sequence:

### 2.1 Seed Data Collection

**Notebook:** `01_seed_data_collection.ipynb`

**What it does:**
- Downloads OPUS parallel corpora
- Downloads Flores-200 benchmark data
- Deduplicates and cleans data
- Saves to `pipeline/data/seed/`

**Expected output:**
- ~15,000 Somali-Swahili parallel pairs
- Corpus statistics JSON

**Estimated time:** 15-30 minutes

### 2.2 Synthetic Corpus Generation

**Notebook:** `02_synthetic_corpus_generation.ipynb`

**What it does:**
- Loads Gemma 31B teacher model
- Generates back-translation pairs
- Generates domain-specific dialogues
- Logs all generation for reproducibility

**Expected output:**
- ~50,000 synthetic parallel pairs
- Generation log (JSONL)

**Estimated time:** 4-6 hours (with GPU)

### 2.3 Corpus Validation

**Notebook:** `03_corpus_validation.ipynb`

**What it does:**
- Loads LaBSE embedding model
- Computes semantic similarity for all pairs
- Filters pairs below threshold (0.75)
- Generates validation report

**Expected output:**
- Filtered corpus (~40,000 pairs)
- Validation report JSON

**Estimated time:** 1-2 hours

### 2.4 Unsloth Fine-tuning

**Notebook:** `04_unsloth_finetuning.ipynb`

**What it does:**
- Loads Gemma 9B with QLoRA adapters
- Fine-tunes on validated corpus
- Exports to GGUF format

**Expected output:**
- Fine-tuned model weights
- GGUF quantized model
- Ollama Modelfile

**Estimated time:** 2-4 hours (with GPU)

### 2.5 Evaluation

**Notebook:** `05_evaluation.ipynb`

**What it does:**
- Evaluates on Flores-200 devtest
- Computes BLEU, chrF++
- Compares against baseline
- Generates evaluation report

**Expected output:**
- Evaluation results JSON
- Markdown report

**Estimated time:** 30-60 minutes

## Step 3: Set Up Ollama

### Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### Load Daraja Model

```bash
# Copy GGUF and Modelfile to models directory
cd models/modelfiles

# Create Ollama model
ollama create daraja-so-sw -f daraja-somali-swahili.Modelfile

# Verify
ollama list
```

### Test Translation

```bash
ollama run daraja-so-sw "Translate the following Somali to Swahili: Waxaan rabaa caafimaad"
```

## Step 4: Run Demo Application

### Install Dependencies

```bash
cd app
npm install
```

### Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Verify Functionality

1. **Ollama Connection**: Check header shows "Online"
2. **Voice Input**: Click microphone, speak, verify recording
3. **Translation**: Enter text, click translate, verify response
4. **Confidence**: Verify confidence badges appear

## Step 5: Build for Production

```bash
cd app
npm run build
```

The built files will be in `app/dist/`.

## Troubleshooting

### Pipeline Issues

**"Out of GPU memory"**
- Reduce batch size in training config
- Use smaller teacher model
- Clear Kaggle session and restart

**"OPUS download failed"**
- Check internet connection
- Try alternative corpus source
- Some pairs may have limited data

**"LaBSE loading error"**
- Ensure sentence-transformers installed
- Check HuggingFace cache

### Application Issues

**"Cannot connect to Ollama"**
- Ensure Ollama is running (`ollama serve`)
- Check port 11434 is accessible
- Verify model is loaded (`ollama list`)

**"Translation returns empty"**
- Check Ollama logs for errors
- Verify model loaded correctly
- Try simpler input text

**"Voice recording not working"**
- Use HTTPS (required for MediaRecorder)
- Grant microphone permissions
- Check browser compatibility

## Verification Checklist

- [ ] All 5 notebooks run without errors
- [ ] Validated corpus has >40,000 pairs
- [ ] Fine-tuned model achieves >15 BLEU improvement
- [ ] Ollama model loads and responds
- [ ] Demo app starts without errors
- [ ] Voice recording captures audio
- [ ] Translation returns with confidence scores
- [ ] App works offline after initial load

## Data Checksums

After running the pipeline, verify data integrity:

```bash
# Example checksums (update with actual values)
md5sum pipeline/data/seed/so-sw/seed.so
# Expected: [TBD]

md5sum pipeline/data/synthetic/so-sw/validated/synthetic_filtered.so
# Expected: [TBD]
```

## Environment Specifications

**Tested on:**
- Kaggle: Python 3.10, PyTorch 2.1, T4 GPU
- Local: Node.js 20, macOS Sonoma / Windows 11
- Ollama: v0.3.x

## Contact

For reproducibility issues, please open a GitHub issue with:
- Notebook/step where error occurred
- Full error message
- Hardware/software versions
