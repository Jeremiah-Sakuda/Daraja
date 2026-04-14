"""Evaluation utilities for Daraja translation models.

Implements BLEU, chrF++, and custom round-trip evaluation metrics.
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    """Results from model evaluation."""
    model_name: str
    language_pair: str
    test_set: str
    num_samples: int

    # Core metrics
    bleu: float
    chrf: float
    chrf_plus_plus: Optional[float] = None

    # Round-trip metrics
    round_trip_bleu: Optional[float] = None
    semantic_preservation: Optional[float] = None

    # Per-domain scores
    domain_scores: Dict[str, Dict[str, float]] = field(default_factory=dict)

    # Confidence metrics
    avg_confidence: Optional[float] = None
    high_confidence_rate: Optional[float] = None  # % above 0.8

    metadata: Dict[str, Any] = field(default_factory=dict)


class Evaluator:
    """Evaluate translation model quality."""

    def __init__(
        self,
        source_lang: str = "so",
        target_lang: str = "sw"
    ):
        """Initialize evaluator.

        Args:
            source_lang: Source language code
            target_lang: Target language code
        """
        self.source_lang = source_lang
        self.target_lang = target_lang
        self._sacrebleu = None
        self._chrf = None

    def _load_sacrebleu(self):
        """Lazy load sacrebleu."""
        if self._sacrebleu is None:
            try:
                import sacrebleu
                self._sacrebleu = sacrebleu
            except ImportError:
                logger.error("sacrebleu required: pip install sacrebleu")
                raise
        return self._sacrebleu

    def compute_bleu(
        self,
        hypotheses: List[str],
        references: List[List[str]]
    ) -> float:
        """Compute BLEU score using SacreBLEU.

        Args:
            hypotheses: Model outputs
            references: Reference translations (list of lists for multi-ref)

        Returns:
            BLEU score (0-100)
        """
        sacrebleu = self._load_sacrebleu()

        # SacreBLEU expects references as list of lists
        if references and not isinstance(references[0], list):
            references = [[ref] for ref in references]

        # Transpose for sacrebleu format
        refs_transposed = list(zip(*references))

        bleu = sacrebleu.corpus_bleu(hypotheses, refs_transposed)
        return bleu.score

    def compute_chrf(
        self,
        hypotheses: List[str],
        references: List[str],
        word_order: int = 2  # chrF++ uses word_order=2
    ) -> float:
        """Compute chrF/chrF++ score.

        Args:
            hypotheses: Model outputs
            references: Reference translations
            word_order: Word n-gram order (2 for chrF++)

        Returns:
            chrF score (0-100)
        """
        sacrebleu = self._load_sacrebleu()

        chrf = sacrebleu.corpus_chrf(
            hypotheses,
            [references],
            word_order=word_order
        )
        return chrf.score

    def compute_round_trip_score(
        self,
        sources: List[str],
        back_translations: List[str]
    ) -> float:
        """Compute round-trip BLEU (source vs back-translation).

        Measures semantic preservation through translation round-trip.

        Args:
            sources: Original source texts
            back_translations: Texts translated to target and back

        Returns:
            Round-trip BLEU score
        """
        return self.compute_bleu(back_translations, [[s] for s in sources])

    def evaluate_model(
        self,
        translate_fn,
        test_sources: List[str],
        test_references: List[str],
        model_name: str = "daraja",
        test_set_name: str = "test",
        compute_round_trip: bool = True,
        back_translate_fn=None
    ) -> EvaluationResult:
        """Run full evaluation on a model.

        Args:
            translate_fn: Function that takes source text and returns translation
            test_sources: Source language test sentences
            test_references: Reference translations
            model_name: Name of model being evaluated
            test_set_name: Name of test set
            compute_round_trip: Whether to compute round-trip metrics
            back_translate_fn: Function for back-translation (target -> source)

        Returns:
            EvaluationResult with all metrics
        """
        logger.info(f"Evaluating {model_name} on {len(test_sources)} examples...")

        # Generate translations
        hypotheses = []
        for i, source in enumerate(test_sources):
            if i % 100 == 0:
                logger.info(f"Translating {i}/{len(test_sources)}")
            try:
                hyp = translate_fn(source)
                hypotheses.append(hyp)
            except Exception as e:
                logger.warning(f"Translation failed: {e}")
                hypotheses.append("")

        # Compute core metrics
        bleu = self.compute_bleu(hypotheses, [[ref] for ref in test_references])
        chrf = self.compute_chrf(hypotheses, test_references, word_order=0)
        chrf_pp = self.compute_chrf(hypotheses, test_references, word_order=2)

        logger.info(f"BLEU: {bleu:.2f}, chrF: {chrf:.2f}, chrF++: {chrf_pp:.2f}")

        # Round-trip evaluation
        rt_bleu = None
        if compute_round_trip and back_translate_fn:
            logger.info("Computing round-trip scores...")
            back_translations = []
            for hyp in hypotheses:
                try:
                    back = back_translate_fn(hyp)
                    back_translations.append(back)
                except Exception:
                    back_translations.append("")

            rt_bleu = self.compute_round_trip_score(test_sources, back_translations)
            logger.info(f"Round-trip BLEU: {rt_bleu:.2f}")

        return EvaluationResult(
            model_name=model_name,
            language_pair=f"{self.source_lang}-{self.target_lang}",
            test_set=test_set_name,
            num_samples=len(test_sources),
            bleu=bleu,
            chrf=chrf,
            chrf_plus_plus=chrf_pp,
            round_trip_bleu=rt_bleu
        )

    def evaluate_by_domain(
        self,
        translate_fn,
        test_data: List[Dict[str, str]],
        model_name: str = "daraja"
    ) -> Dict[str, EvaluationResult]:
        """Evaluate model performance by domain.

        Args:
            translate_fn: Translation function
            test_data: List of dicts with 'source', 'target', 'domain' keys
            model_name: Model name

        Returns:
            Dict mapping domain names to EvaluationResults
        """
        # Group by domain
        by_domain: Dict[str, List[Dict]] = {}
        for item in test_data:
            domain = item.get("domain", "general")
            if domain not in by_domain:
                by_domain[domain] = []
            by_domain[domain].append(item)

        # Evaluate each domain
        results = {}
        for domain, items in by_domain.items():
            sources = [item["source"] for item in items]
            references = [item["target"] for item in items]

            result = self.evaluate_model(
                translate_fn,
                sources,
                references,
                model_name=model_name,
                test_set_name=f"domain_{domain}",
                compute_round_trip=False
            )
            results[domain] = result

        return results

    def compare_baselines(
        self,
        models: Dict[str, Any],  # name -> translate_fn
        test_sources: List[str],
        test_references: List[str],
        test_set_name: str = "test"
    ) -> List[EvaluationResult]:
        """Compare multiple models on the same test set.

        Args:
            models: Dict mapping model names to translation functions
            test_sources: Source test sentences
            test_references: Reference translations
            test_set_name: Name of test set

        Returns:
            List of EvaluationResults, sorted by BLEU
        """
        results = []

        for model_name, translate_fn in models.items():
            logger.info(f"\n--- Evaluating {model_name} ---")
            result = self.evaluate_model(
                translate_fn,
                test_sources,
                test_references,
                model_name=model_name,
                test_set_name=test_set_name,
                compute_round_trip=False
            )
            results.append(result)

        # Sort by BLEU
        results.sort(key=lambda r: r.bleu, reverse=True)

        # Log comparison
        logger.info("\n=== Model Comparison ===")
        for r in results:
            logger.info(f"{r.model_name}: BLEU={r.bleu:.2f}, chrF++={r.chrf_plus_plus:.2f}")

        return results

    def save_results(
        self,
        results: List[EvaluationResult],
        output_path: str
    ):
        """Save evaluation results to JSON.

        Args:
            results: List of evaluation results
            output_path: Path to save JSON file
        """
        output = []
        for r in results:
            output.append({
                "model_name": r.model_name,
                "language_pair": r.language_pair,
                "test_set": r.test_set,
                "num_samples": r.num_samples,
                "bleu": r.bleu,
                "chrf": r.chrf,
                "chrf_plus_plus": r.chrf_plus_plus,
                "round_trip_bleu": r.round_trip_bleu,
                "semantic_preservation": r.semantic_preservation,
                "domain_scores": r.domain_scores,
                "avg_confidence": r.avg_confidence,
                "high_confidence_rate": r.high_confidence_rate,
                "metadata": r.metadata
            })

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)

        logger.info(f"Saved results to {output_path}")

    def generate_report(
        self,
        results: List[EvaluationResult],
        output_path: str
    ):
        """Generate markdown evaluation report.

        Args:
            results: Evaluation results
            output_path: Path to save markdown report
        """
        lines = [
            "# Daraja Evaluation Results\n",
            f"## Language Pair: {results[0].language_pair}\n" if results else "",
            "\n## Model Comparison\n",
            "| Model | BLEU | chrF | chrF++ | Round-trip |",
            "|-------|------|------|--------|------------|"
        ]

        for r in results:
            rt = f"{r.round_trip_bleu:.2f}" if r.round_trip_bleu else "—"
            lines.append(
                f"| {r.model_name} | {r.bleu:.2f} | {r.chrf:.2f} | "
                f"{r.chrf_plus_plus:.2f} | {rt} |"
            )

        lines.extend([
            "\n## Notes\n",
            "- BLEU: BiLingual Evaluation Understudy (higher is better)",
            "- chrF++: Character F-score with word n-grams (higher is better)",
            "- Round-trip: BLEU between source and back-translation",
        ])

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        logger.info(f"Generated report at {output_path}")


def load_test_set(
    source_file: str,
    target_file: str,
    domain_file: Optional[str] = None
) -> Tuple[List[str], List[str], Optional[List[str]]]:
    """Load test set from files.

    Args:
        source_file: Path to source sentences
        target_file: Path to target sentences
        domain_file: Optional path to domain labels

    Returns:
        Tuple of (sources, targets, domains)
    """
    with open(source_file, "r", encoding="utf-8") as f:
        sources = f.read().splitlines()

    with open(target_file, "r", encoding="utf-8") as f:
        targets = f.read().splitlines()

    domains = None
    if domain_file and Path(domain_file).exists():
        with open(domain_file, "r", encoding="utf-8") as f:
            domains = f.read().splitlines()

    return sources, targets, domains


if __name__ == "__main__":
    # Example usage
    evaluator = Evaluator(source_lang="so", target_lang="sw")

    # Mock translation function
    def mock_translate(text):
        return f"[translated] {text}"

    # Test data
    sources = ["Waxaan rabaa caafimaad", "Qoyskaygii waa ku suganyahay"]
    references = ["Nataka afya njema", "Familia yangu iko"]

    result = evaluator.evaluate_model(
        mock_translate,
        sources,
        references,
        model_name="mock",
        compute_round_trip=False
    )

    print(f"BLEU: {result.bleu:.2f}")
    print(f"chrF++: {result.chrf_plus_plus:.2f}")
