# Model Quantization Guide

This document describes how to quantize Daraja translation models for deployment with Ollama.

## Overview

Daraja models are fine-tuned from Gemma and exported to GGUF format for use with Ollama. We use quantization to reduce model size while maintaining translation quality.

## Recommended Quantization Levels

| Quantization | Size (approx.) | Quality | Use Case |
|--------------|----------------|---------|----------|
| `q8_0` | ~9 GB | Highest | Development, evaluation |
| `q5_k_m` | ~6 GB | High | Recommended for production |
| `q4_k_m` | ~5 GB | Good | Resource-constrained devices |
| `q4_0` | ~4 GB | Acceptable | Minimum viable quality |

## Quantization Process

### Using Unsloth (Recommended)

During training, Unsloth can export directly to GGUF:

```python
from unsloth import FastLanguageModel

# After training
model.save_pretrained_gguf(
    "daraja-somali-swahili",
    tokenizer,
    quantization_method="q4_k_m"  # or q5_k_m, q8_0
)
```

### Using llama.cpp

If you have a saved model in HuggingFace format:

```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build
make

# Convert to GGUF
python convert.py /path/to/daraja-model --outfile daraja.gguf --outtype f16

# Quantize
./quantize daraja.gguf daraja-q4_k_m.gguf q4_k_m
```

## Creating Ollama Model

Once you have a GGUF file:

```bash
# Copy the GGUF to the modelfiles directory
cp daraja-somali-swahili-q4_k_m.gguf models/modelfiles/daraja-somali-swahili.gguf

# Create the Ollama model
cd models/modelfiles
ollama create daraja-so-sw -f daraja-somali-swahili.Modelfile

# Verify
ollama run daraja-so-sw "Translate the following Somali to Swahili: Waxaan rabaa inaan tago dhakhtar"
```

## Quantization Benchmarks

Performance measured on sample translation tasks:

### Somali → Swahili (100 sentences)

| Quantization | BLEU | chrF++ | Latency (avg) |
|--------------|------|--------|---------------|
| f16 (baseline) | TBD | TBD | TBD |
| q8_0 | TBD | TBD | TBD |
| q5_k_m | TBD | TBD | TBD |
| q4_k_m | TBD | TBD | TBD |

*Benchmarks will be updated after model training.*

## Memory Requirements

Minimum RAM requirements for running models:

| Quantization | Minimum RAM | Recommended RAM |
|--------------|-------------|-----------------|
| q8_0 | 12 GB | 16 GB |
| q5_k_m | 8 GB | 12 GB |
| q4_k_m | 6 GB | 8 GB |
| q4_0 | 5 GB | 6 GB |

## Quality Considerations

### When to use higher quantization (q8_0, q5_k_m)

- Legal document translation
- Medical terminology
- When flagging low-confidence segments
- Evaluation and benchmarking

### When lower quantization is acceptable (q4_k_m)

- General conversation translation
- Initial screening interviews
- Resource-constrained deployments
- Mobile/offline use cases

## Troubleshooting

### Model too slow

- Try a lower quantization level
- Reduce context length in Modelfile (`num_ctx`)
- Ensure GPU acceleration is enabled

### Translation quality degraded

- Use higher quantization (q5_k_m or q8_0)
- Check if domain-specific terminology is affected
- Compare against f16 baseline

### Out of memory

- Use lower quantization
- Reduce batch size in application
- Close other applications

## References

- [llama.cpp quantization docs](https://github.com/ggerganov/llama.cpp#quantization)
- [GGUF format specification](https://github.com/ggerganov/ggml/blob/master/docs/gguf.md)
- [Ollama Modelfile reference](https://github.com/ollama/ollama/blob/main/docs/modelfile.md)
