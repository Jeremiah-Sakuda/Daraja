"""Unsloth QLoRA Fine-tuning Wrapper for Daraja.

This module provides a streamlined interface for fine-tuning Gemma models
using Unsloth's optimized QLoRA implementation.
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Configuration for Unsloth training."""
    # Model settings
    base_model: str = "unsloth/gemma-2-9b-it-bnb-4bit"
    max_seq_length: int = 2048
    load_in_4bit: bool = True

    # LoRA settings
    lora_r: int = 16
    lora_alpha: int = 16
    lora_dropout: float = 0.0
    target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ])

    # Training settings
    batch_size: int = 2
    gradient_accumulation_steps: int = 4
    warmup_steps: int = 100
    num_epochs: int = 3
    learning_rate: float = 2e-4
    weight_decay: float = 0.01
    logging_steps: int = 10
    save_steps: int = 500
    save_total_limit: int = 3

    # Output
    output_dir: str = "./outputs"
    seed: int = 42


@dataclass
class DataConfig:
    """Configuration for training data."""
    source_lang: str = "so"
    target_lang: str = "sw"
    source_lang_name: str = "Somali"
    target_lang_name: str = "Swahili"
    validation_split: float = 0.05
    max_samples: Optional[int] = None

    # Domain tags
    domain_tags: Dict[str, str] = field(default_factory=lambda: {
        "medical": "[MEDICAL]",
        "legal": "[LEGAL]",
        "humanitarian": "[HUMANITARIAN]",
        "general": "[GENERAL]"
    })


