# Daraja: Product Requirements Document (v3)

## 1. Overview

Daraja ("bridge" in Swahili) is a self-distilling translation pipeline that generates specialized, offline-capable translation models for low-resource language pairs used in refugee and humanitarian contexts. It targets the Gemma 4 Good Hackathon's Digital Equity & Inclusivity track, with parallel eligibility for the Main Track, the Unsloth Special Technology Prize, and the Ollama Special Technology Prize.

The system uses Gemma 31B to synthesize parallel training corpora for language pairs underserved by commercial translation tools, then distills those capabilities into Gemma E4B via Unsloth for on-device deployment through Ollama.

The novel contribution is the pipeline itself, not any single deployed model. Any organization with a new language pair can run Daraja end to end and produce their own offline translator.

## 2. Problem

Refugee intake workflows rely on human interpreters who are scarce, expensive, and frequently absent from the corridors of greatest need. Commercial translation services either fail to cover the relevant language pairs (Tigrinya↔Arabic, Dari↔Turkish), require connectivity that field clinics and border posts lack, or transmit sensitive personal data through third-party servers in ways that breach humanitarian privacy norms.

The operational result: a Somali-speaking woman arrives at a Kakuma intake clinic, the on-duty caseworker speaks only Swahili and English, and the formal interview either waits days for an interpreter or proceeds through pidgin gestures that produce unreliable records. Multiply this across 43.4 million displaced people globally and the gap is structural, not anecdotal.

## 3. Users

**Primary:** Field caseworkers conducting structured intake interviews (medical, legal, resettlement) in low-connectivity, low-resource environments. They need the system to be voice-first, run on a mid-range Android phone, and produce structured records they can hand off.

**Secondary:** Refugees and asylum seekers who need to understand the questions being asked and respond in their first language without a human intermediary.

**Tertiary:** NGO operations leads who decide whether to deploy the tool, and humanitarian funders evaluating offline AI for crisis response.

## 4. Goals and Non-goals

**Goals.**
1. Demonstrate measurable translation quality improvement on three low-resource language pairs (Somali↔Swahili, Tigrinya↔Arabic, Dari↔Turkish) over baseline Gemma E4B and over commercially available translation APIs where they cover the pair at all.
2. Deploy the distilled model fully offline on consumer Android hardware via Ollama.
3. Complete an end-to-end structured intake workflow in the demo, voice in to populated form out, without internet access.
4. Produce a reproducible pipeline that any team with a new language pair can run.

**Non-goals.**
1. Replacing certified human interpreters in legally binding contexts (asylum hearings, medical consent).
2. Coverage of all 7,000+ world languages. The pipeline generalizes, but the submission demonstrates three pairs.
3. Building a general-purpose chat assistant. Daraja is task-scoped to humanitarian intake.

## 5. Track Alignment

| Track | Daraja's claim |
|---|---|
| Main Track | The self-distillation pipeline as a reusable method for generating low-resource translation models is the technical contribution. Real-world impact in displacement contexts is the vision. |
| Digital Equity & Inclusivity (Impact) | Three underserved language pairs, voice-first interface for users with low literacy in their first language, fully offline operation. |
| Unsloth (Special Technology) | The fine-tuned E4B is delivered as a standalone artifact with full Unsloth training configuration, before-and-after evaluation, and reproducibility documentation. |
| Ollama (Special Technology) | The distilled model ships with a Modelfile, runs entirely through Ollama in the demo, and includes benchmarked latency on consumer hardware. |

Theoretical prize ceiling: $80,000 (Main 1st + Digital Equity + Unsloth + Ollama).

## 6. Architecture

### 6.1 Seed Corpora

License cleanliness is a hard constraint, not a preference. The CC-BY 4.0 winner license (rules Section 2.5) and the originality warranty (rules Section 3.14.a) require that every input data source either be redistributable under a compatible license or be excluded from training entirely.

**In scope (verified license-clean):**
- **FLORES-200** (CC-BY-SA 4.0). Covers Somali, Tigrinya, Swahili, Arabic, Dari, Turkish. Used for both seed parallel sentences and held-out evaluation.
- **NLLB Seed Data** (CC-BY-SA 4.0). Meta's curated low-resource parallel data. Coverage varies by pair but includes Somali and Tigrinya.
- **Tatoeba** (CC-BY 2.0 FR). Volunteer-translated sentence pairs across thousands of language combinations. Useful for Swahili and Arabic pairs.
- **Wikipedia bilingual article alignment** (CC-BY-SA 4.0). Sentence-aligned pairs extracted from corresponding articles.
- **Common Voice** (CC0). Used for ASR adaptation only, not text translation. Coverage of Swahili, Turkish, and Arabic varieties.
- **MultiCCAligned subsets** filtered to documents with verifiable Creative Commons or public domain provenance.
- **Masakhane community datasets** released under CC-BY 4.0 (MAFAND-MT and successor projects).

