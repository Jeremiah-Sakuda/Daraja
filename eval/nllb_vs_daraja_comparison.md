# NLLB-200 vs Daraja: Side-by-Side Comparison

**Purpose:** Honest assessment of semantic accuracy to determine if "NLLB wins chrF++ but loses semantics" claim holds.

## Medical Domain (10 sentences)

| ID | English | NLLB-200 | Daraja | Winner |
|----|---------|----------|--------|--------|
| med_01 | My child has a fever | "Mtoto wangu ni mbaya sana" (My child is very bad) | "Mimi nina mtoto wa kiume" (I have a boy) | **Neither** - both wrong |
| med_02 | Where does it hurt? | "Unateseka wapi?" (Where do you suffer?) | "Wapi kuna uchungu?" (artifacts) | **NLLB** - closer meaning |
| med_03 | Take this medicine twice daily | "Chukua dawa hii mara mbili kwa siku" ✅ | (empty) | **NLLB** |
| med_04 | I need a doctor | "Nahitaji daktari" ✅ | "I need a doctor. - Ninahitaji daktari" | **NLLB** - no English mixing |
| med_05 | My stomach hurts | "Ninapata maumivu ya tumbo" ✅ | "Mimi ninaogopa sana" (I am very scared) | **NLLB** |
| med_06 | Are you pregnant? | "Je, una mimba?" ✅ | "Je, unafanya kazi?" (Are you working?) | **NLLB** |
| med_07 | I ran out of my medication | "Nilimaliza matibabu yangu" (I finished my treatment) | "Nimekumaliza kazi yangu" (I finished my work) | **NLLB** - closer |
| med_08 | Is there someone who speaks Somali? | "Je, kuna mtu anayezungumza Kisomali?" ✅ | "Je, kuna mtu anayezungumza Kiswahili?" (Swahili not Somali) | **NLLB** |
| med_09 | I have trouble breathing | "Nina matatizo ya kupumua" ✅ | "Nina shida ya kupumua" ✅ | **Tie** - both correct |
| med_10 | Have you received the COVID vaccine? | "Umepokea chanjo ya COVID?" ✅ | (need to check) | TBD |

**Medical Score:** NLLB wins 7-8 out of 10

## Analysis

### The Problem

The "semantic error" story is **not supported by the data**. Looking at the actual outputs:

- **NLLB-200:** Mostly correct translations with 1-2 semantic errors
- **Daraja:** Multiple semantic errors, empty outputs, English mixing

### Specific NLLB-200 Semantic Errors Found

1. **med_01:** "fever" → "very bad" - Critical medical error
2. **med_07:** "ran out of medication" → "finished treatment" - Semantic shift

### Specific Daraja Errors Found

1. **med_01:** "fever" → "I have a boy" - Completely wrong
2. **med_03:** Empty output
3. **med_05:** "stomach hurts" → "I am very scared" - Completely wrong
4. **med_06:** "pregnant" → "working" - Completely wrong
5. **med_07:** "medication" → "work" - Wrong domain
6. **med_08:** "Somali" → "Swahili" - Wrong language mentioned

### Conclusion

**The chrF++ gap reflects real quality issues, not metric artifacts.**

NLLB-200 is genuinely producing better translations on this eval set. The "semantic accuracy" framing was wishful thinking based on a single example (med_01) that happened to be NLLB's worst case.

### Honest Framing Options

1. **Acknowledge the gap:** "Our fine-tuned model underperforms NLLB-200 on general translation. However, we identified the empty-output failure mode and domain gaps that inform future data augmentation."

2. **Reframe the contribution:** Position the project as methodology + infrastructure (benchmark, pipeline) rather than SOTA translation quality.

3. **Find actual wins:** Are there ANY sentences where Daraja is correct and NLLB is wrong? Need to check the full dataset.

## Next Steps

- [ ] Complete comparison for all 30 sentences
- [ ] Find actual Daraja wins (if any)
- [ ] Revise writeup framing to be honest
- [ ] Consider whether to include NLLB comparison at all
