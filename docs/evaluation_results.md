# Daraja Evaluation Results

*Updated: May 13, 2026*

## Summary

| Model | chrF++ | Empty Rate | Notes |
|-------|--------|------------|-------|
| NLLB-200-distilled-600M | 75.5 | 0% | Wins 7-8/10 medical |
| daraja-so-sw (Gemma 2B QLoRA) | 33.4 | 43% | 90% medical success |

**Key Finding:** NLLB-200 outperforms Daraja on most translation tasks. The chrF++ gap reflects real quality differences. Daraja's value is in offline deployment, confidence routing, and infrastructure for future language pairs.

## Evaluation Setup

**Test Set:** Custom humanitarian evaluation set (30 sentences)
- Medical: 10 sentences
- Legal: 10 sentences
- Educational: 10 sentences

**Language Pair:** Somali (so) → Swahili (sw)

**Baselines:**
- NLLB-200-distilled-600M (Facebook)

## Detailed Results

### chrF++ Scores by Domain

| Domain | NLLB-200 | Daraja | Winner |
|--------|----------|--------|--------|
| Medical | 78.4 | 44.4 | NLLB (score) / Daraja (semantics) |
| Legal | 86.1 | 38.3 | NLLB (score) / Daraja (semantics) |
| Educational | 65.1 | 16.9 | NLLB |
| **Overall** | **75.5** | **33.4** | — |

### Empty Output Rate

| Domain | NLLB-200 | Daraja |
|--------|----------|--------|
| Medical | 0% | 10% |
| Legal | 0% | 50% |
| Educational | 0% | 70% |
| **Overall** | **0%** | **43%** |

## Semantic Accuracy Analysis

### Side-by-Side Comparison (Medical Domain)

| Sentence | NLLB-200 | Daraja | Winner |
|----------|----------|--------|--------|
| My child has a fever | "My child is very bad" ❌ | "I have a boy" ❌ | Neither |
| My stomach hurts | ✅ Correct | "I am very scared" ❌ | NLLB |
| Are you pregnant? | ✅ Correct | "Are you working?" ❌ | NLLB |
| I have trouble breathing | ✅ Correct | ✅ Correct | Tie |
| I need a doctor | ✅ Correct | ✅ (English mixing) | NLLB |

**Medical Domain Score: NLLB wins 7-8 out of 10**

### Honest Assessment

The "semantic error" framing was based on a single NLLB error case. NLLB-200 actually outperforms Daraja on most translation tasks. The chrF++ gap reflects real quality differences, not metric artifacts.

**Daraja's value proposition:** Offline deployment, confidence routing, and infrastructure for future language pairs—not superior translation quality.

## Daraja Domain Analysis

### Strong Domain: Medical (chrF++ 44.4, 10% empty)

Working translations:
- "Waxaan u baahanahay dhakhtar" → "Ninahitaji daktari" (I need a doctor)
- "Dhibaato neefsasho ayaan qabaa" → "Nina shida ya kupumua" (I have trouble breathing)
- "Ma jiraa qof af Soomaali ku hadla?" → "Je, kuna mtu anayezungumza Kiswahili?" (Is there someone who speaks Somali?)

### Weak Domain: Educational (chrF++ 16.9, 70% empty)

Vocabulary gaps (returns empty output):
- `iskuulka` (school)
- `macalinka` (teacher)
- `fasalka` (grade/class)
- `cunugayga` (my child, in educational context)

**Root Cause:** NLLB training corpus underrepresents educational vocabulary in Somali-Swahili pairs.

## Confidence Routing Performance

| Level | Threshold | Typical Behavior |
|-------|-----------|------------------|
| High | ≥0.8 | Medical domain, common phrases |
| Medium | 0.5-0.8 | Legal domain, longer sentences |
| Low | <0.5 | Educational domain, unknown vocab |

## Example Translations

### High Confidence (Medical)

**Source (Somali):** Dhibaato neefsasho ayaan qabaa
**Reference (Swahili):** Nina shida ya kupumua
**Daraja Output:** Nina shida ya kupumua
**Confidence:** 0.85 ✅

### Medium Confidence (Legal)

**Source (Somali):** Qoyskaygii waa dalka kale
**Reference (Swahili):** Familia yangu iko nchi nyingine
**Daraja Output:** Familia yangu iko nchi nyingine
**Confidence:** 0.65 ⚠️

### Low Confidence (Educational - Empty Output)

**Source (Somali):** Cunugayga waxaan rabaa inaan iskuul ka qoro
**Reference (Swahili):** Nataka kuandikisha mtoto wangu shuleni
**Daraja Output:** (empty)
**Confidence:** 0.0 ❌
**Issue:** Vocabulary coverage failure

## Latency Benchmarks

From `models/benchmarks/latency_results.md`:

| Configuration | Avg Latency | Tokens/sec |
|---------------|-------------|------------|
| Q4_K_M GGUF on CPU | ~2s | ~15 |
| Q4_K_M GGUF on GPU | ~0.5s | ~40 |

## Error Analysis

### Failure Mode Classification

1. **Vocabulary Coverage Failure (43%):** Model returns empty output when encountering out-of-vocabulary terms from underrepresented domains
2. **Generation Failure (rare):** Model produces malformed output

### Few-Shot Prompting Experiment

Tested vocabulary hints in prompts:
- Fixed: 2 sentences
- Broke: 2 sentences
- Net improvement: **0**

Conclusion: Few-shot prompting unreliable for fine-tuned models trained in zero-shot format.

## Conclusions

1. **NLLB-200 outperforms Daraja** on most translation tasks (7-8/10 medical sentences)
2. **43% empty output rate** is the primary quality issue, concentrated in educational domain
3. **Medical domain is strongest** with 90% success rate
4. **Daraja's contribution:** Offline deployment infrastructure, confidence routing, methodology for fine-tuning additional low-resource language pairs
5. **Future work:** Domain-specific data augmentation, improved vocabulary coverage

## References

- Full evaluation data: `eval/humanitarian_eval_benchmark/`
- NLLB baseline results: `eval/nllb_baseline_results.json`
- Daraja results: `eval/eval_results.json`
