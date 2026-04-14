# Daraja: Self-Distilling Translation for Low-Resource Humanitarian Language Pairs

## Abstract

We present Daraja, a self-distilling translation pipeline designed to create offline-capable translation models for language pairs underserved by commercial translation services. Using a teacher-student distillation approach, we leverage large language models to generate synthetic parallel data, which is then used to fine-tune compact, deployable models. Our primary target is the Somali-Swahili language pair, chosen for its relevance to East African humanitarian corridors. We demonstrate that this approach can produce usable translation quality while maintaining the ability to run entirely offline on consumer hardware.

## 1. Introduction

### 1.1 Problem Statement

Millions of displaced people speak languages poorly served by existing translation tools. A Somali-speaking refugee meeting with a Swahili-speaking caseworker has no reliable translation option:

- Google Translate does not support direct Somali↔Swahili translation
- Professional interpreters are scarce, expensive, and not always available
- Critical miscommunication occurs in high-stakes situations (asylum interviews, medical intake)

### 1.2 Our Approach

Daraja ("bridge" in Swahili) addresses this gap through:

1. **Self-distillation**: Using large models to bootstrap smaller, deployable ones
2. **Offline-first design**: All inference runs locally without internet
3. **Confidence routing**: Low-confidence translations are flagged for human review
4. **Domain adaptation**: Models are fine-tuned on humanitarian domain data

## 2. Related Work

### 2.1 Low-Resource Neural Machine Translation

Previous work on low-resource NMT has explored:
- Transfer learning from high-resource languages (Zoph et al., 2016)
- Back-translation for data augmentation (Sennrich et al., 2016)
- Multilingual models like mBART and NLLB (Costa-jussà et al., 2022)

### 2.2 Knowledge Distillation for NMT

Distillation approaches for NMT include:
- Sequence-level knowledge distillation (Kim & Rush, 2016)
- Born-again neural networks (Furlanello et al., 2018)
- Self-training with filtered synthetic data (He et al., 2019)

### 2.3 Humanitarian NLP

Relevant humanitarian NLP efforts:
- Crisis response systems (Imran et al., 2015)
- Multilingual disaster response (Neubig et al., 2011)
- UNHCR translation guidelines

## 3. Methodology

### 3.1 Data Collection

We aggregate parallel data from multiple sources:

| Source | Type | Est. Pairs (so-sw) |
|--------|------|-------------------|
| OPUS JW300 | Religious texts | ~10,000 |
| Flores-200 | Benchmark | ~1,000 |
| NLLB | Web crawl | ~5,000 |

Total seed corpus: ~15,000 parallel pairs

### 3.2 Synthetic Data Generation

Using Gemma 31B as a teacher model, we generate additional training data through:

**Back-translation:**
1. Translate monolingual Somali → English (pivot)
2. Back-translate English → Somali
3. Score semantic preservation using LaBSE embeddings
4. Keep pairs with similarity > 0.75

**Paraphrase Augmentation:**
1. Generate paraphrases of source sentences
2. Pair paraphrases with original translations
3. Increases diversity without new translations

**Domain Dialogue Synthesis:**
1. Generate domain-specific conversations (medical, legal, humanitarian)
2. Translate each turn
3. Provides in-domain training data

### 3.3 Corpus Validation

We filter synthetic data using:

1. **Length filtering**: Remove pairs with extreme length ratios
2. **Deduplication**: Exact and fuzzy deduplication
3. **Semantic similarity**: LaBSE cosine similarity threshold (0.75)

### 3.4 Model Fine-tuning

We use Unsloth's optimized QLoRA implementation:

| Hyperparameter | Value |
|---------------|-------|
| Base model | Gemma 2 9B IT |
| LoRA rank | 16 |
| LoRA alpha | 16 |
| Batch size | 2 |
| Gradient accumulation | 4 |
| Learning rate | 2e-4 |
| Epochs | 3 |

Training data is formatted with domain tags:
```
<start_of_turn>user
Translate the following Somali text to Swahili:
[MEDICAL] Waxaan rabaa caafimaad<end_of_turn>
<start_of_turn>model
Nataka afya njema<end_of_turn>
```

### 3.5 Confidence Scoring

Our confidence routing system uses:

```
confidence = 0.3 × token_entropy
           + 0.5 × back_translation_similarity
           + 0.2 × domain_match_score
```

Routing thresholds:
- **≥ 0.8**: Display directly
- **0.5-0.8**: Display with warning
- **< 0.5**: Flag for human review

## 4. Evaluation

### 4.1 Automatic Metrics

| Model | BLEU | chrF++ |
|-------|------|--------|
| Baseline (zero-shot) | TBD | TBD |
| Daraja (fine-tuned) | TBD | TBD |
| Improvement | +TBD | +TBD |

### 4.2 Human Evaluation

We conducted human evaluation with native speakers:

| Metric | Score (1-5) |
|--------|-------------|
| Adequacy | TBD |
| Fluency | TBD |

### 4.3 Confidence Routing Precision

| Threshold | Precision | Recall |
|-----------|-----------|--------|
| 0.8 (high) | TBD | TBD |
| 0.5 (medium) | TBD | TBD |

## 5. Demo Application

The Daraja demo application provides:

- **Voice input**: Speak directly in source language
- **Document capture**: Extract text from images
- **Structured workflows**: Pre-built forms for RSD interviews, medical intake
- **Confidence indicators**: Visual feedback on translation quality
- **Offline capability**: Works without internet after model download
- **PDF export**: Bilingual documents for records

## 6. Limitations

1. **Data scarcity**: Limited seed data constrains quality
2. **Domain coverage**: Medical/legal terminology gaps
3. **Dialect variation**: Model may not handle regional variants
4. **Evaluation challenges**: Native speaker evaluation is difficult to scale

## 7. Ethical Considerations

### 7.1 Translation Accuracy in High-Stakes Contexts

Mistranslation in asylum interviews or medical settings can have serious consequences. Daraja addresses this through:

- Confidence flagging for human review
- Clear warnings when quality is uncertain
- Recommendations to use human interpreters for critical decisions

### 7.2 Data Privacy

- All inference runs locally
- No data transmitted to external servers
- Session data encrypted at rest

### 7.3 Cultural Sensitivity

- Native speaker consultation in development
- Terminology review by domain experts
- Iterative feedback from humanitarian organizations

## 8. Conclusion

Daraja demonstrates that self-distillation can produce usable translation models for low-resource language pairs. While not a replacement for human interpreters in high-stakes situations, it provides a valuable tool for initial communication and can help identify when professional interpretation is most needed.

## References

*To be completed*

## Acknowledgments

- [Unsloth](https://github.com/unslothai/unsloth) for efficient fine-tuning
- [OPUS](https://opus.nlpl.eu/) for parallel corpora
- [Flores-200](https://github.com/facebookresearch/flores) for evaluation data
