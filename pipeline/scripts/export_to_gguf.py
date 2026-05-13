#!/usr/bin/env python3
"""
Daraja Model Export to GGUF

Converts trained Unsloth models to GGUF format for Ollama deployment.
Also generates Modelfiles and creates Ollama models.

Usage:
    python export_to_gguf.py --model-dir outputs/so-sw/final
    python export_to_gguf.py --model-dir outputs/so-sw/final --quantization q4_k_m
    python export_to_gguf.py --model-dir outputs/so-sw/final --create-ollama
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Script directories
SCRIPT_DIR = Path(__file__).parent
PIPELINE_DIR = SCRIPT_DIR.parent
MODELS_DIR = PIPELINE_DIR.parent / "models"
MODELFILES_DIR = MODELS_DIR / "modelfiles"

# Language pair configurations
LANGUAGE_CONFIGS = {
    "so-sw": {
        "source": "Somali",
        "target": "Swahili",
        "source_code": "so",
        "target_code": "sw",
    },
    "sw-so": {
        "source": "Swahili",
        "target": "Somali",
        "source_code": "sw",
        "target_code": "so",
    },
    "ti-ar": {
        "source": "Tigrinya",
        "target": "Arabic",
        "source_code": "ti",
        "target_code": "ar",
    },
    "ar-ti": {
        "source": "Arabic",
        "target": "Tigrinya",
        "source_code": "ar",
        "target_code": "ti",
    },
    "prs-tr": {
        "source": "Dari",
        "target": "Turkish",
        "source_code": "prs",
        "target_code": "tr",
    },
    "tr-prs": {
        "source": "Turkish",
        "target": "Dari",
        "source_code": "tr",
        "target_code": "prs",
    },
}

# Quantization options
QUANTIZATION_OPTIONS = [
    "q4_k_m",   # 4-bit, medium quality - best for mobile
    "q4_k_s",   # 4-bit, small - faster, slightly lower quality
    "q5_k_m",   # 5-bit, medium - better quality
    "q8_0",     # 8-bit - high quality, larger size
    "f16",      # 16-bit - highest quality, largest size
]


def detect_language_pair(model_dir: Path) -> Optional[str]:
    """Detect language pair from model directory name or config.

    Args:
        model_dir: Path to model directory

    Returns:
        Language pair string (e.g., "so-sw") or None
    """
    # Check directory name
    dir_name = model_dir.name
    if dir_name in LANGUAGE_CONFIGS:
        return dir_name

    # Check parent directory name
    parent_name = model_dir.parent.name
    if parent_name in LANGUAGE_CONFIGS:
        return parent_name

    # Check for config file
    config_path = model_dir / "training_config.json"
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
        src = config.get("source_lang")
        tgt = config.get("target_lang")
        if src and tgt:
            pair = f"{src}-{tgt}"
            if pair in LANGUAGE_CONFIGS:
                return pair

    return None


def export_to_gguf_unsloth(
    model_dir: Path,
    output_dir: Path,
    quantization: str = "q4_k_m"
) -> Optional[Path]:
    """Export model to GGUF using Unsloth's built-in export.

    Args:
        model_dir: Directory containing the trained model
        output_dir: Directory to save GGUF file
        quantization: Quantization method

    Returns:
        Path to GGUF file or None if failed
    """
    try:
        from unsloth import FastLanguageModel
    except ImportError:
        logger.error("Unsloth not installed. Install with: pip install unsloth")
        return None

    logger.info(f"Loading model from {model_dir}")

    # Check for LoRA adapters or merged model
    lora_path = model_dir / "lora_adapters"
    merged_path = model_dir / "merged"

    if lora_path.exists():
        model_path = lora_path
    elif merged_path.exists():
        model_path = merged_path
    else:
        model_path = model_dir

    try:
        # Load model
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=str(model_path),
            max_seq_length=2048,
            dtype=None,
            load_in_4bit=True,
        )

        # Export to GGUF
        output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Exporting to GGUF with {quantization} quantization...")
        model.save_pretrained_gguf(
            str(output_dir),
            tokenizer,
            quantization_method=quantization
        )

        # Find the generated GGUF file
        gguf_files = list(output_dir.glob("*.gguf"))
        if gguf_files:
            logger.info(f"GGUF exported: {gguf_files[0]}")
            return gguf_files[0]

        logger.error("No GGUF file generated")
        return None

    except Exception as e:
        logger.error(f"Failed to export GGUF: {e}")
        return None


def export_to_gguf_llama_cpp(
    model_dir: Path,
    output_dir: Path,
    quantization: str = "q4_k_m"
) -> Optional[Path]:
    """Export model to GGUF using llama.cpp conversion.

    Fallback method if Unsloth export doesn't work.

    Args:
        model_dir: Directory containing the model
        output_dir: Directory to save GGUF file
        quantization: Quantization method

    Returns:
        Path to GGUF file or None if failed
    """
    logger.info("Attempting llama.cpp conversion...")

    # Check for llama.cpp
    llama_cpp_path = shutil.which("llama-quantize")
    convert_script = shutil.which("convert-hf-to-gguf")

    if not convert_script:
        # Try common locations
        possible_paths = [
            Path.home() / "llama.cpp" / "convert-hf-to-gguf.py",
            Path("/opt/llama.cpp/convert-hf-to-gguf.py"),
        ]
        for p in possible_paths:
            if p.exists():
                convert_script = str(p)
                break

    if not convert_script:
        logger.warning("llama.cpp convert script not found")
        logger.info("Install llama.cpp: git clone https://github.com/ggerganov/llama.cpp")
        return None

    output_dir.mkdir(parents=True, exist_ok=True)

    # First convert to f16 GGUF
    f16_path = output_dir / "model-f16.gguf"

    try:
        logger.info("Converting to f16 GGUF...")
        result = subprocess.run(
            [sys.executable, convert_script, str(model_dir), "--outfile", str(f16_path)],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            logger.error(f"Conversion failed: {result.stderr}")
            return None

        # Quantize if needed
        if quantization != "f16" and llama_cpp_path:
            quant_path = output_dir / f"model-{quantization}.gguf"
            logger.info(f"Quantizing to {quantization}...")

            result = subprocess.run(
                [llama_cpp_path, str(f16_path), str(quant_path), quantization.upper()],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                # Remove f16 file to save space
                f16_path.unlink()
                return quant_path
            else:
                logger.warning(f"Quantization failed: {result.stderr}")
                return f16_path

        return f16_path

    except Exception as e:
        logger.error(f"llama.cpp conversion failed: {e}")
        return None


def generate_modelfile(
    gguf_path: Path,
    output_path: Path,
    language_pair: str,
    model_name: Optional[str] = None
) -> Path:
    """Generate an Ollama Modelfile.

    Args:
        gguf_path: Path to GGUF model file
        output_path: Path to save Modelfile
        language_pair: Language pair (e.g., "so-sw")
        model_name: Optional custom model name

    Returns:
        Path to generated Modelfile
    """
    config = LANGUAGE_CONFIGS.get(language_pair, {})
    source_lang = config.get("source", language_pair.split("-")[0])
    target_lang = config.get("target", language_pair.split("-")[1])

    if model_name is None:
        model_name = f"daraja-{language_pair}"

    # Use relative path from modelfiles directory if possible
    try:
        rel_path = gguf_path.relative_to(MODELS_DIR)
        gguf_ref = f"./{rel_path}"
    except ValueError:
        gguf_ref = str(gguf_path)

    modelfile_content = f"""# Daraja Translation Model: {source_lang} -> {target_lang}
