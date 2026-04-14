"""Corpus Validator using semantic similarity filtering.

This module validates synthetic parallel corpora using multilingual embeddings
(LaBSE) to ensure semantic preservation after translation.
"""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of validating a single sentence pair."""
    source: str
    target: str
    similarity_score: float
    back_translation_score: Optional[float]
    length_ratio: float
    passed: bool
    rejection_reason: Optional[str] = None


@dataclass
class CorpusValidationReport:
    """Summary report for corpus validation."""
    total_pairs: int
    passed_pairs: int
    rejected_pairs: int
    pass_rate: float
    avg_similarity: float
    rejection_reasons: Dict[str, int]
    score_distribution: Dict[str, int]  # binned scores


class EmbeddingModel:
    """Wrapper for multilingual embedding models."""

    def __init__(self, model_name: str = "sentence-transformers/LaBSE"):
        """Initialize embedding model.

        Args:
            model_name: HuggingFace model identifier
        """
        self.model_name = model_name
        self.model = None

    def load(self):
        """Lazy load the model."""
        if self.model is not None:
            return

        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            logger.info("Embedding model loaded")
        except ImportError:
            logger.error("sentence-transformers library required")
            raise

    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Encode texts to embeddings.

        Args:
            texts: List of texts to encode
            batch_size: Batch size for encoding

        Returns:
            NumPy array of embeddings
        """
        self.load()
        return self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=len(texts) > 100,
            normalize_embeddings=True
        )

    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Compute cosine similarity between two embeddings.

        Args:
            emb1: First embedding
            emb2: Second embedding

        Returns:
            Cosine similarity score
        """
        # Embeddings are already normalized, so dot product = cosine sim
        return float(np.dot(emb1, emb2))


class MockEmbeddingModel:
    """Mock embedding model for testing without GPU."""

    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Return random embeddings for testing."""
        return np.random.randn(len(texts), 768).astype(np.float32)

    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Return random similarity for testing."""
        return np.random.uniform(0.5, 1.0)


class CorpusValidator:
    """Validate parallel corpora using semantic similarity and heuristics."""

    def __init__(
        self,
        embedding_model: Optional[EmbeddingModel] = None,
        similarity_threshold: float = 0.75,
        min_length: int = 5,
        max_length: int = 500,
        max_length_ratio: float = 3.0
    ):
        """Initialize the validator.

        Args:
            embedding_model: Model for computing semantic similarity
            similarity_threshold: Minimum similarity score to pass
            min_length: Minimum character length
            max_length: Maximum character length
            max_length_ratio: Maximum source/target length ratio
        """
        self.embedding_model = embedding_model or EmbeddingModel()
        self.similarity_threshold = similarity_threshold
        self.min_length = min_length
        self.max_length = max_length
        self.max_length_ratio = max_length_ratio

    def validate_pair(
        self,
        source: str,
        target: str,
        back_translation: Optional[str] = None
    ) -> ValidationResult:
        """Validate a single parallel sentence pair.

        Args:
            source: Source language text
            target: Target language text
            back_translation: Optional back-translation for comparison

        Returns:
            ValidationResult with scores and pass/fail status
        """
        # Length checks
        src_len = len(source)
        tgt_len = len(target)

        if src_len < self.min_length or tgt_len < self.min_length:
            return ValidationResult(
                source=source,
                target=target,
                similarity_score=0.0,
                back_translation_score=None,
                length_ratio=0.0,
                passed=False,
                rejection_reason="too_short"
            )

        if src_len > self.max_length or tgt_len > self.max_length:
            return ValidationResult(
                source=source,
                target=target,
                similarity_score=0.0,
                back_translation_score=None,
                length_ratio=0.0,
                passed=False,
                rejection_reason="too_long"
            )

        length_ratio = max(src_len, tgt_len) / max(min(src_len, tgt_len), 1)
        if length_ratio > self.max_length_ratio:
            return ValidationResult(
                source=source,
                target=target,
                similarity_score=0.0,
                back_translation_score=None,
                length_ratio=length_ratio,
                passed=False,
                rejection_reason="length_ratio"
            )

        # Compute semantic similarity
        try:
            embeddings = self.embedding_model.encode([source, target])
            similarity = self.embedding_model.cosine_similarity(
                embeddings[0], embeddings[1]
            )
        except Exception as e:
            logger.warning(f"Embedding failed: {e}")
            similarity = 0.0

        # Back-translation similarity if available
        bt_score = None
        if back_translation:
            try:
                bt_emb = self.embedding_model.encode([source, back_translation])
                bt_score = self.embedding_model.cosine_similarity(
                    bt_emb[0], bt_emb[1]
                )
            except Exception:
                pass

        # Determine pass/fail
        passed = similarity >= self.similarity_threshold
        rejection_reason = None if passed else "low_similarity"

        return ValidationResult(
            source=source,
            target=target,
            similarity_score=similarity,
            back_translation_score=bt_score,
            length_ratio=length_ratio,
            passed=passed,
            rejection_reason=rejection_reason
        )

    def validate_batch(
        self,
        pairs: List[Tuple[str, str]],
        back_translations: Optional[List[str]] = None,
        batch_size: int = 64
    ) -> Iterator[ValidationResult]:
        """Validate a batch of parallel pairs efficiently.

        Args:
            pairs: List of (source, target) tuples
            back_translations: Optional list of back-translations
            batch_size: Batch size for embedding computation

        Yields:
            ValidationResult for each pair
        """
        if not pairs:
            return

        logger.info(f"Validating {len(pairs)} pairs...")

        # Pre-filter by length
        valid_indices = []
        for i, (src, tgt) in enumerate(pairs):
            src_len = len(src)
            tgt_len = len(tgt)

            if src_len < self.min_length or tgt_len < self.min_length:
                yield ValidationResult(
                    source=src, target=tgt,
                    similarity_score=0.0, back_translation_score=None,
                    length_ratio=0.0, passed=False,
                    rejection_reason="too_short"
                )
            elif src_len > self.max_length or tgt_len > self.max_length:
                yield ValidationResult(
                    source=src, target=tgt,
                    similarity_score=0.0, back_translation_score=None,
                    length_ratio=0.0, passed=False,
                    rejection_reason="too_long"
                )
            else:
                length_ratio = max(src_len, tgt_len) / max(min(src_len, tgt_len), 1)
                if length_ratio > self.max_length_ratio:
                    yield ValidationResult(
                        source=src, target=tgt,
                        similarity_score=0.0, back_translation_score=None,
                        length_ratio=length_ratio, passed=False,
                        rejection_reason="length_ratio"
                    )
                else:
                    valid_indices.append(i)

        if not valid_indices:
            return

        # Batch encode remaining pairs
        sources = [pairs[i][0] for i in valid_indices]
        targets = [pairs[i][1] for i in valid_indices]

        try:
            all_texts = sources + targets
            embeddings = self.embedding_model.encode(all_texts, batch_size)
            source_embs = embeddings[:len(sources)]
            target_embs = embeddings[len(sources):]
        except Exception as e:
            logger.error(f"Batch encoding failed: {e}")
            for i in valid_indices:
                yield ValidationResult(
                    source=pairs[i][0], target=pairs[i][1],
                    similarity_score=0.0, back_translation_score=None,
                    length_ratio=1.0, passed=False,
                    rejection_reason="encoding_error"
                )
            return

        # Compute similarities and yield results
        for idx, orig_idx in enumerate(valid_indices):
            src, tgt = pairs[orig_idx]
            similarity = self.embedding_model.cosine_similarity(
                source_embs[idx], target_embs[idx]
            )

            bt_score = None
            if back_translations and orig_idx < len(back_translations):
                bt = back_translations[orig_idx]
                if bt:
                    try:
                        bt_emb = self.embedding_model.encode([bt])
                        bt_score = self.embedding_model.cosine_similarity(
                            source_embs[idx], bt_emb[0]
                        )
                    except Exception:
                        pass

            length_ratio = max(len(src), len(tgt)) / max(min(len(src), len(tgt)), 1)
            passed = similarity >= self.similarity_threshold

            yield ValidationResult(
                source=src,
                target=tgt,
                similarity_score=similarity,
                back_translation_score=bt_score,
                length_ratio=length_ratio,
                passed=passed,
                rejection_reason=None if passed else "low_similarity"
            )

    def filter_corpus(
        self,
        pairs: List[Tuple[str, str]],
        back_translations: Optional[List[str]] = None
    ) -> Tuple[List[Tuple[str, str]], CorpusValidationReport]:
        """Filter corpus and return passing pairs with report.

        Args:
            pairs: List of (source, target) tuples
            back_translations: Optional back-translations

        Returns:
            Tuple of (filtered_pairs, validation_report)
        """
        passing_pairs = []
        rejection_reasons: Dict[str, int] = {}
        scores = []

        for result in self.validate_batch(pairs, back_translations):
            if result.passed:
                passing_pairs.append((result.source, result.target))
            else:
                reason = result.rejection_reason or "unknown"
                rejection_reasons[reason] = rejection_reasons.get(reason, 0) + 1

            scores.append(result.similarity_score)

        # Compute score distribution
        score_bins = {
            "0.0-0.5": 0,
            "0.5-0.6": 0,
            "0.6-0.7": 0,
            "0.7-0.8": 0,
            "0.8-0.9": 0,
            "0.9-1.0": 0
        }
        for s in scores:
            if s < 0.5:
                score_bins["0.0-0.5"] += 1
            elif s < 0.6:
                score_bins["0.5-0.6"] += 1
            elif s < 0.7:
                score_bins["0.6-0.7"] += 1
            elif s < 0.8:
                score_bins["0.7-0.8"] += 1
            elif s < 0.9:
                score_bins["0.8-0.9"] += 1
            else:
                score_bins["0.9-1.0"] += 1

        report = CorpusValidationReport(
            total_pairs=len(pairs),
            passed_pairs=len(passing_pairs),
            rejected_pairs=len(pairs) - len(passing_pairs),
            pass_rate=len(passing_pairs) / len(pairs) if pairs else 0.0,
            avg_similarity=sum(scores) / len(scores) if scores else 0.0,
            rejection_reasons=rejection_reasons,
            score_distribution=score_bins
        )

        return passing_pairs, report

    def save_report(
        self,
        report: CorpusValidationReport,
        output_path: str
    ):
        """Save validation report to JSON file.

        Args:
            report: Validation report
            output_path: Path to save report
        """
        report_dict = {
            "total_pairs": report.total_pairs,
            "passed_pairs": report.passed_pairs,
            "rejected_pairs": report.rejected_pairs,
            "pass_rate": report.pass_rate,
            "avg_similarity": report.avg_similarity,
            "rejection_reasons": report.rejection_reasons,
            "score_distribution": report.score_distribution
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, indent=2)

        logger.info(f"Saved validation report to {output_path}")


def run_validation_pipeline(
    source_file: str,
    target_file: str,
    output_dir: str,
    similarity_threshold: float = 0.75
) -> CorpusValidationReport:
    """Run full validation pipeline on parallel files.

    Args:
        source_file: Path to source language file
        target_file: Path to target language file
        output_dir: Directory for output files
        similarity_threshold: Minimum similarity threshold

    Returns:
        Validation report
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Load pairs
    with open(source_file, "r", encoding="utf-8") as sf, \
         open(target_file, "r", encoding="utf-8") as tf:
        pairs = list(zip(sf.read().splitlines(), tf.read().splitlines()))

    logger.info(f"Loaded {len(pairs)} pairs for validation")

    # Validate
    validator = CorpusValidator(similarity_threshold=similarity_threshold)
    filtered_pairs, report = validator.filter_corpus(pairs)

    # Save filtered corpus
    source_out = output_path / Path(source_file).name.replace(".", "_filtered.")
    target_out = output_path / Path(target_file).name.replace(".", "_filtered.")

    with open(source_out, "w", encoding="utf-8") as sf, \
         open(target_out, "w", encoding="utf-8") as tf:
        for src, tgt in filtered_pairs:
            sf.write(src + "\n")
            tf.write(tgt + "\n")

    # Save report
    validator.save_report(report, str(output_path / "validation_report.json"))

    logger.info(f"Validation complete: {report.pass_rate:.1%} pass rate")
    return report


if __name__ == "__main__":
    # Example usage with mock model
    mock_model = MockEmbeddingModel()
    validator = CorpusValidator(
        embedding_model=mock_model,
        similarity_threshold=0.7
    )

    test_pairs = [
        ("Hello, how are you?", "Habari, hujambo?"),
        ("Short", "S"),  # Should fail: too short
        ("I need medical help", "Ninahitaji msaada wa matibabu"),
    ]

    for result in validator.validate_batch(test_pairs):
        status = "PASS" if result.passed else f"FAIL ({result.rejection_reason})"
        print(f"{status}: sim={result.similarity_score:.3f}")
