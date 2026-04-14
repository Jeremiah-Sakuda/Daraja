# Daraja Demo Video Script

**Duration:** 3-5 minutes

**Format:** Screen recording with voiceover

---

## Opening (0:00-0:30)

### Visual
- Daraja logo animation
- Title card: "Daraja: Translation for Humanitarian Language Pairs"

### Voiceover
> "Every day, millions of displaced people face a critical barrier: language. A Somali refugee speaking with a Swahili caseworker has no reliable translation tool. Google Translate doesn't support this pair directly. Professional interpreters are scarce.
>
> Daraja is our solution—an offline-capable translation system built specifically for humanitarian contexts."

---

## Problem Statement (0:30-1:00)

### Visual
- Map showing East African refugee corridors
- Statistics overlay (estimated affected populations)
- Screenshots of Google Translate showing "not supported"

### Voiceover
> "In East Africa alone, there are over 4 million refugees. Many speak languages like Somali, Tigrinya, or Dari—languages that commercial translation tools underserve.
>
> When a caseworker needs to conduct a refugee status determination interview, or a healthcare worker needs to take a medical history, miscommunication can have serious consequences."

---

## Solution Overview (1:00-1:30)

### Visual
- Architecture diagram (simplified)
- Flow: Big model → Synthetic data → Small model → Phone

### Voiceover
> "Daraja uses a technique called self-distillation. We use a large language model—Gemma 31B—to generate synthetic translation training data. We then validate this data using semantic similarity, and use it to fine-tune a smaller model that can run entirely offline on a laptop or phone.
>
> The result is a translation model that works without internet, protecting user privacy while providing real-time assistance."

---

## Demo: Interview Session (1:30-3:30)

### Visual
- Screen recording of Daraja web app
- Phone or tablet mockup for mobile view

### Voiceover
> "Let me show you how Daraja works in practice.
>
> Here we have an RSD interview session. The caseworker can select from structured forms designed for specific workflows—refugee status determination, medical intake, or legal declarations.
>
> [Show form selection]
>
> Let's start an interview. The first question asks for the applicant's name.
>
> [Tap voice input button]
>
> The applicant speaks in Somali. Watch as Daraja captures the audio and translates in real-time.
>
> [Show recording animation, then translation appearing]
>
> Notice the confidence badge—green indicates high confidence. The caseworker can trust this translation.
>
> [Navigate to next question]
>
> Now let's try a more complex response—the main reason for leaving their country.
>
> [Record longer response]
>
> This time, notice the yellow warning badge. The confidence is lower, and Daraja recommends review. For critical information like this, the system flags potential issues before they become problems.
>
> [Show flagged segment highlighting]
>
> The caseworker can see exactly which parts of the translation may need verification.
>
> [Complete a few more fields]
>
> Once the interview is complete, Daraja can export a bilingual PDF—showing both the original responses and translations side by side, with confidence indicators for any flagged items."

### Actions to demonstrate:
1. Select RSD interview workflow
2. Use voice input for a name (high confidence)
3. Use voice input for a longer narrative (medium/low confidence)
4. Show confidence badge colors
5. Show flagged segment
6. Navigate between questions
7. Complete session
8. Export PDF

---

## Technical Highlights (3:30-4:00)

### Visual
- Bullet points appearing
- Quick shots of code/notebooks

### Voiceover
> "Some technical highlights:
>
> - We generated over 50,000 synthetic parallel pairs using back-translation and domain-specific dialogue synthesis
> - Semantic similarity filtering ensures only high-quality pairs train the model
> - The fine-tuned model shows a [X] point BLEU improvement over the baseline
> - The entire system runs offline—model weights are stored locally, and data never leaves the device
> - Built as a Progressive Web App, it works on any device with a modern browser"

---

## Offline Capability (4:00-4:20)

### Visual
- Turn on airplane mode
- Show app still working
- IndexedDB storage visualization

### Voiceover
> "And critically, this all works offline. Let me turn on airplane mode...
>
> [Enable airplane mode]
>
> The app continues to function. Translations happen locally. Completed interviews are stored securely on the device, ready to sync when connectivity returns."

---

## Closing (4:20-5:00)

### Visual
- Return to Daraja logo
- GitHub URL
- Team/contact information

### Voiceover
> "Daraja isn't a replacement for human interpreters—critical decisions should always involve qualified professionals. But it's a bridge, a tool that can facilitate initial communication and help identify when specialized interpretation is most needed.
>
> We're releasing Daraja as open source. We hope humanitarian organizations, researchers, and developers will help us expand to more language pairs and improve translation quality.
>
> Thank you for watching. Visit our GitHub to learn more, try the demo, or contribute."

---

## Notes for Recording

### Technical Setup
- Record at 1080p or higher
- Use clean browser profile (no bookmarks/extensions visible)
- Ensure Ollama is running with model loaded
- Have sample Somali text ready for voice input fallback

### Demo Data
Pre-prepare these Somali phrases to speak:
1. Name: "Magacaygu waa Faadumo Xasan"
2. Short response: "Waxaan ka imid Muqdisho"
3. Longer narrative: (Prepare 2-3 sentence response about reasons for leaving)

### Backup Plan
If voice recognition fails during recording:
- Use text input as fallback
- Note in script that voice input is available

### Post-Production
- Add captions/subtitles
- Add transition effects between sections
- Overlay confidence score explanations
- Add background music (subtle, professional)
