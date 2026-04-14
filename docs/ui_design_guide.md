# Daraja UI Design Guide

A comprehensive design specification for third-party designers building the Daraja translation interface.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Brand Identity](#brand-identity)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Component Library](#component-library)
7. [Page Designs](#page-designs)
8. [Accessibility Requirements](#accessibility-requirements)
9. [Animation & Motion](#animation--motion)
10. [Design Assets](#design-assets)

---

## Design Philosophy

### Core Principles

**1. Trust & Warmth**
- The app serves vulnerable populations (refugees, asylum seekers)
- Design must feel warm, approachable, and trustworthy
- Avoid clinical/cold aesthetics; embrace human-centered design

**2. Accessibility First**
- Large touch targets (minimum 44x44px)
- High contrast ratios (WCAG AA minimum)
- Voice-first interaction design
- Works for users with limited tech literacy

**3. Offline-Ready Visual Language**
- Clear online/offline status indicators
- Obvious sync status for queued actions
- Confidence in data persistence

**4. Cross-Cultural Sensitivity**
- RTL language support (Arabic, Dari)
- Avoid culturally specific iconography
- Neutral, universally understood symbols

### The "Bridge" Metaphor

The name "Daraja" means "bridge" in Swahili. This metaphor should subtly influence the design:
- Connecting visual elements (arches, spans)
- Two-sided layouts (source ↔ target)
- Warm amber tones suggesting sunrise/hope

---

## Brand Identity

### Logo

The Daraja logo represents a bridge with three supporting pillars:

```
    ╭───────────────────╮
    │                   │
    │    ╱╲    ╱╲    ╱╲  │   (Stylized bridge arc with 3 pillars)
    │   │  │  │  │  │  │ │
────────────────────────────
```

**Logo Usage:**
- Primary: Daraja-600 (#D97706) on light backgrounds
- Inverse: White on Daraja-700+ backgrounds
- Minimum size: 24x24px
- Clear space: 1x logo width on all sides

### Tagline

"Building bridges through translation"

---

## Color System

### Primary Palette (Daraja Amber)

| Token | Hex | Usage |
|-------|-----|-------|
| daraja-50 | `#FEF9F3` | Page backgrounds |
| daraja-100 | `#FEF3E2` | Card backgrounds, hover states |
| daraja-200 | `#FDE4C4` | Borders, dividers |
| daraja-300 | `#FBCE99` | Disabled states |
| daraja-400 | `#F8A94D` | Icons, secondary text |
| daraja-500 | `#F59E0B` | **Primary accent** |
| daraja-600 | `#D97706` | **Primary buttons**, links |
| daraja-700 | `#B45309` | Hover states, emphasis |
| daraja-800 | `#92400E` | Headings, primary text |
| daraja-900 | `#78350F` | Body text |
| daraja-950 | `#451A03` | Maximum contrast text |

### Semantic Colors

#### Trust (High Confidence)
| Token | Hex | Usage |
|-------|-----|-------|
| trust-50 | `#F0FDF4` | Success backgrounds |
| trust-100 | `#DCFCE7` | High confidence badge bg |
| trust-500 | `#22C55E` | Success icons |
| trust-600 | `#16A34A` | Success text |
| trust-700 | `#15803D` | High confidence badge text |

#### Caution (Medium Confidence)
| Token | Hex | Usage |
|-------|-----|-------|
| caution-50 | `#FFFBEB` | Warning backgrounds |
| caution-100 | `#FEF3C7` | Medium confidence badge bg |
| caution-500 | `#F59E0B` | Warning icons |
| caution-600 | `#D97706` | Medium confidence badge text |

#### Alert (Low Confidence)
| Token | Hex | Usage |
|-------|-----|-------|
| alert-50 | `#FEF2F2` | Error/flag backgrounds |
| alert-100 | `#FEE2E2` | Low confidence badge bg |
| alert-500 | `#EF4444` | Error icons |
| alert-600 | `#DC2626` | Low confidence badge text |

### Color Application Examples

```
┌─────────────────────────────────────────┐
│  Page Background: daraja-50             │
│  ┌─────────────────────────────────┐    │
│  │  Card: white, border daraja-100 │    │
│  │                                 │    │
│  │  Heading: daraja-800            │    │
│  │  Body text: daraja-900          │    │
│  │  Secondary text: daraja-500     │    │
│  │                                 │    │
│  │  ┌─────────────────┐            │    │
│  │  │ Button: daraja-600 bg        │    │
│  │  │ Button text: white           │    │
│  │  └─────────────────┘            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Typography

### Font Stack

```css
/* Primary text */
font-family: 'Source Sans 3', system-ui, sans-serif;

/* Display/Headings */
font-family: 'Libre Franklin', system-ui, sans-serif;

/* Monospace (IDs, codes) */
font-family: 'JetBrains Mono', Consolas, monospace;
```

### Type Scale (Accessibility-Enhanced)

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| xs | 13px | 20px | Captions, timestamps |
| sm | 15px | 24px | Secondary text, labels |
| base | 17px | 28px | Body text |
| lg | 19px | 30px | Emphasized body |
| xl | 22px | 32px | Subheadings |
| 2xl | 26px | 36px | Section headers |
| 3xl | 32px | 40px | Page titles |
| 4xl | 40px | 48px | Hero text |

### Type Usage

**Display (Libre Franklin)**
- Page titles
- Section headers
- Feature callouts
- Weight: 600-700 (semibold to bold)

**Body (Source Sans 3)**
- All body text
- Form labels
- Button text
- Navigation
- Weight: 400-600 (regular to semibold)

**Mono (JetBrains Mono)**
- Session IDs
- Confidence percentages
- Technical information
- Weight: 400

---

## Spacing & Layout

### Spacing Scale

| Token | Size | Usage |
|-------|------|-------|
| 0.5 | 2px | Tight spacing |
| 1 | 4px | Icon gaps |
| 2 | 8px | Related elements |
| 3 | 12px | Component internal |
| 4 | 16px | Standard gap |
| 5 | 20px | Section spacing |
| 6 | 24px | Card padding |
| 8 | 32px | Section breaks |
| 10 | 40px | Major sections |
| 12 | 48px | Page padding |

### Layout Grid

**Mobile (< 640px)**
- Single column
- 16px horizontal padding
- Cards: full width minus padding

**Tablet (640px - 1024px)**
- Two column layouts where appropriate
- 24px horizontal padding
- Max content width: 640px

**Desktop (> 1024px)**
- Centered content
- Max content width: 768px
- 32px horizontal padding

### Touch Targets

```
Minimum touch target: 44px × 44px

┌────────────────────────────────────┐
│                                    │
│    ○ 44px minimum for icons        │
│                                    │
│    ┌──────────────────────────┐    │
│    │                          │    │
│    │  Buttons: 56px height    │    │
│    │  (padding: 12px 24px)    │    │
│    │                          │    │
│    └──────────────────────────┘    │
│                                    │
│    Voice button: 80px diameter     │
│                                    │
└────────────────────────────────────┘
```

---

## Component Library

### 1. Buttons

#### Primary Button
```
┌─────────────────────────────────┐
│                                 │
│      [Icon]  Button Text        │  height: 56px
│                                 │  padding: 12px 24px
└─────────────────────────────────┘  border-radius: 16px
                                     bg: daraja-600
                                     text: white
                                     shadow: warm
```

States:
- **Default**: daraja-600 bg, warm shadow
- **Hover**: daraja-700 bg, warm-lg shadow
- **Active**: scale(0.98)
- **Disabled**: 50% opacity, no hover

#### Secondary Button
```
┌─────────────────────────────────┐
│                                 │
│      [Icon]  Button Text        │  bg: daraja-100
│                                 │  border: 2px daraja-200
└─────────────────────────────────┘  text: daraja-800
```

#### Ghost Button
```
      [Icon]  Button Text            bg: transparent
                                     text: daraja-700
                                     hover-bg: daraja-100
```

#### Voice Recording Button
```
        ┌───────────┐
       ╱             ╲
      │               │
      │    🎤 (mic)   │              80px diameter
      │               │              bg: daraja-600
       ╲             ╱               shadow: warm-lg
        └───────────┘

Recording state:
        ┌───────────┐
       ╱   ●●●●●●●   ╲               bg: alert-500
      │               │              pulsing animation
      │    ■ (stop)   │              scale: 1.0 → 1.1 → 1.0
       ╲             ╱
        └───────────┘
```

### 2. Cards

#### Standard Card
```
┌──────────────────────────────────────┐
│                                      │
│                                      │
│          Content Area                │   bg: white
│                                      │   border: 1px daraja-100
│                                      │   border-radius: 24px
│                                      │   padding: 24px
│                                      │   shadow: warm
└──────────────────────────────────────┘
```

#### Interactive Card
```
┌──────────────────────────────────────┐
│                                      │
│          Clickable Content           │   hover: shadow-warm-lg
│                                      │   hover: border-daraja-200
│                      →               │   cursor: pointer
└──────────────────────────────────────┘
```

### 3. Confidence Badges

```
High Confidence:     ┌──────────────────┐
                     │ ✓ 94% Confident  │   bg: trust-100
                     └──────────────────┘   text: trust-700
                                            icon: checkmark

Medium Confidence:   ┌──────────────────┐
                     │ ⚠ 72% Review     │   bg: caution-100
                     └──────────────────┘   text: caution-600
                                            icon: warning

Low Confidence:      ┌──────────────────┐
                     │ ✕ 38% Flag       │   bg: alert-100
                     └──────────────────┘   text: alert-600
                                            icon: flag
```

### 4. Progress Indicator

```
Interview Progress: 5 of 12 questions

┌────────────────────────────────────────┐
│████████████████░░░░░░░░░░░░░░░░░░░░░░░│   height: 8px
└────────────────────────────────────────┘   bg: daraja-200
                                             fill: daraja-500
                                             border-radius: full
```

### 5. Translation Display

```
Source (Somali):
┌──────────────────────────────────────┐
│                                      │
│  "Magacaygu waa Faadumo Xasan"       │   bg: daraja-100
│                                      │   border-radius: 16px
└──────────────────────────────────────┘   padding: 16px

        ↓ (arrow indicator)

Translation (Swahili):
┌──────────────────────────────────────┐
│                                      │
│  "Jina langu ni Fadumo Hassan"       │   bg: white
│                                      │   border: 2px daraja-200
│                     ┌───────────┐    │
│                     │ ✓ 94%     │    │   confidence badge
│                     └───────────┘    │
└──────────────────────────────────────┘
```

### 6. Form Fields

#### Text Input
```
Label
┌──────────────────────────────────────┐
│                                      │
│  Placeholder text...              ✕  │   height: 48px
│                                      │   bg: white
└──────────────────────────────────────┘   border: 2px daraja-200
                                           focus-border: daraja-500
                                           border-radius: 12px
```

#### Text Area
```
Label
┌──────────────────────────────────────┐
│                                      │
│  Multiline content here...           │   min-height: 120px
│                                      │   resize: vertical
│                                      │
│                                      │
└──────────────────────────────────────┘
```

### 7. Navigation

#### Bottom Navigation Bar
```
┌──────────────────────────────────────────────────┐
│                                                  │
│    🏠        📋        ⚙️                        │   height: 64px
│   Home    Interview   Settings                   │   bg: white
│                                                  │   border-top: 1px daraja-100
│  (active)                                        │   safe-area-bottom padding
└──────────────────────────────────────────────────┘

Active state: daraja-600 icon/text, daraja-100 background pill
```

#### Header
```
┌──────────────────────────────────────────────────┐
│                                                  │
│  🌉 Daraja                    ● Online    ↺ 2   │   height: 56px
│                                                  │   bg: white/80 blur
│                               (status) (pending) │   border-bottom: 1px
└──────────────────────────────────────────────────┘   sticky top
```

---

## Page Designs

### Page 1: Home / Landing

**Purpose:** Welcome users, show available language pairs, start workflows

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Header: Daraja logo + Online/Offline status     │
├──────────────────────────────────────────────────┤
│                                                  │
│              ┌────────────┐                      │
│              │            │                      │
│              │  🌉 Logo   │                      │
│              │            │                      │
│              └────────────┘                      │
│                                                  │
│              Daraja                              │
│    Building bridges through translation          │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  SUPPORTED LANGUAGE PAIRS                  │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ Somali → Swahili            [Ready] │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ Tigrinya → Arabic      Coming soon  │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ Dari → Turkish         Coming soon  │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │        Start Interview Session             │  │  Primary button
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│        Works offline after initial setup         │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation: Home | Interview | Settings  │
└──────────────────────────────────────────────────┘
```

**Interactions:**
- Language pair cards: Non-interactive for "coming soon", clickable for active
- "Start Interview Session" → Navigate to workflow selection
- Header status updates in real-time

---

### Page 2: Workflow Selection

**Purpose:** Choose which interview type to conduct

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  ← Back                        Daraja           │
├──────────────────────────────────────────────────┤
│                                                  │
│  Select Workflow                                 │
│  Choose the type of interview to conduct         │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  📋                                        │  │
│  │  RSD Interview                             │  │
│  │  UNHCR Refugee Status Determination        │  │
│  │                                            │  │
│  │  ⏱ 30-45 min    📄 15 questions      →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  🏥                                        │  │
│  │  Medical Intake                            │  │
│  │  WHO Primary Care Assessment               │  │
│  │                                            │  │
│  │  ⏱ 15-20 min    📄 12 questions      →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  ⚖️                                        │  │
│  │  Legal Declaration                         │  │
│  │  Sworn Statement for Documentation         │  │
│  │                                            │  │
│  │  ⏱ 30-45 min    📄 10 questions      →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation                               │
└──────────────────────────────────────────────────┘
```

**Interactions:**
- Each workflow card is tappable
- Tap → Start interview with that workflow
- Back button → Return to home

---

### Page 3: Interview Session (Main Workflow)

**Purpose:** Conduct structured interview with voice input and translation

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  ✕ End        RSD Interview          Save ✓     │
├──────────────────────────────────────────────────┤
│                                                  │
│  Personal Information                            │  Section title
│  Question 2 of 15                                │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │  Progress bar
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │  What is your date of birth?               │  │  Question card
│  │                                            │  │
│  │  ─────────────────────────────────────     │  │
│  │                                            │  │
│  │  Speak your answer in Somali               │  │  Instructions
│  │                                            │  │
│  │                                            │  │
│  │              ┌─────────┐                   │  │
│  │              │         │                   │  │
│  │              │   🎤    │                   │  │  Voice button
│  │              │         │                   │  │  80px diameter
│  │              └─────────┘                   │  │
│  │           Tap to speak                     │  │
│  │                                            │  │
│  │  ── OR ──                                  │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Type your answer...              ✕  │  │  │  Text fallback
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│                                                  │
│  ┌───────────┐                  ┌───────────┐   │
│  │  ← Prev   │                  │  Next →   │   │  Navigation
│  └───────────┘                  └───────────┘   │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation                               │
└──────────────────────────────────────────────────┘
```

**Recording State:**
```
│  │              ┌─────────┐                   │  │
│  │              │  ●●●●●  │                   │  │  Recording indicator
│  │              │   ■     │                   │  │  Pulsing animation
│  │              └─────────┘                   │  │  Red background
│  │           0:05 / 2:00                      │  │  Timer
│  │        Tap to stop recording               │  │
```

**With Response:**
```
│  │                                            │  │
│  │  Source (Somali):                          │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ "Waxaan dhashay 15-kii Maarso 1990"  │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │           ↓                                │  │
│  │                                            │  │
│  │  Translation (Swahili):                    │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ "Nilizaliwa tarehe 15 Machi 1990"    │  │  │
│  │  │                         ┌────────┐   │  │  │
│  │  │                         │ ✓ 91%  │   │  │  │
│  │  │                         └────────┘   │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  ↺  Re-record                        │  │  │  Ghost button
│  │  └──────────────────────────────────────┘  │  │
```

---

### Page 4: Translation Result with Flag

**Purpose:** Show translation with confidence warning for medium/low confidence

**Layout (Low Confidence):**
```
┌──────────────────────────────────────────────────┐
│  Header                                          │
├──────────────────────────────────────────────────┤
│                                                  │
│  Translation                                     │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Source (Somali):                          │  │
│  │                                            │  │
│  │  "Waxaan ka baqayaa inay i dilaan         │  │
│  │   haddii aan ku laabto dalkaygii"          │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  ⚠️ LOW CONFIDENCE - REVIEW REQUIRED       │  │  Alert banner
│  │                                            │  │  bg: alert-50
│  │  This translation may contain errors.      │  │  border: alert-200
│  │  Please verify with a qualified            │  │
│  │  interpreter for critical decisions.       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Translation (Swahili):                    │  │
│  │                                            │  │
│  │  "Ninaogopa kwamba wanaweza kuniua        │  │
│  │   ̲n̲i̲k̲i̲r̲u̲d̲i̲ ̲n̲c̲h̲i̲n̲i̲"                        │  │  Flagged segment
│  │                                            │  │  (underlined)
│  │                         ┌──────────────┐   │  │
│  │                         │ ✕ 42% Flag   │   │  │  Low confidence badge
│  │                         └──────────────┘   │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Flag Reasons:                             │  │
│  │  • Low semantic similarity                 │  │
│  │  • Domain terminology uncertain            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           Accept Translation               │  │  Primary button
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           Re-record Response               │  │  Secondary button
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation                               │
└──────────────────────────────────────────────────┘
```

---

### Page 5: Interview Complete / Export

**Purpose:** Summary of completed interview with export options

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Header                                          │
├──────────────────────────────────────────────────┤
│                                                  │
│              ✓                                   │  Success icon
│         Interview Complete                       │  (large, animated)
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Summary                                   │  │
│  │                                            │  │
│  │  Workflow:     RSD Interview               │  │
│  │  Duration:     32 minutes                  │  │
│  │  Questions:    15 / 15 completed           │  │
│  │  Avg Confidence: 84%                       │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ ⚠ 2 responses flagged for review    │  │  │  Warning if flagged
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Export Options                                  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  📄                                        │  │
│  │  Download Bilingual PDF                    │  │
│  │  Full transcript with translations         │  │
│  │                                       →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  📋                                        │  │
│  │  Download Summary                          │  │
│  │  One-page overview                         │  │
│  │                                       →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  🖨️                                        │  │
│  │  Print                                     │  │
│  │                                       →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           Start New Interview              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation                               │
└──────────────────────────────────────────────────┘
```

---

### Page 6: Quick Translate (No Workflow)

**Purpose:** Ad-hoc translation without structured workflow

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Header                                          │
├──────────────────────────────────────────────────┤
│                                                  │
│  Quick Translate                                 │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Language Pair                             │  │
│  │                                            │  │
│  │  ┌────────────┐    →    ┌────────────┐    │  │
│  │  │  Somali ▼  │         │ Swahili ▼  │    │  │
│  │  └────────────┘         └────────────┘    │  │
│  │                                            │  │
│  │                  ⟳                         │  │  Swap button
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Enter text or speak                       │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │                                      │  │  │
│  │  │  Type or paste text here...          │  │  │  Text area
│  │  │                                      │  │  │
│  │  │                                      │  │  │
│  │  │                             156/500  │  │  │  Character count
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │          OR                                │  │
│  │                                            │  │
│  │              ┌─────────┐                   │  │
│  │              │   🎤    │                   │  │  Voice button
│  │              └─────────┘                   │  │
│  │           Tap to speak                     │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │           Translate                        │  │  Primary button
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  (Translation result appears below)              │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation                               │
└──────────────────────────────────────────────────┘
```

---

### Page 7: History / Past Sessions

**Purpose:** View and resume past interview sessions

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Header                                          │
├──────────────────────────────────────────────────┤
│                                                  │
│  Session History                                 │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  🔍 Search sessions...                     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Today                                           │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  RSD Interview                      ✓ Done │  │
│  │  Somali → Swahili                          │  │
│  │  32 min • 15 questions • 2 flagged         │  │
│  │  10:45 AM                             →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Medical Intake              ◐ In Progress │  │
│  │  Somali → Swahili                          │  │
│  │  8/12 questions completed                  │  │
│  │  9:15 AM                              →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Yesterday                                       │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Legal Declaration                  ✓ Done │  │
│  │  Somali → Swahili                          │  │
│  │  45 min • 10 questions • 0 flagged         │  │
│  │  3:30 PM                              →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │         📥 2 sessions pending sync         │  │  Sync status banner
│  │             (waiting for connection)        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation                               │
└──────────────────────────────────────────────────┘
```

---

### Page 8: Settings

**Purpose:** App configuration and preferences

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Header                                          │
├──────────────────────────────────────────────────┤
│                                                  │
│  Settings                                        │
│                                                  │
│  Language & Translation                          │
│  ┌────────────────────────────────────────────┐  │
│  │  Default Language Pair                     │  │
│  │  Somali → Swahili                     →    │  │
│  ├────────────────────────────────────────────┤  │
│  │  Default Domain                            │  │
│  │  General                              →    │  │
│  ├────────────────────────────────────────────┤  │
│  │  Show Confidence Scores        ┌────────┐  │  │
│  │                                │  ON    │  │  │  Toggle
│  │                                └────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Offline & Storage                               │
│  ┌────────────────────────────────────────────┐  │
│  │  Cached Data                               │  │
│  │  128 MB used                          →    │  │
│  ├────────────────────────────────────────────┤  │
│  │  Auto-sync when online     ┌────────┐      │  │
│  │                            │  ON    │      │  │
│  │                            └────────┘      │  │
│  ├────────────────────────────────────────────┤  │
│  │  Clear All Data                            │  │
│  │                                       →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  About                                           │
│  ┌────────────────────────────────────────────┐  │
│  │  Version                                   │  │
│  │  0.1.0                                     │  │
│  ├────────────────────────────────────────────┤  │
│  │  Model Status                              │  │
│  │  Daraja-SO-SW v1.0 (loaded)          →    │  │
│  ├────────────────────────────────────────────┤  │
│  │  Privacy Policy                       →    │  │
│  ├────────────────────────────────────────────┤  │
│  │  Open Source Licenses                 →    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Bottom Navigation                               │
└──────────────────────────────────────────────────┘
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

1. **Color Contrast**
   - Text on backgrounds: minimum 4.5:1 ratio
   - Large text (18px+): minimum 3:1 ratio
   - UI components: minimum 3:1 ratio
   - Never use color alone to convey information

2. **Touch Targets**
   - Minimum 44x44px for all interactive elements
   - Recommended 48x48px for primary actions
   - Voice button: 80x80px

3. **Focus Indicators**
   - 2px solid ring in daraja-500
   - 2px offset from element
   - Visible on all interactive elements

4. **Text Scaling**
   - Support 200% zoom without loss of functionality
   - Use relative units (rem) for all text
   - Don't break layout at large text sizes

5. **Screen Reader Support**
   - All images have alt text
   - Form inputs have labels
   - Buttons have descriptive text
   - Live regions for dynamic updates

6. **Motion & Animation**
   - Respect `prefers-reduced-motion`
   - No flashing content
   - Animations < 5 seconds

### RTL Language Support

For Arabic and Dari (right-to-left languages):

```
LTR Layout:                      RTL Layout:
┌────────────────────┐           ┌────────────────────┐
│  Label     [Input] │           │ [Input]     Label  │
│  ← Back    Next →  │           │  → Back    ← Next  │
└────────────────────┘           └────────────────────┘
```

- Mirror horizontal layouts
- Flip directional icons
- Maintain reading flow
- Test with native speakers

---

## Animation & Motion

### Principles

1. **Purposeful** - Animation should aid understanding, not distract
2. **Fast** - Most transitions 200-300ms
3. **Subtle** - Avoid dramatic effects
4. **Respectful** - Honor reduced motion preferences

### Animation Specifications

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Fade in | 300ms | ease-out | Content appearing |
| Slide up | 300ms | ease-out | Cards, modals |
| Button press | 150ms | ease-in-out | scale(0.98) |
| Recording pulse | 1500ms | ease-in-out | Mic button |
| Progress fill | 500ms | ease-out | Progress bars |
| Page transition | 250ms | ease-in-out | Route changes |

### Recording Animation

```css
@keyframes recording {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}
```

### Loading States

```
Standard spinner:        Skeleton loading:
    ○                    ┌────────────────────┐
   ╱ ╲                   │ ░░░░░░░░░░         │
  ╱   ╲                  │ ░░░░░░░░░░░░░░░░░  │
 ○─────○                 │ ░░░░░░░░░░░░       │
                         └────────────────────┘
                         (pulsing gray)
```

---

## Design Assets

### Required Deliverables

1. **Figma/Sketch File**
   - All pages at 375px (mobile) and 768px (tablet)
   - Component library with variants
   - Design tokens linked

2. **Icon Set**
   - 24x24px base size
   - 2px stroke weight
   - daraja-600 default color
   - Provided in SVG format

3. **Logo Package**
   - SVG (primary)
   - PNG at 1x, 2x, 3x
   - Favicon (16, 32, 48, 64, 128, 256px)
   - PWA icons (192, 512px, maskable)

4. **Prototype**
   - Interactive prototype showing key flows
   - Recording/translation flow
   - Confidence flag interactions

### File Naming Convention

```
daraja-[page]-[state]-[breakpoint].png

Examples:
daraja-home-default-mobile.png
daraja-interview-recording-mobile.png
daraja-export-complete-tablet.png
```

---

## Design Checklist

Before handoff, verify:

- [ ] All pages designed at mobile (375px) and tablet (768px)
- [ ] Color contrast passes WCAG AA
- [ ] Touch targets minimum 44x44px
- [ ] Focus states visible on all interactive elements
- [ ] RTL layouts for Arabic/Dari
- [ ] Loading/empty/error states for all dynamic content
- [ ] Recording/processing animations specified
- [ ] Confidence badge variants (high/medium/low)
- [ ] Offline indicators and sync status
- [ ] Export/PDF preview
- [ ] Prototype demonstrates voice recording flow

---

## Contact

For design questions, reach out to the Daraja team:
- GitHub: github.com/jeremiah-sakuda/daraja
- Issues: Use the "design" label

---

*Last updated: April 2026*
*Version: 1.0*
