# ============================================================
# GEMMA 4 TRAINING SCRIPT - CLEAN DATA + EOS FIX
# Copy this entire file into a single Kaggle cell
# ============================================================

# MUST upgrade transformers AND peft for Gemma 4 support
!pip install --upgrade transformers peft -q
!pip install -q bitsandbytes accelerate sacrebleu

import os
os.environ["CUDA_VISIBLE_DEVICES"] = "0"

from kaggle_secrets import UserSecretsClient
from huggingface_hub import login
secrets = UserSecretsClient()
hf_token = secrets.get_secret("HF_TOKEN")
login(token=hf_token)

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments, Trainer, DataCollatorForLanguageModeling
from peft import get_peft_model, LoraConfig, TaskType
from datasets import Dataset
from pathlib import Path

OUTPUT_DIR = Path("/kaggle/working/daraja-gemma4")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# STEP 1: LOAD AND FILTER DATA
# ============================================================
print("Loading data...")
DATA_DIR = Path("/kaggle/input/datasets/jeremiahsakuda/daraja-seed-data")

with open(DATA_DIR / "NLLB.so-sw.so", 'r') as f:
    sources = [l.strip() for l in f]
with open(DATA_DIR / "NLLB.so-sw.sw", 'r') as f:
    targets = [l.strip() for l in f]

print(f"Loaded {len(sources)} total pairs")

# Religious content filter
religious_patterns = [
    'Mungu', 'Mwenyezi', 'Yesu', 'Yehova', 'Biblia', 'Allah',
    'mtume', 'nabii', 'malaika', 'dhambi', 'sala', 'ibada',
    'gospel', 'injili', 'Kristo', 'msalaba', 'mitume',
    'pepo', 'jahanamu', 'roho', 'takatifu',
    'Ilaah', 'Alle', 'Quraan', 'Nebi', 'Ciise',
]

def is_clean_pair(s, t):
    text = (s + " " + t).lower()
    if any(p.lower() in text for p in religious_patterns):
        return False
    if len(s) > 80 or len(t) > 80:
        return False
    if len(s) < 5 or len(t) < 5:
        return False
    ratio = len(t) / max(len(s), 1)
    if ratio < 0.5 or ratio > 2.0:
        return False
    return True

all_pairs = list(zip(sources, targets))
clean_pairs = [p for p in all_pairs if is_clean_pair(p[0], p[1])]

print(f"Original pairs: {len(all_pairs)}")
print(f"Clean pairs: {len(clean_pairs)} ({100*len(clean_pairs)/len(all_pairs):.1f}% kept)")

# Use 50K for training, hold out 500 for eval
clean_train = clean_pairs[:50000]
clean_eval = clean_pairs[-500:]
print(f"Training on: {len(clean_train)} clean pairs")

# Format training data
texts = [f"Translate Somali to Swahili:\n{s}\nSwahili:\n{t}" for s, t in clean_train]

# ============================================================
# STEP 2: LOAD GEMMA 4 MODEL
# ============================================================
print("\nLoading Gemma 4 E2B...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    "google/gemma-4-E2B-it",
    quantization_config=bnb_config,
    device_map={"": 0},
    token=hf_token,
)

tokenizer = AutoTokenizer.from_pretrained("google/gemma-4-E2B-it", token=hf_token)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

