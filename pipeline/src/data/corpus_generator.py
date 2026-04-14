"""Synthetic Corpus Generator using back-translation and paraphrase augmentation.

This module generates synthetic parallel data by leveraging a large teacher model
(Gemma 31B) for back-translation and paraphrase generation.
"""

import json
import logging
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple, Any
from abc import ABC, abstractmethod

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SyntheticPair:
    """A synthetically generated parallel sentence pair."""
    source: str
    target: str
    source_lang: str
    target_lang: str
    generation_method: str  # back_translation, paraphrase, dialogue
    seed_source: Optional[str] = None  # Original seed if applicable
    quality_score: Optional[float] = None
    domain: str = "general"
    metadata: Dict[str, Any] = field(default_factory=dict)


class TranslationModel(ABC):
    """Abstract base class for translation models."""

    @abstractmethod
    def translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        domain: Optional[str] = None
    ) -> str:
        """Translate text from source to target language."""
        pass

    @abstractmethod
    def generate_paraphrase(
        self,
        text: str,
        lang: str,
        num_paraphrases: int = 1
    ) -> List[str]:
        """Generate paraphrases of the input text."""
        pass


class GemmaTranslationModel(TranslationModel):
    """Gemma-based translation model for corpus generation."""

    def __init__(
        self,
        model_name: str = "google/gemma-2-27b-it",
        device: str = "cuda",
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_new_tokens: int = 256
    ):
        """Initialize the Gemma model.

        Args:
            model_name: HuggingFace model identifier
            device: Device to run on (cuda/cpu)
            temperature: Sampling temperature
            top_p: Nucleus sampling parameter
            max_new_tokens: Maximum tokens to generate
        """
        self.model_name = model_name
        self.device = device
        self.temperature = temperature
        self.top_p = top_p
        self.max_new_tokens = max_new_tokens
        self.model = None
        self.tokenizer = None

    def load_model(self):
        """Lazy load the model."""
        if self.model is not None:
            return

        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch

            logger.info(f"Loading model: {self.model_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch.bfloat16,
                device_map="auto"
            )
            logger.info("Model loaded successfully")

        except ImportError:
            logger.error("transformers library required")
            raise

    def _generate(self, prompt: str) -> str:
        """Generate text from prompt."""
        self.load_model()

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=self.max_new_tokens,
            temperature=self.temperature,
            top_p=self.top_p,
            do_sample=True,
            pad_token_id=self.tokenizer.eos_token_id
        )

        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        # Extract just the generated part
        response = response[len(prompt):].strip()
        return response

    def translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        domain: Optional[str] = None
    ) -> str:
        """Translate text using Gemma."""
        lang_names = {
            "so": "Somali",
            "sw": "Swahili",
            "ti": "Tigrinya",
            "ar": "Arabic",
            "prs": "Dari",
            "tr": "Turkish",
            "en": "English"
        }

        source_name = lang_names.get(source_lang, source_lang)
        target_name = lang_names.get(target_lang, target_lang)

        domain_context = ""
        if domain:
            domain_context = f" This is {domain} domain text."

        prompt = f"""<start_of_turn>user
Translate the following {source_name} text to {target_name}.{domain_context}
Only output the translation, nothing else.

{text}<end_of_turn>
<start_of_turn>model
"""
        return self._generate(prompt)

    def generate_paraphrase(
        self,
        text: str,
        lang: str,
        num_paraphrases: int = 1
    ) -> List[str]:
        """Generate paraphrases of the input text."""
        lang_names = {
            "so": "Somali",
            "sw": "Swahili",
            "ti": "Tigrinya",
            "ar": "Arabic",
            "prs": "Dari",
            "tr": "Turkish",
            "en": "English"
        }

        lang_name = lang_names.get(lang, lang)
        paraphrases = []

        for i in range(num_paraphrases):
            prompt = f"""<start_of_turn>user
Paraphrase the following {lang_name} text. Keep the same meaning but use different words and sentence structure.
Only output the paraphrase, nothing else.

{text}<end_of_turn>
<start_of_turn>model
"""
            paraphrase = self._generate(prompt)
            if paraphrase and paraphrase != text:
                paraphrases.append(paraphrase)

        return paraphrases


class MockTranslationModel(TranslationModel):
    """Mock model for testing without GPU."""

    def translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        domain: Optional[str] = None
    ) -> str:
        return f"[{target_lang}] {text}"

    def generate_paraphrase(
        self,
        text: str,
        lang: str,
        num_paraphrases: int = 1
    ) -> List[str]:
        return [f"[paraphrase {i+1}] {text}" for i in range(num_paraphrases)]