**Excluded (license incompatibility or unresolved provenance):**
- **JW300.** Withdrawn from active research use after legal review confirmed that jw.org's copyright notice prohibits text and data mining. Including it would breach the originality warranty and contaminate the CC-BY 4.0 license grant. Listed here explicitly so reviewers see the deliberate exclusion.
- **OpenSubtitles bulk dumps** without per-title license verification.
- **Web-scraped data** without robots.txt and terms-of-service review.

Every seed source enters the pipeline through a manifest file recording source URL, license, retrieval date, and SHA-256 hash. The manifest ships with the submission as `data/SOURCES.md` so reviewers can verify provenance independently.

### 6.2 Synthetic Data Generation via Gemma 31B

Three generation strategies run in parallel from the seed corpora:

**Back-translation.** Monolingual text in the lower-resource direction is translated into the higher-resource direction by Gemma 31B, producing synthetic parallel pairs. Iterated for two rounds with diversity sampling at temperature 0.7.

**Domain synthesis.** Gemma 31B generates synthetic sentences in the target domains (medical intake, legal declaration, resettlement interview) using few-shot prompts grounded in UNHCR Refugee Status Determination templates and WHO primary care intake forms. Both directions of each pair generated.

**Paraphrase expansion.** Existing parallel pairs are expanded with paraphrases that preserve meaning while varying register, formality, and dialect. Critical for Arabic (MSA versus regional varieties) and for Dari (versus standard Persian).

**Quality filtering.** Each synthetic pair passes through a three-stage filter: round-trip translation consistency (cosine similarity above 0.85), Gemma 31B self-evaluation (acceptability score above 7/10), and length-ratio sanity check. Roughly 60% of generated pairs survive filtering.

Output: approximately 200,000 filtered synthetic pairs per language pair, plus all retained seed pairs.

### 6.3 Multimodal Input Layer

The deployed application accepts three input modes:

**Voice (primary).** Gemma E4B's native audio understanding processes spoken input directly without a separate ASR stage. The model handles Swahili, Arabic, Turkish, and English natively; for Somali, Tigrinya, and Dari the audio is routed through a fallback Whisper-large-v3 stage running locally.

**Document image.** Photographed identity documents, medical records, and prior case files are processed through Gemma E4B vision for text extraction and translation. Useful when a refugee arrives with paperwork in a script the caseworker can't read.

**Typed text.** Standard text input as a fallback when voice fails or for caseworker corrections.

### 6.4 Structured Task Engine

Translation alone doesn't complete an intake. The task engine uses Gemma 4 function calling to populate structured forms during the conversation:

```
tools = [
  populate_field(form_id, field_name, value, source_lang, confidence),
  flag_for_human_review(form_id, field_name, reason),
  request_clarification(field_name, lang),
  finalize_form(form_id)
]
```

The model decides when a question has been answered well enough to populate a field, when a follow-up is needed, and when the segment confidence is too low to commit without human review. The form schemas ship as JSON for UNHCR RSD interviews, WHO primary care intake, and a basic legal declaration template.

### 6.5 Distillation via Unsloth into E4B

The synthetic corpus from 6.2 plus the seed pairs from 6.1 form the training set for Unsloth-based fine-tuning of Gemma E4B. Configuration:

- LoRA rank 64, alpha 128, dropout 0.05
- Targets: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj
- Mixed precision bfloat16, gradient checkpointing on
- Three epochs, cosine LR schedule with 100-step warmup
- Per-pair separate adapter training with shared base weights

Each pair gets its own adapter, swappable at runtime via the Ollama Modelfile. Total adapter size per pair is roughly 180MB, which keeps the deployed footprint manageable on consumer phones.

The Unsloth training script is delivered as a standalone Kaggle notebook so reviewers can reproduce the fine-tune end to end.

### 6.6 Ollama Deployment

The fine-tuned model ships as an Ollama Modelfile with:

