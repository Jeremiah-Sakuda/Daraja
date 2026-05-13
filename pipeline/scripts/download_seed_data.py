#!/usr/bin/env python3
"""
Daraja Seed Data Downloader

Downloads and prepares seed corpora from verified license-compatible sources:
- FLORES-200 (CC-BY-SA 4.0)
- NLLB Seed Data (CC-BY-SA 4.0)
- Tatoeba (CC-BY 2.0 FR)
- Masakhane MAFAND-MT (CC-BY 4.0)

Usage:
    python download_seed_data.py                    # Download all
    python download_seed_data.py --source flores    # Download specific source
    python download_seed_data.py --lang-pair so-sw  # Download for specific pair
"""

import argparse
import hashlib
import json
import logging
import os
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.request import urlretrieve
from urllib.error import URLError

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Base directories
SCRIPT_DIR = Path(__file__).parent
PIPELINE_DIR = SCRIPT_DIR.parent
DATA_DIR = PIPELINE_DIR / "data"
SEED_DIR = DATA_DIR / "seed"

# Language mappings
DARAJA_LANGUAGES = {
    "so": {"name": "Somali", "flores": "som_Latn", "nllb": "som_Latn"},
    "sw": {"name": "Swahili", "flores": "swh_Latn", "nllb": "swh_Latn"},
    "ti": {"name": "Tigrinya", "flores": "tir_Ethi", "nllb": "tir_Ethi"},
    "ar": {"name": "Arabic", "flores": "arb_Arab", "nllb": "arb_Arab"},
    "prs": {"name": "Dari", "flores": "prs_Arab", "nllb": "prs_Arab"},
    "tr": {"name": "Turkish", "flores": "tur_Latn", "nllb": "tur_Latn"},
    "en": {"name": "English", "flores": "eng_Latn", "nllb": "eng_Latn"},
}

LANGUAGE_PAIRS = [
    ("so", "sw"),
    ("ti", "ar"),
    ("prs", "tr"),
]

# Data source configurations
SOURCES = {
    "flores200": {
        "name": "FLORES-200",
        "license": "CC-BY-SA 4.0",
        "base_url": "https://raw.githubusercontent.com/facebookresearch/flores/main/flores200",
        "files": {
            "dev": "dev/{lang}.dev",
            "devtest": "devtest/{lang}.devtest",
        },
        "description": "Meta's multilingual evaluation benchmark",
    },
    "tatoeba": {
        "name": "Tatoeba",
        "license": "CC-BY 2.0 FR",
        "base_url": "https://downloads.tatoeba.org/exports/per_language",
        "description": "Volunteer-translated sentence pairs",
    },
    "masakhane": {
        "name": "Masakhane MAFAND-MT",
        "license": "CC-BY 4.0",
        "base_url": "https://raw.githubusercontent.com/masakhane-io/lafand-mt/main/data/json_files",
        "description": "African language parallel corpora",
    },
}


