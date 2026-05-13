# ============================================================
# GEMMA 4 TRAINING SCRIPT - GOOGLE COLAB VERSION
# ============================================================
#
# SETUP BEFORE RUNNING:
# 1. Upload these files from so-sw-data/ to Google Drive folder: Daraja/data/
#    - NLLB.so-sw.so (630K Somali sentences)
#    - NLLB.so-sw.sw (630K Swahili translations)
# 2. Add HF_TOKEN to Colab secrets (Key icon in left sidebar)
# 3. Use GPU runtime: Runtime > Change runtime type > T4 GPU
#
# ============================================================

# CELL 1: Install dependencies (run this, then restart runtime)
# !pip install --upgrade transformers peft -q
# !pip install -q bitsandbytes accelerate sacrebleu

# After restart, run from CELL 2 onwards

# ============================================================
# CELL 2: Mount Drive & Setup
# ============================================================
from google.colab import drive
drive.mount('/content/drive')

import os
os.environ["CUDA_VISIBLE_DEVICES"] = "0"

# Get HuggingFace token from Colab secrets
try:
    from google.colab import userdata
    hf_token = userdata.get('HF_TOKEN')
except:
    hf_token = input("Enter your HuggingFace token: ")

from huggingface_hub import login
login(token=hf_token)

import torch
from transformers import (
    AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig,
    TrainingArguments, Trainer, DataCollatorForLanguageModeling,
    TrainerCallback
)
from peft import get_peft_model, LoraConfig, TaskType
from datasets import Dataset
from pathlib import Path

# ============================================================
# PATHS - Using Google Drive for persistence!
# ============================================================
DRIVE_ROOT = Path("/content/drive/MyDrive/Daraja")
DATA_DIR = DRIVE_ROOT / "data"
OUTPUT_DIR = DRIVE_ROOT / "models/gemma4-v1"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print(f"Data directory: {DATA_DIR}")
print(f"Output directory: {OUTPUT_DIR}")

# ============================================================
# STEP 1: LOAD AND FILTER DATA
# ============================================================
print("\nLoading data...")

source_file = DATA_DIR / "NLLB.so-sw.so"
target_file = DATA_DIR / "NLLB.so-sw.sw"

if not source_file.exists():
    raise FileNotFoundError(f"Data not found at {source_file}\nPlease upload NLLB.so-sw.so to Google Drive: Daraja/data/")

with open(source_file, 'r', encoding='utf-8') as f:
    sources = [l.strip() for l in f]
with open(target_file, 'r', encoding='utf-8') as f:
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
lora_config = LoraConfig(
    r=32,
    lora_alpha=64,
    target_modules="all-linear",  # CRITICAL for Gemma 4
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
# STEP 5: TRAINING CALLBACK - Push to HF every 1000 steps
# ============================================================
class SaveToHubCallback(TrainerCallback):
    """Push model to HuggingFace Hub periodically during training"""
    def __init__(self, save_steps=1000):
        self.save_steps = save_steps
        self.last_save = 0

    def on_step_end(self, args, state, control, model=None, **kwargs):
        if state.global_step - self.last_save >= self.save_steps:
            print(f"\n>>> Pushing checkpoint at step {state.global_step} to HuggingFace...")
            try:
                model.push_to_hub(
                    "JeremiahSKD/daraja-gemma4-so-sw-v1",
                    token=hf_token,
                    commit_message=f"Checkpoint at step {state.global_step}"
                )
                print(f">>> Checkpoint pushed successfully!")
                self.last_save = state.global_step
            except Exception as e:
                print(f">>> Warning: Failed to push checkpoint: {e}")

# ============================================================
# STEP 6: TRAIN
# ============================================================
trainer = Trainer(
    model=model,
    train_dataset=tokenized,
    args=TrainingArguments(
        output_dir=str(OUTPUT_DIR),  # Saves to Google Drive!
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        num_train_epochs=2,
        learning_rate=2e-4,
        warmup_steps=100,
        fp16=True,
        bf16=False,
        logging_steps=100,
        save_strategy="steps",
        save_steps=500,  # Checkpoints saved to Drive every 500 steps
        optim="adamw_8bit",
        gradient_checkpointing=True,
        report_to="none",
        remove_unused_columns=False,
    ),
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    callbacks=[SaveToHubCallback(save_steps=1000)],  # Push to HF every 1000 steps
)

print("\n" + "=" * 50)
print("TRAINING GEMMA 4")
print("Checkpoints save to Google Drive (survives crashes!)")
print("Pushing to HuggingFace every 1000 steps")
print("=" * 50 + "\n")

trainer.train()

# ============================================================
# STEP 7: FINAL SAVE
# ============================================================
print("\n" + "=" * 50)
print("SAVING FINAL MODEL")
print("=" * 50)

LORA_DIR = OUTPUT_DIR / "lora"
model.save_pretrained(LORA_DIR)
tokenizer.save_pretrained(LORA_DIR)
print(f"Saved locally to {LORA_DIR}")

# Final push to HuggingFace
print("\nFinal push to HuggingFace...")
model.push_to_hub("JeremiahSKD/daraja-gemma4-so-sw-v1", token=hf_token)
tokenizer.push_to_hub("JeremiahSKD/daraja-gemma4-so-sw-v1", token=hf_token)
print("Pushed to HuggingFace!")

# ============================================================
# STEP 8: TEST TRANSLATIONS
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
# STEP 9: EVALUATE WITH chrF++
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

# Save eval results to Drive
eval_file = OUTPUT_DIR / "eval_results.txt"
with open(eval_file, 'w') as f:
    f.write(f"chrF++ Score: {score.score:.1f}\n")
    f.write(f"Evaluated on: {len(clean_eval)} pairs\n")
    f.write(f"Gemma 2 baseline: 36.1\n")
print(f"Saved eval results to {eval_file}")

print("\n" + "=" * 50)
print("DONE! Model trained, saved, tested, and evaluated.")
print(f"Google Drive: {LORA_DIR}")
print(f"HuggingFace: https://huggingface.co/JeremiahSKD/daraja-gemma4-so-sw-v1")
print("=" * 50)