class CorpusGenerator:
    """Generate synthetic parallel corpora using various augmentation techniques."""

    def __init__(
        self,
        model: TranslationModel,
        source_lang: str = "so",
        target_lang: str = "sw",
        pivot_lang: str = "en",
        output_dir: str = "./data/synthetic"
    ):
        """Initialize the corpus generator.

        Args:
            model: Translation model to use
            source_lang: Source language code
            target_lang: Target language code
            pivot_lang: Pivot language for back-translation
            output_dir: Directory to save generated data
        """
        self.model = model
        self.source_lang = source_lang
        self.target_lang = target_lang
        self.pivot_lang = pivot_lang
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Generation logs for reproducibility
        self.generation_log: List[Dict] = []

    def back_translate(
        self,
        text: str,
        lang: str,
        domain: Optional[str] = None
    ) -> Tuple[str, str]:
        """Perform back-translation through pivot language.

        Args:
            text: Original text
            lang: Language of the text
            domain: Optional domain tag

        Returns:
            Tuple of (pivot_translation, back_translation)
        """
        # Translate to pivot language
        pivot = self.model.translate(
            text, lang, self.pivot_lang, domain
        )

        # Translate back to original language
        back = self.model.translate(
            pivot, self.pivot_lang, lang, domain
        )

        return pivot, back

    def generate_back_translation_pairs(
        self,
        monolingual_source: List[str],
        domain: str = "general",
        max_attempts: int = 3
    ) -> Iterator[SyntheticPair]:
        """Generate parallel pairs via back-translation.

        Process:
        1. Take source monolingual text
        2. Translate source -> target
        3. Back-translate target -> source
        4. If back-translation is similar to original, keep the pair

        Args:
            monolingual_source: List of source language sentences
            domain: Domain tag
            max_attempts: Max retries for quality pairs

        Yields:
            SyntheticPair objects
        """
        for i, source_text in enumerate(monolingual_source):
            if i % 100 == 0:
                logger.info(f"Processing {i}/{len(monolingual_source)}")

            for attempt in range(max_attempts):
                try:
                    # Translate source -> target
                    target_text = self.model.translate(
                        source_text,
                        self.source_lang,
                        self.target_lang,
                        domain
                    )

                    if not target_text or len(target_text) < 3:
                        continue

                    # Back-translate target -> source for validation
                    back_source = self.model.translate(
                        target_text,
                        self.target_lang,
                        self.source_lang,
                        domain
                    )

                    # Log generation for reproducibility
                    log_entry = {
                        "method": "back_translation",
                        "original": source_text,
                        "target": target_text,
                        "back_translation": back_source,
                        "domain": domain,
                        "attempt": attempt
                    }
                    self.generation_log.append(log_entry)

                    yield SyntheticPair(
                        source=source_text,
                        target=target_text,
                        source_lang=self.source_lang,
                        target_lang=self.target_lang,
                        generation_method="back_translation",
                        seed_source=source_text,
                        domain=domain,
                        metadata={
                            "back_translation": back_source,
                            "attempt": attempt
                        }
                    )
                    break

                except Exception as e:
                    logger.warning(f"Back-translation failed: {e}")
                    continue

    def generate_paraphrase_augmented(
        self,
        parallel_pairs: List[Tuple[str, str]],
        num_paraphrases: int = 2,
        domain: str = "general"
    ) -> Iterator[SyntheticPair]:
        """Augment parallel data with paraphrases.

        For each parallel pair (source, target):
        1. Generate paraphrases of source
        2. Keep original target paired with each paraphrase

        Args:
            parallel_pairs: List of (source, target) tuples
            num_paraphrases: Number of paraphrases per sentence
            domain: Domain tag

        Yields:
            SyntheticPair objects
        """
        for i, (source, target) in enumerate(parallel_pairs):
            if i % 100 == 0:
                logger.info(f"Augmenting {i}/{len(parallel_pairs)}")

            # Generate source paraphrases
            source_paraphrases = self.model.generate_paraphrase(
                source, self.source_lang, num_paraphrases
            )

            for paraphrase in source_paraphrases:
                log_entry = {
                    "method": "paraphrase",
                    "original_source": source,
                    "paraphrase": paraphrase,
                    "target": target,
                    "domain": domain
                }
                self.generation_log.append(log_entry)

                yield SyntheticPair(
                    source=paraphrase,
                    target=target,
                    source_lang=self.source_lang,
                    target_lang=self.target_lang,
                    generation_method="paraphrase",
                    seed_source=source,
                    domain=domain,
                    metadata={"original_source": source}
                )

    def generate_domain_dialogue(
        self,
        domain: str,
        num_dialogues: int = 100,
        turns_per_dialogue: int = 4
    ) -> Iterator[SyntheticPair]:
        """Generate domain-specific dialogue pairs.

        Creates synthetic conversations relevant to humanitarian contexts.

        Args:
            domain: Domain (medical, legal, humanitarian)
            num_dialogues: Number of dialogues to generate
            turns_per_dialogue: Turns per dialogue

        Yields:
            SyntheticPair objects
        """
        domain_prompts = {
            "medical": [
                "patient describing symptoms",
                "doctor asking about medical history",
                "explaining a diagnosis",
                "discussing treatment options"
            ],
            "legal": [
                "explaining legal rights",
                "describing an incident",
                "asylum interview question",
                "document verification"
            ],
            "humanitarian": [
                "registration process explanation",
                "asking about family members",
                "describing living conditions",
                "requesting assistance"
            ]
        }

        prompts = domain_prompts.get(domain, domain_prompts["humanitarian"])

        for i in range(num_dialogues):
            context = random.choice(prompts)

            # Generate source dialogue turn
            source_prompt = f"""<start_of_turn>user
Generate a short {self.source_lang} sentence that a person might say during: {context}
Only output the sentence in {self.source_lang}, nothing else.<end_of_turn>
<start_of_turn>model
"""
            try:
                if hasattr(self.model, '_generate'):
                    source_text = self.model._generate(source_prompt)
                else:
                    source_text = f"[{self.source_lang} {context}]"

                # Translate to target
                target_text = self.model.translate(
                    source_text,
                    self.source_lang,
                    self.target_lang,
                    domain
                )

                if source_text and target_text:
                    log_entry = {
                        "method": "dialogue",
                        "domain": domain,
                        "context": context,
                        "source": source_text,
                        "target": target_text
                    }
                    self.generation_log.append(log_entry)

                    yield SyntheticPair(
                        source=source_text,
                        target=target_text,
                        source_lang=self.source_lang,
                        target_lang=self.target_lang,
                        generation_method="dialogue",
                        domain=domain,
                        metadata={"context": context}
                    )

            except Exception as e:
                logger.warning(f"Dialogue generation failed: {e}")
                continue

    def save_generation_log(self, filename: str = "generation_log.jsonl"):
        """Save generation log for reproducibility."""
        log_path = self.output_dir / filename
        with open(log_path, "w", encoding="utf-8") as f:
            for entry in self.generation_log:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        logger.info(f"Saved generation log to {log_path}")

    def save_corpus(
        self,
        pairs: List[SyntheticPair],
        prefix: str = "synthetic"
    ) -> Tuple[Path, Path]:
        """Save generated corpus to files.

        Args:
            pairs: List of synthetic pairs
            prefix: File prefix

        Returns:
            Tuple of (source_path, target_path)
        """
        source_path = self.output_dir / f"{prefix}.{self.source_lang}"
        target_path = self.output_dir / f"{prefix}.{self.target_lang}"
        meta_path = self.output_dir / f"{prefix}.meta.jsonl"

        with open(source_path, "w", encoding="utf-8") as sf, \
             open(target_path, "w", encoding="utf-8") as tf, \
             open(meta_path, "w", encoding="utf-8") as mf:

            for pair in pairs:
                sf.write(pair.source + "\n")
                tf.write(pair.target + "\n")
                meta = {
                    "method": pair.generation_method,
                    "domain": pair.domain,
                    "quality_score": pair.quality_score,
                    **pair.metadata
                }
                mf.write(json.dumps(meta, ensure_ascii=False) + "\n")

        logger.info(f"Saved {len(pairs)} pairs to {self.output_dir}")
        return source_path, target_path


if __name__ == "__main__":
    # Example usage with mock model
    model = MockTranslationModel()
    generator = CorpusGenerator(
        model=model,
        source_lang="so",
        target_lang="sw"
    )

    # Generate some test pairs
    test_sentences = [
        "Waxaan rabaa inaan tago dhakhtar",
        "Qoyskaygii waa ku sugan dalka kale"
    ]

    pairs = list(generator.generate_back_translation_pairs(
        test_sentences,
        domain="medical"
    ))

    print(f"Generated {len(pairs)} pairs")
    for p in pairs:
        print(f"  {p.source} -> {p.target}")