class UnslothTrainer:
    """Wrapper for Unsloth-based QLoRA fine-tuning."""

    def __init__(
        self,
        training_config: Optional[TrainingConfig] = None,
        data_config: Optional[DataConfig] = None
    ):
        """Initialize the trainer.

        Args:
            training_config: Training hyperparameters
            data_config: Data configuration
        """
        self.training_config = training_config or TrainingConfig()
        self.data_config = data_config or DataConfig()
        self.model = None
        self.tokenizer = None

    def load_model(self) -> Tuple[Any, Any]:
        """Load and prepare model with LoRA adapters.

        Returns:
            Tuple of (model, tokenizer)
        """
        try:
            from unsloth import FastLanguageModel
        except ImportError:
            logger.error("unsloth library required. Install with: pip install unsloth")
            raise

        logger.info(f"Loading base model: {self.training_config.base_model}")

        self.model, self.tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.training_config.base_model,
            max_seq_length=self.training_config.max_seq_length,
            dtype=None,  # Auto-detect
            load_in_4bit=self.training_config.load_in_4bit,
        )

        # Add LoRA adapters
        self.model = FastLanguageModel.get_peft_model(
            self.model,
            r=self.training_config.lora_r,
            target_modules=self.training_config.target_modules,
            lora_alpha=self.training_config.lora_alpha,
            lora_dropout=self.training_config.lora_dropout,
            bias="none",
            use_gradient_checkpointing="unsloth",
            random_state=self.training_config.seed,
        )

        logger.info("Model loaded with LoRA adapters")
        return self.model, self.tokenizer

    def format_example(
        self,
        source: str,
        target: str,
        domain: str = "general"
    ) -> str:
        """Format a training example using chat template.

        Args:
            source: Source language text
            target: Target language text
            domain: Domain tag

        Returns:
            Formatted training example
        """
        domain_tag = self.data_config.domain_tags.get(domain, "")

        prompt = f"""<start_of_turn>user
Translate the following {self.data_config.source_lang_name} text to {self.data_config.target_lang_name}:
{domain_tag} {source}<end_of_turn>
<start_of_turn>model
{target}<end_of_turn>"""

        return prompt

    def prepare_dataset(
        self,
        source_file: str,
        target_file: str,
        domain_file: Optional[str] = None
    ) -> Any:
        """Prepare dataset for training.

        Args:
            source_file: Path to source language file
            target_file: Path to target language file
            domain_file: Optional path to domain labels file

        Returns:
            HuggingFace Dataset object
        """
        try:
            from datasets import Dataset
        except ImportError:
            logger.error("datasets library required")
            raise

        # Load parallel data
        with open(source_file, "r", encoding="utf-8") as sf, \
             open(target_file, "r", encoding="utf-8") as tf:
            sources = sf.read().splitlines()
            targets = tf.read().splitlines()

        # Load domain labels if available
        if domain_file and Path(domain_file).exists():
            with open(domain_file, "r", encoding="utf-8") as df:
                domains = df.read().splitlines()
        else:
            domains = ["general"] * len(sources)

        # Ensure lengths match
        min_len = min(len(sources), len(targets), len(domains))
        sources = sources[:min_len]
        targets = targets[:min_len]
        domains = domains[:min_len]

        # Limit samples if specified
        if self.data_config.max_samples:
            sources = sources[:self.data_config.max_samples]
            targets = targets[:self.data_config.max_samples]
            domains = domains[:self.data_config.max_samples]

        logger.info(f"Loaded {len(sources)} training examples")

        # Format examples
        formatted = [
            self.format_example(src, tgt, dom)
            for src, tgt, dom in zip(sources, targets, domains)
        ]

        # Create dataset
        dataset = Dataset.from_dict({"text": formatted})

        return dataset

    def train(
        self,
        train_dataset: Any,
        eval_dataset: Optional[Any] = None,
        resume_from_checkpoint: Optional[str] = None
    ):
        """Run training.

        Args:
            train_dataset: Training dataset
            eval_dataset: Optional evaluation dataset
            resume_from_checkpoint: Path to checkpoint to resume from
        """
        try:
            from trl import SFTTrainer
            from transformers import TrainingArguments
        except ImportError:
            logger.error("trl and transformers libraries required")
            raise

        if self.model is None:
            self.load_model()

        # Create output directory
        output_dir = Path(self.training_config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Training arguments
        training_args = TrainingArguments(
            per_device_train_batch_size=self.training_config.batch_size,
            gradient_accumulation_steps=self.training_config.gradient_accumulation_steps,
            warmup_steps=self.training_config.warmup_steps,
            num_train_epochs=self.training_config.num_epochs,
            learning_rate=self.training_config.learning_rate,
            fp16=True,
            logging_steps=self.training_config.logging_steps,
            optim="adamw_8bit",
            weight_decay=self.training_config.weight_decay,
            lr_scheduler_type="linear",
            seed=self.training_config.seed,
            output_dir=str(output_dir),
            save_strategy="steps",
            save_steps=self.training_config.save_steps,
            save_total_limit=self.training_config.save_total_limit,
        )

        # Initialize trainer
        trainer = SFTTrainer(
            model=self.model,
            tokenizer=self.tokenizer,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            dataset_text_field="text",
            max_seq_length=self.training_config.max_seq_length,
            args=training_args,
        )

        logger.info("Starting training...")

        # Train
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)

        logger.info("Training complete")
        return trainer

    def save_model(
        self,
        output_dir: str,
        save_merged: bool = True,
        quantization: Optional[str] = "q4_k_m"
    ):
        """Save the trained model.

        Args:
            output_dir: Directory to save model
            save_merged: Whether to save merged model (LoRA + base)
            quantization: Quantization format for GGUF export
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Save LoRA adapters
        adapter_path = output_path / "lora_adapters"
        self.model.save_pretrained(str(adapter_path))
        self.tokenizer.save_pretrained(str(adapter_path))
        logger.info(f"Saved LoRA adapters to {adapter_path}")

        if save_merged:
            try:
                from unsloth import FastLanguageModel

                # Save merged model
                merged_path = output_path / "merged"
                self.model.save_pretrained_merged(
                    str(merged_path),
                    self.tokenizer,
                    save_method="merged_16bit"
                )
                logger.info(f"Saved merged model to {merged_path}")

                # Export to GGUF for Ollama
                if quantization:
                    gguf_path = output_path / "gguf"
                    self.model.save_pretrained_gguf(
                        str(gguf_path),
                        self.tokenizer,
                        quantization_method=quantization
                    )
                    logger.info(f"Exported GGUF ({quantization}) to {gguf_path}")

            except Exception as e:
                logger.warning(f"Failed to save merged/GGUF model: {e}")

    def generate_modelfile(
        self,
        gguf_path: str,
        output_path: str,
        model_name: str = "daraja"
    ):
        """Generate Ollama Modelfile.

        Args:
            gguf_path: Path to GGUF model file
            output_path: Path to save Modelfile
            model_name: Name for the model
        """
        modelfile_content = f"""# Daraja Translation Model