# ============================================================
# STEP 3: ADD LORA
# ============================================================
# NOTE: Gemma 4 uses Gemma4ClippableLinear which PEFT doesn't recognize by default
# Using "all-linear" tells PEFT to find and wrap nested linear layers safely
# See: https://dev.to/dentity007/fine-tuning-gemma-4-on-day-zero-3-bugs-we-solved-in-30-minutes-2ke
lora_config = LoraConfig(
    r=32,
    lora_alpha=64,
    target_modules="all-linear",  # CRITICAL: Don't specify modules manually for Gemma 4
    lora_dropout=0,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# ============================================================
# STEP 4: TOKENIZE WITH EOS FIX
# ============================================================
print("\nTokenizing with EOS fix...")
dataset = Dataset.from_dict({"text": texts})

def tokenize_with_eos_fix(examples):
    tokenized = tokenizer(
        examples["text"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )

    labels = []
    for input_ids in tokenized["input_ids"]:
        label = list(input_ids)
        eos_id = tokenizer.eos_token_id
        found_eos = False
        for i in range(len(label)):
            if label[i] == eos_id and not found_eos:
                found_eos = True
            elif label[i] == eos_id and found_eos:
                label[i] = -100
        labels.append(label)

    tokenized["labels"] = labels
    return tokenized

tokenized = dataset.map(tokenize_with_eos_fix, batched=True, remove_columns=["text"])
print("Tokenization complete")

# ============================================================
# STEP 5: TRAIN
# ============================================================
trainer = Trainer(
    model=model,
    train_dataset=tokenized,
    args=TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        num_train_epochs=2,
        learning_rate=2e-4,
        warmup_steps=100,
        fp16=True,
        bf16=False,
        logging_steps=100,
        save_strategy="steps",
        save_steps=500,
        optim="adamw_8bit",
        gradient_checkpointing=True,
        report_to="none",
        remove_unused_columns=False,
    ),
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
)

print("\n" + "=" * 50)
print("TRAINING GEMMA 4 (~2-3 hours) - DO NOT LEAVE!")
print("=" * 50 + "\n")

trainer.train()

# ============================================================
# STEP 6: SAVE IMMEDIATELY
# ============================================================
print("\n" + "=" * 50)
print("SAVING MODEL")
print("=" * 50)

LORA_DIR = OUTPUT_DIR / "lora"
model.save_pretrained(LORA_DIR)
tokenizer.save_pretrained(LORA_DIR)
print(f"Saved locally to {LORA_DIR}")

# Push to HuggingFace
print("\nPushing to HuggingFace...")
model.push_to_hub("JeremiahSKD/daraja-gemma4-so-sw-v1", token=hf_token)
tokenizer.push_to_hub("JeremiahSKD/daraja-gemma4-so-sw-v1", token=hf_token)
print("Pushed to HuggingFace!")

# ============================================================
# STEP 7: TEST IMMEDIATELY
# ============================================================
print("\n" + "=" * 50)
print("TESTING TRANSLATIONS")
print("=" * 50 + "\n")

model.eval()

test_sentences = [
    "Waxaan rabaa in aan kaa caawiyo",
    "Mahadsanid",
    "Nabad",
    "Magaalada waa weyn tahay",
    "Waan ku faraxsanahay in aan ku arko",
    "Carruurta waxay ku ciyaaraan beerta",
]

for sent in test_sentences:
    prompt = f"Translate Somali to Swahili:\n{sent}\nSwahili:\n"
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=30,
            do_sample=False,
            repetition_penalty=1.2,
        )
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    translation = result.split("Swahili:\n")[-1].strip()
    for stop in ['\n', '"', '. ']:
        if stop in translation:
            translation = translation.split(stop)[0].strip()
    print(f"Somali:  {sent}")
    print(f"Swahili: {translation}\n")

# ============================================================
# STEP 8: EVALUATE WITH chrF++
# ============================================================
print("\n" + "=" * 50)
print("EVALUATING WITH chrF++")
print("=" * 50 + "\n")

from sacrebleu.metrics import CHRF

print(f"Evaluating on {len(clean_eval)} held-out pairs...")

hypotheses = []
for i, (s, t) in enumerate(clean_eval):
    prompt = f"Translate Somali to Swahili:\n{s}\nSwahili:\n"
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=30,
            do_sample=False,
            repetition_penalty=1.2,
        )
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    translation = result.split("Swahili:\n")[-1].strip()
    for stop in ['\n', '"', '. ']:
        if stop in translation:
            translation = translation.split(stop)[0].strip()
    hypotheses.append(translation)
    if i % 100 == 0:
        print(f"  {i}/{len(clean_eval)}...")

references = [[t] for s, t in clean_eval]
chrf = CHRF()
score = chrf.corpus_score(hypotheses, references)

print(f"\n{'=' * 50}")
print(f"GEMMA 4 chrF++ SCORE: {score.score:.1f}")
print(f"(Gemma 2 baseline was: 36.1)")
print(f"{'=' * 50}")

print("\n" + "=" * 50)
print("DONE! Model trained, saved, tested, and evaluated.")
print(f"HuggingFace: https://huggingface.co/JeremiahSKD/daraja-gemma4-so-sw-v1")
print("=" * 50)
