"""Seed Data Loader for OPUS, JW300, and Flores-200 corpora.

This module provides utilities to download and load parallel corpora
from multiple sources into a unified format for the Daraja pipeline.
"""

import os
import gzip
import zipfile
import requests
from pathlib import Path
from typing import Iterator, Optional, Tuple, List, Dict, Any
from dataclasses import dataclass, field
import logging

try:
    from datasets import load_dataset
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ParallelSentence:
    """A single parallel sentence pair."""
    source: str
    target: str
    source_lang: str
    target_lang: str
    corpus: str
    domain: str = "general"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CorpusStats:
    """Statistics for a loaded corpus."""
    total_pairs: int
    source_tokens: int
    target_tokens: int
    source_vocab_size: int
    target_vocab_size: int
    avg_source_length: float
    avg_target_length: float
    corpus_name: str
    language_pair: str


class SeedDataLoader:
    """Unified loader for parallel corpora from multiple sources."""

    OPUS_BASE_URL = "https://opus.nlpl.eu/download.php"
    FLORES_HF_REPO = "facebook/flores"

    def __init__(
        self,
        data_dir: str = "./data/seed",
        source_lang: str = "so",
        target_lang: str = "sw",
        cache_downloads: bool = True
    ):
        """Initialize the seed data loader.

        Args:
            data_dir: Directory to store downloaded data
            source_lang: ISO 639-1 source language code
            target_lang: ISO 639-1 target language code
            cache_downloads: Whether to cache downloaded files
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.source_lang = source_lang
        self.target_lang = target_lang
        self.cache_downloads = cache_downloads
        self._vocab_source: set = set()
        self._vocab_target: set = set()

    def load_opus(
        self,
        corpus_name: str = "JW300",
        max_pairs: Optional[int] = None
    ) -> Iterator[ParallelSentence]:
        """Load parallel data from OPUS corpus.

        Args:
            corpus_name: Name of OPUS corpus (e.g., JW300, WikiMatrix)
            max_pairs: Maximum number of pairs to load

        Yields:
            ParallelSentence objects
        """
        logger.info(f"Loading OPUS corpus: {corpus_name}")

        # Construct file paths
        pair_code = f"{self.source_lang}-{self.target_lang}"
        alt_pair_code = f"{self.target_lang}-{self.source_lang}"

        # Try to load from HuggingFace OPUS datasets first
        if HF_AVAILABLE:
            try:
                dataset = load_dataset(
                    "opus100",
                    f"{self.source_lang}-{self.target_lang}",
                    split="train",
                    trust_remote_code=True
                )
                count = 0
                for item in dataset:
                    if max_pairs and count >= max_pairs:
                        break
                    yield ParallelSentence(
                        source=item["translation"][self.source_lang],
                        target=item["translation"][self.target_lang],
                        source_lang=self.source_lang,
                        target_lang=self.target_lang,
                        corpus=f"opus_{corpus_name}",
                        metadata={"opus_subset": corpus_name}
                    )
                    count += 1
                logger.info(f"Loaded {count} pairs from OPUS via HuggingFace")
                return
            except Exception as e:
                logger.warning(f"HuggingFace OPUS load failed: {e}")

        # Fallback to direct download
        cache_file = self.data_dir / f"opus_{corpus_name}_{pair_code}.txt.gz"

        if not cache_file.exists():
            logger.info(f"Downloading {corpus_name} from OPUS...")
            self._download_opus(corpus_name, cache_file)

        if cache_file.exists():
            yield from self._parse_opus_file(cache_file, corpus_name, max_pairs)

    def _download_opus(self, corpus_name: str, output_path: Path) -> None:
        """Download corpus from OPUS."""
        # OPUS download URL format varies by corpus
        pair = f"{self.source_lang}-{self.target_lang}"
        url = f"https://object.pouta.csc.fi/OPUS-{corpus_name}/v1/moses/{pair}.txt.zip"

        try:
            response = requests.get(url, stream=True, timeout=300)
            response.raise_for_status()

            zip_path = output_path.with_suffix(".zip")
            with open(zip_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            # Extract and process
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(output_path.parent)

            logger.info(f"Downloaded and extracted {corpus_name}")

        except Exception as e:
            logger.error(f"Failed to download {corpus_name}: {e}")

    def _parse_opus_file(
        self,
        file_path: Path,
        corpus_name: str,
        max_pairs: Optional[int]
    ) -> Iterator[ParallelSentence]:
        """Parse OPUS moses format files."""
        source_file = file_path.parent / f"{corpus_name}.{self.source_lang}-{self.target_lang}.{self.source_lang}"
        target_file = file_path.parent / f"{corpus_name}.{self.source_lang}-{self.target_lang}.{self.target_lang}"

        if not source_file.exists() or not target_file.exists():
            logger.warning(f"OPUS files not found: {source_file}, {target_file}")
            return

        count = 0
        with open(source_file, "r", encoding="utf-8") as sf, \
             open(target_file, "r", encoding="utf-8") as tf:
            for source_line, target_line in zip(sf, tf):
                if max_pairs and count >= max_pairs:
                    break

                source = source_line.strip()
                target = target_line.strip()

                if source and target:
                    yield ParallelSentence(
                        source=source,
                        target=target,
                        source_lang=self.source_lang,
                        target_lang=self.target_lang,
                        corpus=f"opus_{corpus_name}",
                    )
                    count += 1

    def load_flores200(
        self,
        split: str = "devtest",
        max_pairs: Optional[int] = None
    ) -> Iterator[ParallelSentence]:
        """Load parallel data from Flores-200 benchmark.

        Args:
            split: Dataset split (dev, devtest)
            max_pairs: Maximum number of pairs to load

        Yields:
            ParallelSentence objects
        """
        if not HF_AVAILABLE:
            logger.error("datasets library required for Flores-200")
            return

        logger.info(f"Loading Flores-200 {split} split")

        # Flores uses different language codes
        flores_lang_map = {
            "so": "som_Latn",  # Somali
            "sw": "swh_Latn",  # Swahili
            "ti": "tir_Ethi",  # Tigrinya
            "ar": "arb_Arab",  # Arabic
            "prs": "prs_Arab", # Dari
            "tr": "tur_Latn",  # Turkish
        }

        source_code = flores_lang_map.get(self.source_lang, self.source_lang)
        target_code = flores_lang_map.get(self.target_lang, self.target_lang)

        try:
            dataset = load_dataset(
                "facebook/flores",
                f"{source_code}-{target_code}",
                split=split,
                trust_remote_code=True
            )
        except Exception:
            # Try loading individual languages and aligning
            try:
                source_ds = load_dataset(
                    "facebook/flores",
                    source_code,
                    split=split,
                    trust_remote_code=True
                )
                target_ds = load_dataset(
                    "facebook/flores",
                    target_code,
                    split=split,
                    trust_remote_code=True
                )

                count = 0
                for src_item, tgt_item in zip(source_ds, target_ds):
                    if max_pairs and count >= max_pairs:
                        break

                    yield ParallelSentence(
                        source=src_item["sentence"],
                        target=tgt_item["sentence"],
                        source_lang=self.source_lang,
                        target_lang=self.target_lang,
                        corpus="flores200",
                        metadata={"split": split}
                    )
                    count += 1

                logger.info(f"Loaded {count} pairs from Flores-200")
                return

            except Exception as e:
                logger.error(f"Failed to load Flores-200: {e}")
                return

        count = 0
        for item in dataset:
            if max_pairs and count >= max_pairs:
                break

            yield ParallelSentence(
                source=item["sentence_" + source_code],
                target=item["sentence_" + target_code],
                source_lang=self.source_lang,
                target_lang=self.target_lang,
                corpus="flores200",
                metadata={"split": split}
            )
            count += 1

        logger.info(f"Loaded {count} pairs from Flores-200")

    def load_jw300(self, max_pairs: Optional[int] = None) -> Iterator[ParallelSentence]:
        """Load JW300 corpus (via OPUS).

        JW300 is a parallel corpus from Jehovah's Witnesses publications,
        available through OPUS.
        """
        yield from self.load_opus("JW300", max_pairs)

    def load_all(
        self,
        corpora: Optional[List[str]] = None,
        max_pairs_per_corpus: Optional[int] = None
    ) -> Iterator[ParallelSentence]:
        """Load from all specified corpora.

        Args:
            corpora: List of corpus names to load (default: all available)
            max_pairs_per_corpus: Max pairs per corpus

        Yields:
            ParallelSentence objects from all sources
        """
        if corpora is None:
            corpora = ["jw300", "flores200"]

        for corpus in corpora:
            corpus_lower = corpus.lower()
            if corpus_lower == "jw300":
                yield from self.load_jw300(max_pairs_per_corpus)
            elif corpus_lower == "flores200":
                yield from self.load_flores200(max_pairs=max_pairs_per_corpus)
            elif corpus_lower.startswith("opus_"):
                opus_name = corpus[5:]
                yield from self.load_opus(opus_name, max_pairs_per_corpus)
            else:
                logger.warning(f"Unknown corpus: {corpus}")

    def compute_stats(
        self,
        sentences: List[ParallelSentence]
    ) -> CorpusStats:
        """Compute statistics for a collection of parallel sentences.

        Args:
            sentences: List of parallel sentences

        Returns:
            CorpusStats object with computed statistics
        """
        if not sentences:
            return CorpusStats(
                total_pairs=0,
                source_tokens=0,
                target_tokens=0,
                source_vocab_size=0,
                target_vocab_size=0,
                avg_source_length=0.0,
                avg_target_length=0.0,
                corpus_name="empty",
                language_pair=f"{self.source_lang}-{self.target_lang}"
            )

        source_tokens = 0
        target_tokens = 0
        source_vocab: set = set()
        target_vocab: set = set()

        for sent in sentences:
            src_words = sent.source.split()
            tgt_words = sent.target.split()

            source_tokens += len(src_words)
            target_tokens += len(tgt_words)
            source_vocab.update(src_words)
            target_vocab.update(tgt_words)

        return CorpusStats(
            total_pairs=len(sentences),
            source_tokens=source_tokens,
            target_tokens=target_tokens,
            source_vocab_size=len(source_vocab),
            target_vocab_size=len(target_vocab),
            avg_source_length=source_tokens / len(sentences),
            avg_target_length=target_tokens / len(sentences),
            corpus_name=sentences[0].corpus if sentences else "unknown",
            language_pair=f"{self.source_lang}-{self.target_lang}"
        )

    def filter_by_length(
        self,
        sentences: Iterator[ParallelSentence],
        min_chars: int = 5,
        max_chars: int = 500,
        max_ratio: float = 3.0
    ) -> Iterator[ParallelSentence]:
        """Filter sentences by length constraints.

        Args:
            sentences: Iterator of parallel sentences
            min_chars: Minimum character length
            max_chars: Maximum character length
            max_ratio: Maximum length ratio between source and target

        Yields:
            Filtered parallel sentences
        """
        for sent in sentences:
            src_len = len(sent.source)
            tgt_len = len(sent.target)

            if src_len < min_chars or tgt_len < min_chars:
                continue
            if src_len > max_chars or tgt_len > max_chars:
                continue

            ratio = max(src_len, tgt_len) / max(min(src_len, tgt_len), 1)
            if ratio > max_ratio:
                continue

            yield sent

    def deduplicate(
        self,
        sentences: List[ParallelSentence]
    ) -> List[ParallelSentence]:
        """Remove duplicate sentence pairs.

        Args:
            sentences: List of parallel sentences

        Returns:
            Deduplicated list
        """
        seen = set()
        unique = []

        for sent in sentences:
            key = (sent.source.lower().strip(), sent.target.lower().strip())
            if key not in seen:
                seen.add(key)
                unique.append(sent)

        logger.info(f"Deduplication: {len(sentences)} -> {len(unique)} pairs")
        return unique

    def to_dataframe(self, sentences: List[ParallelSentence]):
        """Convert sentences to pandas DataFrame.

        Args:
            sentences: List of parallel sentences

        Returns:
            pandas DataFrame
        """
        if not PANDAS_AVAILABLE:
            raise ImportError("pandas required for to_dataframe()")

        data = [
            {
                "source": s.source,
                "target": s.target,
                "source_lang": s.source_lang,
                "target_lang": s.target_lang,
                "corpus": s.corpus,
                "domain": s.domain,
            }
            for s in sentences
        ]
        return pd.DataFrame(data)

    def save_parallel_files(
        self,
        sentences: List[ParallelSentence],
        output_dir: str,
        prefix: str = "corpus"
    ) -> Tuple[Path, Path]:
        """Save sentences as parallel text files.

        Args:
            sentences: List of parallel sentences
            output_dir: Output directory
            prefix: File prefix

        Returns:
            Tuple of (source_file_path, target_file_path)
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        source_file = output_path / f"{prefix}.{self.source_lang}"
        target_file = output_path / f"{prefix}.{self.target_lang}"

        with open(source_file, "w", encoding="utf-8") as sf, \
             open(target_file, "w", encoding="utf-8") as tf:
            for sent in sentences:
                sf.write(sent.source + "\n")
                tf.write(sent.target + "\n")

        logger.info(f"Saved {len(sentences)} pairs to {output_path}")
        return source_file, target_file


if __name__ == "__main__":
    # Example usage
    loader = SeedDataLoader(
        data_dir="./data/seed",
        source_lang="so",
        target_lang="sw"
    )

    # Load and process
    sentences = list(loader.load_all(max_pairs_per_corpus=1000))
    sentences = loader.deduplicate(sentences)

    # Compute stats
    stats = loader.compute_stats(sentences)
    print(f"Loaded {stats.total_pairs} pairs")
    print(f"Source vocab: {stats.source_vocab_size}")
    print(f"Target vocab: {stats.target_vocab_size}")
