"""
Daraja Humanitarian Evaluation Script
Runs multi-reference chrF++ and optional LLM-as-judge scoring
"""

import json
import requests
from pathlib import Path
from sacrebleu.metrics import CHRF

EVAL_FILE = Path(__file__).parent / "humanitarian_eval_set.jsonl"
RESULTS_FILE = Path(__file__).parent / "eval_results.json"
OLLAMA_URL = "http://localhost:11434/api/generate"


def load_eval_set():
    """Load evaluation sentences from JSONL file"""
    sentences = []
    with open(EVAL_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            sentences.append(json.loads(line.strip()))
    return sentences


def translate_with_ollama(somali_text: str, model: str = "daraja-so-sw") -> str:
    """Call Ollama API to translate Somali to Swahili"""
    try:
        prompt = f"Translate Somali to Swahili:\n{somali_text}\nSwahili:\n"
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": 100,
                    "stop": ["\n"]
                }
            },
            timeout=60
        )
        result = response.json()
        translation = result.get("response", "").strip()

        # Clean up common artifacts
        # Handle "English - Swahili" format
        if " - " in translation:
            parts = translation.split(" - ")
            # Take the part that looks like Swahili (not English)
            for part in reversed(parts):
                part = part.strip().strip('"').strip()
                # Skip if it looks like English (contains common English words)
                if not any(eng in part.lower() for eng in ['the ', 'a ', 'is ', 'i ', 'my ', 'you ']):
                    translation = part
                    break

        # Handle "Word: Translation" format
        if ":" in translation and translation.index(":") < len(translation) // 2:
            translation = translation.split(":", 1)[-1].strip()

        translation = translation.strip('"').strip("'").strip()

        # Remove trailing punctuation artifacts
        translation = translation.rstrip('."\'')

        return translation
    except Exception as e:
        print(f"Error translating '{somali_text}': {e}")
        return ""


def compute_chrf_multiref(hypotheses: list, references_list: list) -> float:
    """
    Compute chrF++ with multiple references per sentence.
    references_list: list of lists, where each inner list contains valid references
    """
    chrf = CHRF()

    # sacrebleu expects references as list of lists where each inner list
    # contains all references for that position across the corpus
    # We need to transpose: from [sent1_refs, sent2_refs, ...]
    # to [all_ref1s, all_ref2s, all_ref3s]

    max_refs = max(len(refs) for refs in references_list)

    # Pad references to same length
    padded_refs = []
    for refs in references_list:
        padded = refs + [refs[0]] * (max_refs - len(refs))  # Repeat first ref to pad
        padded_refs.append(padded)

    # Transpose
    transposed = list(zip(*padded_refs))
    transposed = [list(t) for t in transposed]

    score = chrf.corpus_score(hypotheses, transposed)
    return score.score


def run_evaluation(model: str = "daraja-so-sw"):
    """Run full evaluation pipeline"""
    print("=" * 60)
    print("DARAJA HUMANITARIAN EVALUATION")
    print("=" * 60)

    # Load eval set
    eval_set = load_eval_set()
    print(f"\nLoaded {len(eval_set)} evaluation sentences")

    # Group by domain
    domains = {}
    for item in eval_set:
        domain = item['domain']
        if domain not in domains:
            domains[domain] = []
        domains[domain].append(item)

    print(f"Domains: {', '.join(f'{d} ({len(items)})' for d, items in domains.items())}")

    # Translate all sentences
    print(f"\nTranslating with model: {model}")
    hypotheses = []
    references = []

    for i, item in enumerate(eval_set):
        hyp = translate_with_ollama(item['somali'], model)
        hypotheses.append(hyp)
        references.append(item['swahili_refs'])

        if (i + 1) % 10 == 0:
            print(f"  {i + 1}/{len(eval_set)} translated...")

    # Compute overall chrF++
    overall_score = compute_chrf_multiref(hypotheses, references)
    print(f"\n{'=' * 60}")
    print(f"OVERALL chrF++ (multi-reference): {overall_score:.1f}")
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
    print("SAMPLE TRANSLATIONS")
    print("=" * 60)
    for item, hyp in zip(eval_set[:5], hypotheses[:5]):
        print(f"\nSomali:   {item['somali']}")
        print(f"Got:      {hyp}")
        print(f"Refs:     {' | '.join(item['swahili_refs'])}")

    # Save results
    results = {
        "model": model,
        "num_sentences": len(eval_set),
        "overall_chrf": overall_score,
        "domain_scores": domain_scores,
        "translations": [
            {
                "id": item['id'],
                "somali": item['somali'],
                "hypothesis": hyp,
                "references": item['swahili_refs'],
                "english": item['english']
            }
            for item, hyp in zip(eval_set, hypotheses)
        ]
    }

    with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nResults saved to {RESULTS_FILE}")

    return results


if __name__ == "__main__":
    import sys
    model = sys.argv[1] if len(sys.argv) > 1 else "daraja-so-sw"
    run_evaluation(model)
