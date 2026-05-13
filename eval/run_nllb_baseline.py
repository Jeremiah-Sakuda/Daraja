"""
NLLB-200 Baseline Evaluation
Compare NLLB-200 distilled-600M against Daraja fine-tune
"""

import json
from pathlib import Path
from sacrebleu.metrics import CHRF

# Check for transformers
try:
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    import torch
except ImportError:
    print("Installing required packages...")
    import subprocess
    subprocess.check_call(["pip", "install", "transformers", "torch", "sentencepiece", "-q"])
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    import torch

EVAL_FILE = Path(__file__).parent / "humanitarian_eval_set.jsonl"
RESULTS_FILE = Path(__file__).parent / "nllb_baseline_results.json"

# NLLB language codes
NLLB_SRC = "som_Latn"  # Somali
NLLB_TGT = "swh_Latn"  # Swahili


def load_eval_set():
    """Load evaluation sentences from JSONL file"""
    sentences = []
    with open(EVAL_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                sentences.append(json.loads(line.strip()))
    return sentences


def load_nllb_model():
    """Load NLLB-200 distilled-600M"""
    print("Loading NLLB-200 distilled-600M...")
    model_name = "facebook/nllb-200-distilled-600M"

    tokenizer = AutoTokenizer.from_pretrained(model_name, src_lang=NLLB_SRC)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

    # Move to GPU if available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    print(f"Model loaded on {device}")

    return model, tokenizer, device


def translate_nllb(model, tokenizer, device, text):
    """Translate using NLLB-200"""
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=128)
    inputs = {k: v.to(device) for k, v in inputs.items()}

    # Force target language
    forced_bos_token_id = tokenizer.convert_tokens_to_ids(NLLB_TGT)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            forced_bos_token_id=forced_bos_token_id,
            max_new_tokens=128,
            num_beams=5,
            early_stopping=True
        )

    translation = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return translation


def compute_chrf_multiref(hypotheses, references_list):
    """Compute chrF++ with multiple references per sentence."""
    chrf = CHRF()

    max_refs = max(len(refs) for refs in references_list)
    padded_refs = []
    for refs in references_list:
        padded = refs + [refs[0]] * (max_refs - len(refs))
        padded_refs.append(padded)

    transposed = list(zip(*padded_refs))
    transposed = [list(t) for t in transposed]

    score = chrf.corpus_score(hypotheses, transposed)
    return score.score


def run_baseline():
    """Run NLLB-200 baseline evaluation"""
    print("=" * 60)
    print("NLLB-200 BASELINE EVALUATION")
    print("=" * 60)

    # Load eval set
    eval_set = load_eval_set()
    print(f"\nLoaded {len(eval_set)} evaluation sentences")

    # Load model
    model, tokenizer, device = load_nllb_model()

    # Group by domain
    domains = {}
    for item in eval_set:
        domain = item.get('domain', 'unknown')
        if domain not in domains:
            domains[domain] = []
        domains[domain].append(item)

    print(f"Domains: {', '.join(f'{d} ({len(items)})' for d, items in domains.items())}")

    # Translate all sentences
    print(f"\nTranslating with NLLB-200...")
    hypotheses = []
    references = []
    empty_count = 0

    for i, item in enumerate(eval_set):
        hyp = translate_nllb(model, tokenizer, device, item['somali'])
        hypotheses.append(hyp)
        references.append(item['swahili_refs'])

        if not hyp.strip():
            empty_count += 1

        if (i + 1) % 10 == 0:
            print(f"  {i + 1}/{len(eval_set)} translated...")

    # Compute overall chrF++
    overall_score = compute_chrf_multiref(hypotheses, references)
    print(f"\n{'=' * 60}")
    print(f"OVERALL chrF++ (multi-reference): {overall_score:.1f}")
    print(f"Empty outputs: {empty_count}/{len(eval_set)} ({100*empty_count//len(eval_set)}%)")
    print(f"{'=' * 60}")

    # Compute per-domain scores
    domain_scores = {}
    for domain, items in domains.items():
        domain_hyps = []
        domain_refs = []
        for item in items:
            idx = eval_set.index(item)
            domain_hyps.append(hypotheses[idx])
            domain_refs.append(references[idx])

        score = compute_chrf_multiref(domain_hyps, domain_refs)
        domain_scores[domain] = score
        print(f"  {domain}: {score:.1f}")

    # Sample outputs
    print(f"\n{'=' * 60}")
    print("SAMPLE TRANSLATIONS (NLLB-200)")
    print("=" * 60)
    for item, hyp in zip(eval_set[:5], hypotheses[:5]):
        print(f"\nSomali:   {item['somali']}")
        print(f"NLLB:     {hyp}")
        print(f"Refs:     {' | '.join(item['swahili_refs'])}")

    # Save results
    results = {
        "model": "facebook/nllb-200-distilled-600M",
        "num_sentences": len(eval_set),
        "overall_chrf": overall_score,
        "empty_count": empty_count,
        "empty_rate": empty_count / len(eval_set),
        "domain_scores": domain_scores,
        "translations": [
            {
                "id": item.get('id', f'sent_{i}'),
                "somali": item['somali'],
                "hypothesis": hyp,
                "references": item['swahili_refs'],
                "english": item.get('english', '')
            }
            for i, (item, hyp) in enumerate(zip(eval_set, hypotheses))
        ]
    }

    with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nResults saved to {RESULTS_FILE}")

    return results


if __name__ == "__main__":
    run_baseline()
