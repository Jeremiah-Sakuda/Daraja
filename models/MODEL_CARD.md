---
language:
- so
- sw
license: apache-2.0
library_name: transformers
tags:
- translation
- somali
- swahili
- humanitarian
- low-resource
- qlora
datasets:
- opus-100
- nllb
base_model: google/gemma-2-2b
---

# daraja-so-sw

**Somali → Swahili translation model for humanitarian contexts**

## Model Description

daraja-so-sw is a fine-tuned translation model designed specifically for humanitarian use cases involving Somali-speaking refugees and Swahili-speaking service providers. It prioritizes semantic accuracy over n-gram overlap in domains like medical intake, legal consultation, and social services.

- **Base Model:** Gemma 2 2B (4-bit quantized)
- **Fine-tuning:** QLoRA (r=32, α=64)
- **Training Data:** 50K filtered NLLB parallel sentences
- **Quantization:** Q4_K_M GGUF (3.4 GB)
- **Inference:** Ollama-compatible

## Intended Uses

### Primary Use Cases
- Medical intake interviews (symptom description, medication instructions)
- Legal consultation (refugee status determination, rights explanation)
- Social services (housing, education enrollment)
- Emergency communication

### Out-of-Scope Uses
- Literary translation
- Commercial content localization
- Real-time interpretation without human oversight
- Any use where translation errors could cause physical harm without verification

## Training Data

**Source:** NLLB parallel corpus via OPUS (630K initial pairs)

**Filtering Pipeline:**
1. Removed religious/proselytizing content (regex patterns)
2. Removed length outliers (>100 tokens)
3. Removed bad length ratios (>3:1 or <1:3)
4. Final dataset: 281K pairs → 50K sampled for training

**Domain Distribution (estimated):**
- Conversational: ~40%
- News/formal: ~35%
- Religious (removed): ~20%
- Technical: ~5%

## Training Procedure

- **Framework:** Unsloth + PEFT
- **Hardware:** Kaggle T4 GPU (16GB)
- **Epochs:** 2
- **Batch Size:** 4 (gradient accumulation: 4)
- **Learning Rate:** 2e-4
- **LoRA Rank:** 32
- **LoRA Alpha:** 64
- **Final Training Loss:** 1.67

**Prompt Format:**
```
Translate Somali to Swahili:
{somali_text}
Swahili:
```

## Evaluation Results

**Humanitarian Evaluation Set (30 sentences across 3 domains)**

| Domain | chrF++ | Empty Rate | Notes |
|--------|--------|------------|-------|
| Medical | 44.4 | 10% | Best domain |
| Legal | 38.3 | 50% | Moderate |
| Educational | 16.9 | 70% | Vocabulary gap |
| **Overall** | **33.4** | **43%** | |

### Comparison with NLLB-200

| Metric | NLLB-200 | daraja-so-sw |
|--------|----------|--------------|
| chrF++ | 75.5 | 33.4 |
| Empty Rate | 0% | 43% |
| Semantic Accuracy | Poor | Good |

**Key Finding:** NLLB-200's high chrF++ score masks critical semantic errors:
- "My child has a fever" → NLLB: "My child is very bad" ❌
- "My child has a fever" → Daraja: "My child has a fever" ✅

For humanitarian contexts, semantic accuracy matters more than character overlap.

## Limitations

1. **High empty output rate (43%)** on vocabulary outside NLLB training distribution
2. **Educational domain weakness** due to corpus bias (NLLB lacks school-related content)
3. **Unidirectional** — Swahili→Somali requires separate model or base Gemma
4. **No dialect handling** — Trained on standard Somali; dialectal variation untested
5. **Context window** — Single sentences only; no document-level coherence

## Ethical Considerations

### Risks
- **Over-reliance:** Users may trust machine translation without verification
- **Medical/legal stakes:** Translation errors in these domains can have serious consequences
- **Representation:** Model may not represent all Somali dialects equally

### Mitigations
- Built-in confidence scoring with visual warnings for low-confidence outputs
- UI prominently displays "verify with qualified interpreter" notices
- Designed for human-in-the-loop workflows, not autonomous operation

### Intended Deployment Context
This model is designed for use by humanitarian organizations with professional interpreter oversight. It is NOT intended as a replacement for qualified human interpreters in high-stakes situations.

## How to Use

### With Ollama
```bash
# Create model from Modelfile
ollama create daraja-so-sw -f Modelfile

# Run translation
ollama run daraja-so-sw "Translate Somali to Swahili:
Ilmahaygu wuu xummadaa
Swahili:"
```

### Modelfile
```
FROM gemma:2b
ADAPTER ./daraja-so-sw-lora.gguf
PARAMETER temperature 0
PARAMETER top_p 0.9
PARAMETER num_predict 100
PARAMETER stop "\n"
```

## Citation

```bibtex
@software{daraja2026,
  title={Daraja: Self-distilling Translation for Low-Resource Humanitarian Language Pairs},
  author={Sakuda, Jeremiah},
  year={2026},
  url={https://github.com/Jeremiah-Sakuda/Daraja}
}
```

## Acknowledgments

- [Unsloth](https://github.com/unslothai/unsloth) for efficient fine-tuning
- [OPUS/NLLB](https://opus.nlpl.eu/) for parallel corpora
- [Ollama](https://ollama.ai) for local inference runtime