# Fine-tuned Gemma model for humanitarian translation
#
# Usage:
#   ollama create {model_name} -f {output_path.name}
#   ollama run {model_name} "Translate: <text>"

FROM {gguf_ref}

TEMPLATE \"\"\"<start_of_turn>user
{{{{ .Prompt }}}}<end_of_turn>
<start_of_turn>model
\"\"\"

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1
PARAMETER stop "<end_of_turn>"
PARAMETER num_ctx 2048

SYSTEM \"\"\"You are Daraja, a professional translation assistant specializing in {source_lang} to {target_lang} translation for humanitarian contexts.

Your role:
- Translate {source_lang} text to {target_lang} accurately and faithfully
- Preserve the exact meaning and tone of the original
- Handle medical, legal, and administrative terminology with precision
- Never add explanations or commentary - only provide the translation

Translation guidelines:
- For medical terms: Translate precisely, do not simplify
- For legal statements: Preserve all qualifiers (maybe, approximately, etc.)
- For names and places: Transliterate phonetically when no standard translation exists
- For culturally specific terms: Translate literally and preserve meaning

When given a translation request:
1. Identify the domain (medical, legal, humanitarian, general)
2. Translate the complete text
3. Output only the {target_lang} translation

If the input is ambiguous or unclear, translate it as faithfully as possible.\"\"\"
"""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(modelfile_content)

    logger.info(f"Generated Modelfile: {output_path}")
    return output_path


def create_ollama_model(
    modelfile_path: Path,
    model_name: str
) -> bool:
    """Create an Ollama model from a Modelfile.

    Args:
        modelfile_path: Path to Modelfile
        model_name: Name for the Ollama model

    Returns:
        True if successful, False otherwise
    """
    # Check if Ollama is available
    ollama_path = shutil.which("ollama")
    if not ollama_path:
        logger.warning("Ollama not found in PATH")
        logger.info("Install Ollama: https://ollama.ai/download")
        return False

    logger.info(f"Creating Ollama model: {model_name}")

    try:
        result = subprocess.run(
            ["ollama", "create", model_name, "-f", str(modelfile_path)],
            capture_output=True,
            text=True,
            cwd=modelfile_path.parent
        )

        if result.returncode == 0:
            logger.info(f"Successfully created Ollama model: {model_name}")
            logger.info(f"Run with: ollama run {model_name}")
            return True
        else:
            logger.error(f"Failed to create Ollama model: {result.stderr}")
            return False

    except Exception as e:
        logger.error(f"Error creating Ollama model: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Export Daraja models to GGUF format for Ollama"
    )
    parser.add_argument(
        "--model-dir",
        type=str,
        required=True,
        help="Directory containing the trained model"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        help="Output directory for GGUF (default: model-dir/gguf)"
    )
    parser.add_argument(
        "--quantization",
        type=str,
        default="q4_k_m",
        choices=QUANTIZATION_OPTIONS,
        help="Quantization method (default: q4_k_m)"
    )
    parser.add_argument(
        "--lang-pair",
        type=str,
        help="Language pair (e.g., 'so-sw'). Auto-detected if not specified."
    )
    parser.add_argument(
        "--model-name",
        type=str,
        help="Ollama model name (default: daraja-<lang-pair>)"
    )
    parser.add_argument(
        "--create-ollama",
        action="store_true",
        help="Also create Ollama model after export"
    )
    parser.add_argument(
        "--use-llama-cpp",
        action="store_true",
        help="Use llama.cpp instead of Unsloth for export"
    )

    args = parser.parse_args()

    model_dir = Path(args.model_dir)
    if not model_dir.exists():
        logger.error(f"Model directory not found: {model_dir}")
        sys.exit(1)

    output_dir = Path(args.output_dir) if args.output_dir else model_dir / "gguf"

    # Detect language pair
    lang_pair = args.lang_pair or detect_language_pair(model_dir)
    if not lang_pair:
        logger.warning("Could not detect language pair. Using 'so-sw' as default.")
        lang_pair = "so-sw"

    logger.info("=" * 60)
    logger.info("DARAJA GGUF EXPORT")
    logger.info("=" * 60)
    logger.info(f"Model directory: {model_dir}")
    logger.info(f"Output directory: {output_dir}")
    logger.info(f"Language pair: {lang_pair}")
    logger.info(f"Quantization: {args.quantization}")

    # Export to GGUF
    if args.use_llama_cpp:
        gguf_path = export_to_gguf_llama_cpp(model_dir, output_dir, args.quantization)
    else:
        gguf_path = export_to_gguf_unsloth(model_dir, output_dir, args.quantization)

    if not gguf_path:
        logger.error("GGUF export failed")
        sys.exit(1)

    # Generate Modelfile
    model_name = args.model_name or f"daraja-{lang_pair}"
    modelfile_path = MODELFILES_DIR / f"daraja-{lang_pair}.Modelfile"

    generate_modelfile(gguf_path, modelfile_path, lang_pair, model_name)

    # Optionally create Ollama model
    if args.create_ollama:
        create_ollama_model(modelfile_path, model_name)

    logger.info("=" * 60)
    logger.info("EXPORT COMPLETE")
    logger.info("=" * 60)
    logger.info(f"GGUF file: {gguf_path}")
    logger.info(f"Modelfile: {modelfile_path}")
    logger.info(f"\nTo create Ollama model manually:")
    logger.info(f"  cd {modelfile_path.parent}")
    logger.info(f"  ollama create {model_name} -f {modelfile_path.name}")
    logger.info(f"\nTo run:")
    logger.info(f"  ollama run {model_name} \"Translate: <your text>\"")


if __name__ == "__main__":
    main()