- Base model reference (Gemma E4B in GGUF Q4_K_M quantization)
- Three swappable LoRA adapters (one per language pair)
- System prompt template for the task engine
- Function-calling schema
- Temperature, top_p, and repeat-penalty settings tuned for translation faithfulness

A `ollama create daraja-somali-swahili` command produces a self-contained model that runs on any Ollama-supported platform. The demo uses Ollama on a mid-range Android device via Termux to prove on-device feasibility, with a desktop fallback for video clarity.

## 7. Demo Application UX

The demo is a Flutter mobile app talking to a local Ollama server. Single primary screen:

**Top half: live transcript.** Speaker turns alternate, each with detected language, original text, and translated text. Low-confidence segments are highlighted in amber.

**Bottom half: form being populated.** Fields fill in real time as the conversation progresses. Fields flagged for review show a flag icon. Tapping any field opens a drawer with the source segment, the model's confidence, and a manual edit option.

**Single voice button.** Tap to talk, tap again to stop. No menus, no settings buried in submenus, no onboarding wall. The caseworker should be able to hand the phone to the person they're interviewing without explanation.

The demo video walks through one full intake from greeting to finalized form, showing offline operation by visibly toggling airplane mode at the start.

## 8. Submission Package

| Deliverable | Location | Format |
|---|---|---|
| Kaggle Writeup | Kaggle competition page | Markdown, under 1,500 words |
| Demo Video | YouTube (public, no login) | 3 minutes maximum, attached to writeup |
| Public Code Repository | GitHub (primary), mirrored to Kaggle Notebook | CC-BY 4.0 license file at root |
| Live Demo | APK download link plus Ollama Modelfile | No login, no paywall |
| Media Gallery | Kaggle writeup attachments | Cover image plus architecture diagrams |

**Note on the Kaggle mirror.** Foundational Rule 3.6.b requires that publicly shared competition code be available on Kaggle for the benefit of all competitors. Mirroring the GitHub repo to a public Kaggle notebook on submission day removes any ambiguity. The mirror runs the full pipeline end to end, with cell outputs preserved for offline verification.

## 9. Evaluation Plan

### 9.1 Metrics

**Translation quality.** BLEU and chrF++ on FLORES-200 test sets for all three pairs, both directions. Reported alongside baseline Gemma E4B (no fine-tune) and Google Translate (where the pair is supported).

**ASR accuracy.** Word error rate on Common Voice held-out audio for the languages where Common Voice covers a comparable variety.

**Task completion.** Percentage of structured form fields correctly populated end to end on a 50-conversation evaluation set. Annotated by native speaker evaluators.

**Latency.** Median and p95 token generation latency on the target Android device, measured for both the base E4B and the distilled adapters.

**Confidence calibration.** Reliability diagram comparing model-reported confidence against actual correctness on the evaluation set.

### 9.2 Ablations

