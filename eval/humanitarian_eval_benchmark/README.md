---
language:
- so
- sw
- en
license: cc-by-4.0
task_categories:
- translation
tags:
- humanitarian
- refugee
- medical
- legal
- education
- low-resource
- evaluation
size_categories:
- n<1K
---

# Daraja Humanitarian Evaluation Benchmark

A 30-sentence evaluation dataset for Somali→Swahili translation in humanitarian contexts.

## Dataset Description

This benchmark evaluates machine translation quality on sentences commonly encountered in humanitarian service delivery: medical intake, legal consultation, and educational enrollment. Each sentence includes multiple reference translations and English glosses for cross-validation.

### Supported Tasks

- **Machine Translation Evaluation:** Somali → Swahili
- **Multi-reference chrF++/BLEU scoring**
- **Domain-stratified analysis**

### Languages

- **Source:** Somali (so)
- **Target:** Swahili (sw)
- **Gloss:** English (en)

## Dataset Structure

### Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique sentence ID (format: `{domain}_{number}`) |
| `domain` | string | One of: `medical`, `legal`, `educational` |
| `somali` | string | Source sentence in Somali |
| `references` | list[string] | 2-3 reference translations in Swahili |
| `english` | string | English gloss for verification |

### Data Splits

| Split | Sentences | Medical | Legal | Educational |
|-------|-----------|---------|-------|-------------|
| test | 30 | 10 | 10 | 10 |

### Example

```json
{
  "id": "med_01",
  "domain": "medical",
  "somali": "Ilmahaygu wuu xummadaa",
  "references": [
    "Mtoto wangu ana homa",
    "Mwanangu ana homa",
    "Mtoto wangu anaumwa homa"
  ],
  "english": "My child has a fever"
}
```

## Benchmark Results

| Model | chrF++ | Empty Rate | Notes |
|-------|--------|------------|-------|
| NLLB-200-distilled-600M | 75.5 | 0% | High chrF++, semantic errors |
| daraja-so-sw (Gemma 2B QLoRA) | 33.4 | 43% | Lower chrF++, better semantics |

### Domain Breakdown (daraja-so-sw)

| Domain | chrF++ | Empty Rate |
|--------|--------|------------|
| Medical | 44.4 | 10% |
| Legal | 38.3 | 50% |
| Educational | 16.9 | 70% |

## Motivation

Existing MT evaluation benchmarks (WMT, Flores) focus on high-resource language pairs and general-domain text. Humanitarian translation has distinct requirements:

1. **High-stakes accuracy:** Medical/legal mistranslations can cause harm
2. **Domain-specific vocabulary:** Asylum, symptoms, enrollment procedures
3. **Low-resource pairs:** Somali↔Swahili has minimal parallel training data

This benchmark enables targeted evaluation for humanitarian MT systems.

## Curation Process

### Source Selection

Sentences were curated by reviewing:
- UNHCR refugee status determination interview guides
- WHO multilingual health communication resources
- US school enrollment forms for immigrant families

### Reference Collection

Each sentence has 2-3 reference translations to capture acceptable variation. References were validated by reviewing against multiple online dictionaries and parallel text sources.

### Quality Control

- All references verified against English gloss
- Cross-checked vocabulary against Swahili language resources
- Domain classification validated by content analysis

## Known Limitations

1. **Small size:** 30 sentences is insufficient for statistical significance on fine-grained metrics
2. **Single evaluator:** References not validated by native speaker panel
3. **Register variation:** Does not capture formal vs. informal register differences
4. **Dialectal coverage:** Standard Somali only; Northern/Benaadir dialects not represented

## Ethical Considerations

This dataset contains sensitive domain vocabulary (medical symptoms, legal status questions). Models trained or evaluated on this data should be deployed with appropriate human oversight in humanitarian contexts.

## Usage

### Loading with Datasets

```python
from datasets import load_dataset

dataset = load_dataset("jeremiah-sakuda/daraja-humanitarian-eval")
```

### Manual Loading

```python
import json

with open("test.jsonl") as f:
    data = [json.loads(line) for line in f]
```

### Evaluation Script

```python
import sacrebleu

for item in data:
    hypothesis = your_model.translate(item["somali"])
    score = sacrebleu.sentence_chrf(hypothesis, item["references"])
    print(f"{item['id']}: {score.score:.1f}")
```

## Citation

```bibtex
@dataset{daraja_humanitarian_eval_2026,
  title={Daraja Humanitarian Evaluation Benchmark},
  author={Sakuda, Jeremiah},
  year={2026},
  url={https://github.com/Jeremiah-Sakuda/Daraja},
  note={30-sentence Somali-Swahili evaluation set for humanitarian MT}
}
```

## License

CC-BY-4.0 — Free to use with attribution.