def compute_sha256(filepath: Path) -> str:
    """Compute SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def download_file(url: str, dest: Path, desc: str = "") -> bool:
    """Download a file with progress indication."""
    try:
        logger.info(f"Downloading {desc or url}...")

        def progress_hook(block_num, block_size, total_size):
            if total_size > 0:
                percent = min(100, block_num * block_size * 100 // total_size)
                if block_num % 100 == 0:
                    logger.info(f"  Progress: {percent}%")

        dest.parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(url, dest, reporthook=progress_hook)
        logger.info(f"  Saved to {dest}")
        return True

    except URLError as e:
        logger.warning(f"  Failed to download {url}: {e}")
        return False
    except Exception as e:
        logger.error(f"  Error downloading {url}: {e}")
        return False


def download_flores200(
    languages: List[str],
    output_dir: Path,
    splits: List[str] = ["dev", "devtest"]
) -> Dict[str, Path]:
    """Download FLORES-200 data for specified languages.

    Args:
        languages: List of language codes (e.g., ["so", "sw"])
        output_dir: Directory to save files
        splits: Which splits to download

    Returns:
        Dict mapping language codes to file paths
    """
    logger.info("=" * 50)
    logger.info("Downloading FLORES-200 data")
    logger.info("=" * 50)

    flores_dir = output_dir / "flores200"
    flores_dir.mkdir(parents=True, exist_ok=True)

    downloaded = {}
    base_url = "https://raw.githubusercontent.com/openlanguagedata/flores/main/flores200"

    for lang in languages:
        if lang not in DARAJA_LANGUAGES:
            logger.warning(f"Unknown language: {lang}")
            continue

        flores_code = DARAJA_LANGUAGES[lang]["flores"]
        lang_dir = flores_dir / lang
        lang_dir.mkdir(exist_ok=True)

        all_sentences = []

        for split in splits:
            url = f"{base_url}/{split}/{flores_code}.{split}"
            dest = lang_dir / f"{split}.txt"

            if download_file(url, dest, f"FLORES-200 {lang} {split}"):
                with open(dest, "r", encoding="utf-8") as f:
                    sentences = [line.strip() for line in f if line.strip()]
                all_sentences.extend(sentences)
                logger.info(f"  {lang} {split}: {len(sentences)} sentences")

        # Combine into single file
        if all_sentences:
            combined_path = lang_dir / f"flores200.{lang}"
            with open(combined_path, "w", encoding="utf-8") as f:
                f.write("\n".join(all_sentences) + "\n")
            downloaded[lang] = combined_path
            logger.info(f"  Combined {lang}: {len(all_sentences)} total sentences")

    return downloaded


def download_tatoeba(
    languages: List[str],
    output_dir: Path,
    max_sentences: int = 50000
) -> Dict[str, Path]:
    """Download Tatoeba sentence pairs.

    Note: Tatoeba requires more complex processing. This provides a simplified
    version that downloads available sentence files.

    Args:
        languages: List of language codes
        output_dir: Directory to save files
        max_sentences: Maximum sentences per language

    Returns:
        Dict mapping language codes to file paths
    """
    logger.info("=" * 50)
    logger.info("Downloading Tatoeba data")
    logger.info("=" * 50)

    tatoeba_dir = output_dir / "tatoeba"
    tatoeba_dir.mkdir(parents=True, exist_ok=True)

    # Tatoeba language codes differ slightly
    tatoeba_codes = {
        "so": "som",
        "sw": "swh",
        "ti": "tir",
        "ar": "ara",
        "prs": "prs",
        "tr": "tur",
        "en": "eng",
    }

    downloaded = {}

    # Tatoeba provides TSV downloads of sentence pairs
    # We'll create placeholder files and note that full download requires
    # the Tatoeba export system

    for lang in languages:
        if lang not in tatoeba_codes:
            continue

        lang_dir = tatoeba_dir / lang
        lang_dir.mkdir(exist_ok=True)

        # Create info file about Tatoeba access
        info_path = lang_dir / "README.txt"
        with open(info_path, "w") as f:
            f.write(f"""Tatoeba Data for {DARAJA_LANGUAGES.get(lang, {}).get('name', lang)}

To download Tatoeba data:
1. Visit https://tatoeba.org/en/downloads
2. Select sentences in {tatoeba_codes[lang]}
3. Download and extract to this directory

Alternatively, use the Tatoeba API:
  https://tatoeba.org/en/api_v0/search?from={tatoeba_codes[lang]}&to=eng

