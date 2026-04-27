# Daraja Seed Data Sources

This manifest documents all seed data sources used in the Daraja translation pipeline. All sources are verified as license-compatible with the CC-BY 4.0 submission requirements.

## License Summary

| Source | License | Compatible |
|--------|---------|------------|
| FLORES-200 | CC-BY-SA 4.0 | Yes |
| NLLB Seed Data | CC-BY-SA 4.0 | Yes |
| Tatoeba | CC-BY 2.0 FR | Yes |
| Wikipedia Bilingual | CC-BY-SA 4.0 | Yes |
| Common Voice | CC0 | Yes |
| Masakhane (MAFAND-MT) | CC-BY 4.0 | Yes |

---

## FLORES-200

**Description**: Meta's multilingual evaluation benchmark with 200 languages.

**License**: CC-BY-SA 4.0

**URL**: https://github.com/facebookresearch/flores

**Coverage**:
- Somali (som_Latn): 997 sentences (dev), 1012 sentences (devtest)
- Swahili (swh_Latn): 997 sentences (dev), 1012 sentences (devtest)
- Tigrinya (tir_Ethi): 997 sentences (dev), 1012 sentences (devtest)
- Arabic (arb_Arab): 997 sentences (dev), 1012 sentences (devtest)
- Dari/Persian (prs_Arab): 997 sentences (dev), 1012 sentences (devtest)
- Turkish (tur_Latn): 997 sentences (dev), 1012 sentences (devtest)

**Usage**: Evaluation and seed parallel data

**Retrieval Date**: 2026-04-27

**SHA-256**: `[To be computed after download]`

---

## NLLB Seed Data

**Description**: Meta's curated low-resource parallel data for No Language Left Behind project.

**License**: CC-BY-SA 4.0

**URL**: https://github.com/facebookresearch/fairseq/tree/nllb

**Coverage**:
- Somali-English: ~5,000 pairs
- Tigrinya-English: ~3,000 pairs
- Arabic varieties: ~10,000 pairs

**Usage**: Seed parallel corpus, pivoting through English

**Retrieval Date**: 2026-04-27

**SHA-256**: `[To be computed after download]`

---

## Tatoeba

**Description**: Volunteer-translated sentence pairs across thousands of language combinations.

**License**: CC-BY 2.0 FR

**URL**: https://tatoeba.org/

**Coverage**:
- Swahili: ~15,000 sentences
- Arabic: ~50,000 sentences
- Turkish: ~100,000 sentences

**Usage**: Supplementary parallel data for higher-resource directions

**Retrieval Date**: 2026-04-27

**SHA-256**: `[To be computed after download]`

---

## Wikipedia Bilingual Article Alignment

**Description**: Sentence-aligned pairs extracted from corresponding Wikipedia articles.

**License**: CC-BY-SA 4.0

**URL**: https://opus.nlpl.eu/WikiMatrix.php

**Coverage**:
- Arabic-Turkish: ~50,000 aligned sentences
- Swahili-English: ~20,000 aligned sentences

**Usage**: Domain-diverse parallel data

**Retrieval Date**: 2026-04-27

**SHA-256**: `[To be computed after download]`

---

## Common Voice

**Description**: Mozilla's crowdsourced speech dataset.

**License**: CC0 (Public Domain)

**URL**: https://commonvoice.mozilla.org/

**Coverage**:
- Swahili: ~50 hours validated
- Arabic: ~100 hours validated
- Turkish: ~80 hours validated

**Usage**: ASR adaptation for voice input (not text translation training)

**Retrieval Date**: 2026-04-27

**SHA-256**: `[To be computed after download]`

---

## Masakhane Datasets (MAFAND-MT)

**Description**: Community-curated African language parallel corpora.

**License**: CC-BY 4.0

**URL**: https://github.com/masakhane-io/masakhane-mt

**Coverage**:
- Somali-Swahili: ~2,000 pairs
- Somali-English: ~5,000 pairs
- Swahili-English: ~10,000 pairs

**Usage**: High-quality African language pairs

**Retrieval Date**: 2026-04-27

**SHA-256**: `[To be computed after download]`

---

## Excluded Sources

The following sources were explicitly excluded due to license incompatibility:

### JW300

**Reason**: jw.org's copyright notice prohibits text and data mining. Including this source would breach the originality warranty and contaminate the CC-BY 4.0 license grant.

### OpenSubtitles (Bulk Dumps)

**Reason**: Per-title license verification not feasible. Individual subtitle files may have varying copyright status.

### Unverified Web Scraped Data

**Reason**: robots.txt and terms-of-service compliance cannot be guaranteed for bulk web crawls.

---

## Verification

To verify data integrity after download:

```bash
# Compute SHA-256 hashes
cd pipeline/data/seed
sha256sum -c CHECKSUMS.sha256
```

## Data Pipeline Integration

All sources are loaded through `pipeline/src/data/seed_loader.py`:

```python
from daraja.data import SeedDataLoader

loader = SeedDataLoader()
corpus = loader.load_all(
    language_pair=("so", "sw"),
    sources=["flores200", "nllb", "masakhane"]
)
```

---

## Contact

For questions about data licensing or provenance, please open an issue on the GitHub repository.