# {self.data_config.source_lang_name} -> {self.data_config.target_lang_name}

FROM {gguf_path}

TEMPLATE \"\"\"<start_of_turn>user
{{{{ .Prompt }}}}<end_of_turn>
<start_of_turn>model
\"\"\"

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER stop "<end_of_turn>"

SYSTEM \"\"\"You are a translation assistant specializing in {self.data_config.source_lang_name} to {self.data_config.target_lang_name} translation for humanitarian contexts. Translate accurately and faithfully, preserving meaning and tone.\"\"\"
"""

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(modelfile_content)

        logger.info(f"Generated Modelfile at {output_path}")

    def get_training_stats(self) -> Dict[str, Any]:
        """Get training statistics from trainer state.

        Returns:
            Dictionary of training stats
        """
        state_path = Path(self.training_config.output_dir) / "trainer_state.json"
        if not state_path.exists():
            return {}

        with open(state_path, "r") as f:
            state = json.load(f)

        return {
            "total_steps": state.get("global_step", 0),
            "best_metric": state.get("best_metric"),
            "log_history": state.get("log_history", [])[-10:],  # Last 10 entries
        }


def run_training_pipeline(
    source_file: str,
    target_file: str,
    output_dir: str,
    source_lang: str = "so",
    target_lang: str = "sw",
    **kwargs
) -> str:
    """Run complete training pipeline.

    Args:
        source_file: Path to source language training data
        target_file: Path to target language training data
        output_dir: Directory for outputs
        source_lang: Source language code
        target_lang: Target language code
        **kwargs: Additional training config overrides

    Returns:
        Path to saved model
    """
    lang_names = {
        "so": "Somali",
        "sw": "Swahili",
        "ti": "Tigrinya",
        "ar": "Arabic",
        "prs": "Dari",
        "tr": "Turkish"
    }

    # Configure
    training_config = TrainingConfig(
        output_dir=output_dir,
        **{k: v for k, v in kwargs.items() if hasattr(TrainingConfig, k)}
    )

    data_config = DataConfig(
        source_lang=source_lang,
        target_lang=target_lang,
        source_lang_name=lang_names.get(source_lang, source_lang),
        target_lang_name=lang_names.get(target_lang, target_lang)
    )

    # Initialize trainer
    trainer = UnslothTrainer(training_config, data_config)

    # Load model
    trainer.load_model()

    # Prepare data
    dataset = trainer.prepare_dataset(source_file, target_file)

    # Split for validation
    if data_config.validation_split > 0:
        split = dataset.train_test_split(test_size=data_config.validation_split)
        train_dataset = split["train"]
        eval_dataset = split["test"]
    else:
        train_dataset = dataset
        eval_dataset = None

    # Train
    trainer.train(train_dataset, eval_dataset)

    # Save
    trainer.save_model(output_dir)

    # Generate Modelfile
    gguf_dir = Path(output_dir) / "gguf"
    if gguf_dir.exists():
        gguf_files = list(gguf_dir.glob("*.gguf"))
        if gguf_files:
            modelfile_path = Path(output_dir) / f"daraja-{source_lang}-{target_lang}.Modelfile"
            trainer.generate_modelfile(
                str(gguf_files[0]),
                str(modelfile_path)
            )

    return output_dir


if __name__ == "__main__":
    # Example usage (won't actually run without Unsloth)
    print("UnslothTrainer module loaded successfully")
    print("Use run_training_pipeline() to train a model")