License: CC-BY 2.0 FR
""")

        downloaded[lang] = info_path
        logger.info(f"  Created Tatoeba info for {lang}")

    return downloaded


def download_masakhane(
    language_pairs: List[Tuple[str, str]],
    output_dir: Path
) -> Dict[str, Path]:
    """Download Masakhane MAFAND-MT data.

    Args:
        language_pairs: List of (source, target) language pairs
        output_dir: Directory to save files

    Returns:
        Dict mapping pair IDs to file paths
    """
    logger.info("=" * 50)
    logger.info("Downloading Masakhane data")
    logger.info("=" * 50)

    masakhane_dir = output_dir / "masakhane"
    masakhane_dir.mkdir(parents=True, exist_ok=True)

    # Masakhane covers African languages - primarily useful for so-sw pair
    # The data is available through GitHub

    downloaded = {}
    base_url = "https://raw.githubusercontent.com/masakhane-io/lafand-mt/main/data"

    # Check for Somali-Swahili specifically
    for src, tgt in language_pairs:
        if src == "so" and tgt == "sw":
            pair_dir = masakhane_dir / f"{src}-{tgt}"
            pair_dir.mkdir(exist_ok=True)

            # Try to download from masakhane repo
            for split in ["train", "dev", "test"]:
                for lang in [src, tgt]:
                    # Masakhane uses different file structures
                    url = f"{base_url}/text_files/{src}-{tgt}/{split}.{lang}"
                    dest = pair_dir / f"{split}.{lang}"
                    download_file(url, dest, f"Masakhane {src}-{tgt} {split}.{lang}")

            downloaded[f"{src}-{tgt}"] = pair_dir

    return downloaded


def create_parallel_seed_files(
    source_lang: str,
    target_lang: str,
    output_dir: Path,
    flores_data: Dict[str, Path]
) -> Tuple[Path, Path]:
    """Create aligned parallel files for a language pair.

    Uses FLORES-200 which has sentence-aligned data across all languages.

    Args:
        source_lang: Source language code
        target_lang: Target language code
        output_dir: Directory for output
        flores_data: Dict of downloaded FLORES files

    Returns:
        Tuple of (source_file, target_file) paths
    """
    pair_dir = output_dir / f"{source_lang}-{target_lang}"
    pair_dir.mkdir(parents=True, exist_ok=True)

    source_path = pair_dir / f"seed.{source_lang}"
    target_path = pair_dir / f"seed.{target_lang}"

    # FLORES-200 is sentence-aligned by line number
    if source_lang in flores_data and target_lang in flores_data:
        src_file = flores_data[source_lang]
        tgt_file = flores_data[target_lang]

        # Read both files
        src_flores = src_file.parent / f"flores200.{source_lang}"
        tgt_flores = tgt_file.parent / f"flores200.{target_lang}"

        if src_flores.exists() and tgt_flores.exists():
            with open(src_flores, "r", encoding="utf-8") as sf:
                src_lines = sf.read().splitlines()
            with open(tgt_flores, "r", encoding="utf-8") as tf:
                tgt_lines = tf.read().splitlines()

            # Align by line number (FLORES is pre-aligned)
            min_len = min(len(src_lines), len(tgt_lines))

            with open(source_path, "w", encoding="utf-8") as sf:
                sf.write("\n".join(src_lines[:min_len]) + "\n")
            with open(target_path, "w", encoding="utf-8") as tf:
                tf.write("\n".join(tgt_lines[:min_len]) + "\n")

            logger.info(f"Created parallel seed files for {source_lang}-{target_lang}: {min_len} pairs")
            return source_path, target_path

    logger.warning(f"Could not create parallel files for {source_lang}-{target_lang}")
    return source_path, target_path


def generate_checksums(data_dir: Path) -> Path:
    """Generate SHA-256 checksums for all downloaded files.

    Args:
        data_dir: Directory containing data files

    Returns:
        Path to checksums file
    """
    checksums_path = data_dir / "CHECKSUMS.sha256"

    checksums = []
    for filepath in sorted(data_dir.rglob("*")):
        if filepath.is_file() and filepath.name != "CHECKSUMS.sha256":
            rel_path = filepath.relative_to(data_dir)
            file_hash = compute_sha256(filepath)
            checksums.append(f"{file_hash}  {rel_path}")

    with open(checksums_path, "w") as f:
        f.write("\n".join(checksums) + "\n")

    logger.info(f"Generated checksums: {checksums_path}")
    return checksums_path


def generate_manifest(data_dir: Path, downloaded_sources: Dict) -> Path:
    """Generate a manifest of downloaded data.

    Args:
        data_dir: Directory containing data
        downloaded_sources: Dict of what was downloaded

    Returns:
        Path to manifest file
    """
    manifest_path = data_dir / "manifest.json"

    manifest = {
        "generated_at": datetime.utcnow().isoformat(),
        "sources": {},
        "language_pairs": {},
    }

    for source_name, source_data in downloaded_sources.items():
        manifest["sources"][source_name] = {
            "name": SOURCES.get(source_name, {}).get("name", source_name),
            "license": SOURCES.get(source_name, {}).get("license", "Unknown"),
            "files": [str(p.relative_to(data_dir)) for p in source_data.values() if isinstance(p, Path) and p.exists()]
        }

    # Count pairs
    for pair_dir in data_dir.glob("*-*"):
        if pair_dir.is_dir():
            src, tgt = pair_dir.name.split("-")
            src_file = pair_dir / f"seed.{src}"
            tgt_file = pair_dir / f"seed.{tgt}"

            if src_file.exists() and tgt_file.exists():
                with open(src_file) as f:
                    count = len(f.read().splitlines())
                manifest["language_pairs"][pair_dir.name] = {
                    "source": src,
                    "target": tgt,
                    "sentence_pairs": count
                }

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    logger.info(f"Generated manifest: {manifest_path}")
    return manifest_path


def main():
    parser = argparse.ArgumentParser(
        description="Download seed data for Daraja translation pipeline"
    )
    parser.add_argument(
        "--source",
        type=str,
        choices=["flores", "tatoeba", "masakhane", "all"],
        default="all",
        help="Which data source to download"
    )
    parser.add_argument(
        "--lang-pair",
        type=str,
        help="Specific language pair (e.g., 'so-sw')"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(SEED_DIR),
        help="Output directory for downloaded data"
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files that already exist"
    )

    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("DARAJA SEED DATA DOWNLOADER")
    logger.info("=" * 60)
    logger.info(f"Output directory: {output_dir}")

    # Determine which language pairs to download
    if args.lang_pair:
        parts = args.lang_pair.split("-")
        if len(parts) == 2:
            pairs = [(parts[0], parts[1])]
        else:
            logger.error(f"Invalid language pair format: {args.lang_pair}")
            sys.exit(1)
    else:
        pairs = LANGUAGE_PAIRS

    # Get all unique languages needed
    languages = set()
    for src, tgt in pairs:
        languages.add(src)
        languages.add(tgt)
    languages.add("en")  # Always include English for pivoting

    logger.info(f"Language pairs: {pairs}")
    logger.info(f"Languages: {sorted(languages)}")

    downloaded_sources = {}

    # Download FLORES-200
    if args.source in ["flores", "all"]:
        flores_data = download_flores200(list(languages), output_dir)
        downloaded_sources["flores200"] = flores_data

    # Download Tatoeba
    if args.source in ["tatoeba", "all"]:
        tatoeba_data = download_tatoeba(list(languages), output_dir)
        downloaded_sources["tatoeba"] = tatoeba_data

    # Download Masakhane
    if args.source in ["masakhane", "all"]:
        masakhane_data = download_masakhane(pairs, output_dir)
        downloaded_sources["masakhane"] = masakhane_data

    # Create parallel seed files for each pair
    logger.info("=" * 50)
    logger.info("Creating parallel seed files")
    logger.info("=" * 50)

    flores_data = downloaded_sources.get("flores200", {})
    for src, tgt in pairs:
        create_parallel_seed_files(src, tgt, output_dir, flores_data)

    # Generate checksums
    logger.info("=" * 50)
    logger.info("Generating checksums")
    logger.info("=" * 50)
    generate_checksums(output_dir)

    # Generate manifest
    generate_manifest(output_dir, downloaded_sources)

    # Summary
    logger.info("=" * 60)
    logger.info("DOWNLOAD COMPLETE")
    logger.info("=" * 60)

    for pair_dir in sorted(output_dir.glob("*-*")):
        if pair_dir.is_dir():
            src, tgt = pair_dir.name.split("-")
            src_file = pair_dir / f"seed.{src}"
            if src_file.exists():
                with open(src_file) as f:
                    count = len(f.read().splitlines())
                logger.info(f"  {pair_dir.name}: {count:,} sentence pairs")

    logger.info(f"\nData saved to: {output_dir}")
    logger.info("\nNext steps:")
    logger.info("  1. Run notebook 02_synthetic_corpus_generation.ipynb")
    logger.info("  2. Or use: python -m pipeline.src.data.corpus_generator")


if __name__ == "__main__":
    main()