Three ablations run for the writeup:
1. Base E4B versus E4B + adapter (isolates the distillation effect).
2. Adapter trained on synthetic data only versus seed-only versus combined (quantifies the synthetic data contribution).
3. With versus without confidence routing (measures the safety layer's impact on task completion).

### 9.3 Human Evaluation

Native speaker evaluators rate adequacy and fluency on a 5-point scale for 100 sampled segments per pair. Recruited through diaspora community networks, compensated at fair-market hourly rates. Inter-annotator agreement reported as Krippendorff's alpha.

## 10. Timeline

The competition runs from April 2 to May 18, 2026. Daraja's internal schedule:

| Window | Focus |
|---|---|
| Week 1 (now → May 4) | Seed corpus assembly with verified licenses. 31B generation prompts finalized. Evaluation harness scaffolded. |
| Week 2 (May 5 → May 11) | Full 31B synthetic data generation across all three pairs. Begin Unsloth fine-tuning. |
| Week 3 (May 12 → May 14) | Distillation iteration. Confidence routing. Function-calling integration. End-to-end demo flow working. |
| Week 4 (May 15 → May 18) | Demo video, writeup, Kaggle notebook mirror, repo polish, submission. |

The eight-day buffer between submission (May 18) and any subsequent commitments keeps the schedule defensible against slippage.

## 11. Reproducibility and Compliance

### 11.1 Reproducibility (rules Section 2.8)

The submission delivers everything required to regenerate the winning artifact:

- **Training code.** Unsloth fine-tuning scripts with all hyperparameters, random seeds, and data manifests.
- **Inference code.** Ollama Modelfile, Flutter client, and standalone Python inference scripts.
- **Computational environment.** A `requirements.txt` plus a pinned-version Dockerfile. Hardware requirements documented as: A100 80GB for the 31B generation stage (estimated 40 GPU-hours per language pair), single A100 40GB or T4 for the Unsloth fine-tune (estimated 8 GPU-hours per adapter), commodity Android device for inference.
- **Pre-generated checkpoint.** The synthetic corpus from Stage 6.2 is included as a release artifact so reviewers without GPU access can verify Stages 6.5 and 6.6 directly.

### 11.2 License compliance

- Submission code, model weights, synthetic corpora, and writeup all licensed under CC-BY 4.0 at submission time.
- Every seed data source documented in `data/SOURCES.md` with license verification.
- Gemma 4 model weights used under their existing license terms; not relicensed.
- Unsloth, Ollama, llama.cpp, and Whisper used under their respective open-source licenses, all of which permit the CC-BY 4.0 grant on derivative works.

### 11.3 Originality warranty (rules Section 3.14.a)

All synthetic data generated by the pipeline is original work product. Seed inputs are properly attributed and license-cleared. No private datasets, no sharing of code outside the team during the competition window, no use of validation-set hand labeling.

### 11.4 Administrative checklist

- [ ] Kaggle account phone-verified (required for submission).
- [ ] Single Kaggle account confirmed; no auxiliary accounts created during the competition window.
- [ ] Tax form W-9 filled out and ready for prize disbursement if a U.S. winner.
- [ ] Submission timed against the May 18, 7:59 PM EDT deadline (which is 11:59 PM UTC). Final submission target: May 17 evening, with May 18 reserved for emergencies only.
- [ ] No private code sharing outside the team; public sharing routed through Kaggle forums or Notebooks.

## 12. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Synthetic data quality insufficient for genuinely low-resource pairs (Somali↔Swahili most exposed) | High | Spike on this pair first in Week 1. If quality floor is unworkable, swap to a pair with stronger seed data (Hausa↔English) without changing the pipeline. |
| 31B generation exceeds available GPU quota | Medium | Estimate locked at 120 GPU-hours total. Pre-generated corpus shipped as a checkpoint so reviewers can verify downstream stages without re-running generation. |
| Mistranslation in legal or medical context causes harm if deployed | High | Confidence routing is the primary safeguard. Submission writeup explicitly positions Daraja as an aid to qualified interpreters, not a replacement. Field deployment requires human review of low-confidence segments. |
| Phone verification or single-account rule snag at submission | Low | Verification completed Week 1. No new accounts created. |
| Demo dependency on physical Android hardware fails during recording | Low | Desktop Ollama fallback recorded as a backup. Both offline modes shown in the video. |
| Native speaker evaluators unavailable on schedule | Medium | Recruitment begun Week 1. Three evaluators per pair, two-week notice. Backup: lean more on FLORES-200 automated metrics if human eval slips. |

## 13. Prize Strategy

| Track | Prize | Daraja's qualifier |
|---|---|---|
| Main Track 1st–4th | $50K / $25K / $15K / $10K | Self-distillation pipeline as the technical contribution; humanitarian deployment as the impact story; polished demo as the storytelling vehicle. |
| Digital Equity & Inclusivity (Impact) | $10K | Three underserved pairs, voice-first UX, fully offline. Default-aligned. |
| Unsloth (Special Technology) | $10K | Fine-tuned E4B as standalone deliverable with full training docs and ablations. |
| Ollama (Special Technology) | $10K | Demo runs on Ollama; Modelfile shipped; on-device benchmarks documented. |

Optimization priority: Main Track first, since the prize differential is roughly 5:1 against any single Special Technology Prize. Unsloth and Ollama eligibility are layered on without diluting the primary submission.

## 14. Success Criteria

**Competition success.**
1. Measurable BLEU/chrF++ improvement over baseline E4B on all three pairs, in both directions.
2. End-to-end voice-to-form intake completed offline in the demo.
3. Writeup that positions the pipeline as a reusable method, not a one-off project.
4. Standalone Unsloth and Ollama artifacts that justify Special Technology Prize consideration on their own merits.

**Post-competition success.**
1. At least one humanitarian organization piloting the pipeline on a new language pair.
2. Open-source contributions extending coverage to additional pairs.
3. Public results contributing usable data to the low-resource MT research community.
4. CC-BY 4.0 licensed codebase enabling commercial and NGO adaptation without legal friction.