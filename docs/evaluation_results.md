# Daraja Evaluation Results

*Results to be populated after model training*

## Summary

| Metric | Baseline | Daraja | Improvement |
|--------|----------|--------|-------------|
| BLEU | TBD | TBD | TBD |
| chrF++ | TBD | TBD | TBD |
| Round-trip BLEU | TBD | TBD | TBD |

## Evaluation Setup

**Test Set:** Flores-200 devtest (1012 sentences)

**Language Pair:** Somali (so) → Swahili (sw)

**Baselines:**
- Gemma 2 9B IT (zero-shot)
- NLLB-200 (if supported)

## Detailed Results

### Automatic Metrics

#### BLEU Scores

| Domain | Baseline | Daraja |
|--------|----------|--------|
| General | TBD | TBD |
| Medical | TBD | TBD |
| Legal | TBD | TBD |

#### chrF++ Scores

| Domain | Baseline | Daraja |
|--------|----------|--------|
| General | TBD | TBD |
| Medical | TBD | TBD |
| Legal | TBD | TBD |

### Human Evaluation

**Evaluators:** [Number] native speakers

**Scale:** 1-5 (5 = excellent)

| Metric | Score | Std Dev |
|--------|-------|---------|
| Adequacy | TBD | TBD |
| Fluency | TBD | TBD |

### Confidence Routing Performance

| Threshold | Precision | Recall | F1 |
|-----------|-----------|--------|-----|
| High (≥0.8) | TBD | TBD | TBD |
| Medium (0.5-0.8) | TBD | TBD | TBD |
| Low (<0.5) | TBD | TBD | TBD |

## Example Translations

### High Confidence Example

**Source (Somali):** TBD

**Reference (Swahili):** TBD

**Daraja Output:** TBD

**Confidence:** TBD

### Medium Confidence Example

**Source (Somali):** TBD

**Reference (Swahili):** TBD

**Daraja Output:** TBD

**Confidence:** TBD

**Flag Reason:** TBD

### Low Confidence Example

**Source (Somali):** TBD

**Reference (Swahili):** TBD

**Daraja Output:** TBD

**Confidence:** TBD

**Flag Reason:** TBD

## Ablation Studies

### Effect of Back-Translation Filtering

| Configuration | BLEU |
|--------------|------|
| No filtering | TBD |
| Threshold 0.5 | TBD |
| Threshold 0.75 | TBD |
| Threshold 0.9 | TBD |

### Effect of Domain Tags

| Configuration | General | Medical | Legal |
|--------------|---------|---------|-------|
| No tags | TBD | TBD | TBD |
| With tags | TBD | TBD | TBD |

### Effect of Synthetic Data Size

| Training Data Size | BLEU |
|-------------------|------|
| Seed only (~15K) | TBD |
| + 25K synthetic | TBD |
| + 50K synthetic | TBD |
| + 100K synthetic | TBD |

## Latency Benchmarks

| Hardware | Avg Latency | P95 |
|----------|-------------|-----|
| RTX 3060 (6GB) | TBD | TBD |
| CPU (i7-12700H) | TBD | TBD |
| Apple M1 | TBD | TBD |

## Error Analysis

### Common Error Types

1. **Named Entity Errors:** TBD%
2. **Number/Date Errors:** TBD%
3. **Domain Terminology:** TBD%
4. **Grammar Errors:** TBD%
5. **Missing Information:** TBD%

### Failure Cases

*To be documented after evaluation*

## Conclusions

*To be completed after evaluation*
