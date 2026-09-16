# VideoTrust AI — Full UI & UX Design Brief

**Product:** VideoTrust AI (Chrome Extension & Web Dashboard)  
**Goal:** Deliver a world-class, premium, non-intrusive user experience that feels like a natural yet elevated extension of YouTube.  
**Theme:** "Native Cyber-Elegance" — Modern Dark Glassmorphism, Precision Typography, Micro-Animations, and Instant Clarity.

---

## 1. Design Philosophy & UX Principles

1. **Zero Distraction (Native Coexistence)**: The extension must never compete with YouTube's core video player. It adopts YouTube's native design vocabulary (pill shapes, dark/light surface modes) while injecting a distinct, high-precision aesthetic.
2. **Glanceable Hierarchy (The 2-Second Rule)**: A user glances at the in-page pill badge and immediately absorbs the verdict without opening a panel:
   - 🟢 **88% Trust** $\rightarrow$ Safe to watch.
   - 🟡 **64% Caution** $\rightarrow$ Check comments / outdated notes.
   - 🔴 **31% Clickbait** $\rightarrow$ Skip video.
3. **Progressive Disclosure**: Information is revealed in layers:
   - *Layer 1 (Always Visible)*: In-page Pill Badge beside YouTube Title.
   - *Layer 2 (Hover Tooltip)*: 1-line reason (*"88% Trust: Verified by 450+ comments"*).
   - *Layer 3 (Click to Open)*: Sliding Intelligence Drawer (420px) with comprehensive telemetry, red flags, and takeaways.
4. **Tactile Feedback & Polish**: Smooth cubic-bezier spring physics, subtle glow borders, and loading skeleton states that feel alive.

---

## 2. Color Palette & Design Tokens

### 2.1 Surfaces & Backgrounds (Dark Mode First)
Designed to seamlessly blend with YouTube's `#0f0f0f` dark mode while adding depth with semi-transparent glass layers.

```css
:root {
  /* Surfaces */
  --vt-bg-base:        #0A0D14;          /* Deep obsidian canvas */
  --vt-bg-surface:     rgba(17, 24, 39, 0.85); /* 85% opacity card surface */
  --vt-bg-drawer:      rgba(11, 15, 25, 0.92); /* Glass drawer with blur */
  --vt-bg-elevated:    rgba(31, 41, 55, 0.70); /* Hover / elevated chips */
  
  /* Borders & Dividers */
  --vt-border-subtle:  rgba(255, 255, 255, 0.08);
  --vt-border-medium:  rgba(255, 255, 255, 0.16);
  --vt-border-glow:    rgba(99, 102, 241, 0.35); /* Electric Indigo focus */
  
  /* Text Typography */
  --vt-text-primary:   #F9FAFB;          /* Crisp high-contrast white */
  --vt-text-secondary: #9CA3AF;          /* Muted slate for metadata */
  --vt-text-tertiary:  #6B7280;          /* Subdued timestamps & labels */
}
```

### 2.2 Semantic Status Accents (Trust Palette)

| State | Accent Color | Glow Aura | Meaning |
| :--- | :--- | :--- | :--- |
| **🟢 Verified / High Trust** | `#10B981` (Emerald-500) | `rgba(16, 185, 129, 0.20)` | Genuine comments, high like-ratio, content matches title promises. |
| **🟡 Caution / Mixed** | `#F59E0B` (Amber-500) | `rgba(245, 158, 11, 0.20)` | Missing transcript, mixed reviews, or outdated library warnings. |
| **🔴 Danger / Clickbait** | `#F43F5E` (Rose-500) | `rgba(244, 63, 94, 0.25)` | Severe title-content divergence, bot-ring spam, or misleading claims. |
| **🟣 AI Intelligence** | `#6366F1` (Indigo-500) | `rgba(99, 102, 241, 0.20)` | Active AI synthesis, vector embeddings, and telemetry badges. |

---

## 3. Typography System

- **Primary Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
- **Monospace Font**: `JetBrains Mono`, `Fira Code`, `ui-monospace` (used for scores, percentages, and telemetry counters).

```
Display Score:   36px / Line 40px / SemiBold (Monospace numeric)
Drawer Title:    18px / Line 24px / Bold
Section Head:    14px / Line 20px / SemiBold / Uppercase tracking-wide
Body Text:       13px / Line 20px / Regular (Optimized for fast reading)
Badge Text:      12px / Line 16px / Medium
Metadata / Tags: 11px / Line 14px / Medium (Monospace)
```

---

## 4. Key UI Components & Layouts

### 4.1 Component 1: In-Page Pill Badge (YouTube Injected)
Injected immediately below the video player next to the creator channel profile and subscribe button.

```
┌─────────────────────────────────────────────────────────────┐
│ [🟢 88% Trust Score]  [✦ Watch Recommended]               │
└─────────────────────────────────────────────────────────────┘
```

#### States:
1. **Skeleton / Loading**: Shimmering pill badge with animated pulse:
   - `[ ⟳ Analyzing 650+ comments... ]`
2. **Active State (Normal)**:
   - Left: Dynamic colored dot (🟢/🟡/🔴) + Numeric Score (`88%`).
   - Right: Recommendation Chip (`WATCH` / `MAYBE` / `SKIP`).
3. **Hover State**:
   - Subtle scale transform (`scale(1.02)`), soft ambient box-shadow glow matching the status color, cursor pointer.
   - Displays a rich native floating tooltip with a 1-sentence breakdown.

---

### 4.2 Component 2: Sliding Intelligence Drawer (420px Width)
Anchored to the right viewport edge. Slides out with glassmorphic backdrop blur when the badge is clicked.

```
┌──────────────────────────────────────────────┐
│  VideoTrust AI                      [ ✕ Esc] │
├──────────────────────────────────────────────┤
│  Build a Full-Stack App in 10 Minutes        │
│  Channel: TechSprint • 320K Views            │
├──────────────────────────────────────────────┤
│  ┌──────────┐  VERDICT: MAYBE WATCH (62%)    │
│  │   62%    │  Clickbait Divergence: 71%     │
│  │  Score   │  "Contains promo, lacks full   │
│  └──────────┘   docker setup code"           │
├──────────────────────────────────────────────┤
│  [ Overview ]  [ Red Flags (3) ]  [ Metrics ]│
├──────────────────────────────────────────────┤
│  ✦ 5-BULLET TAKEAWAYS:                       │
│  • Covers basic Dockerfile instructions.     │
│  • Demonstrates port mapping (8080:80).      │
│  • Pushes a paid backend course at 7:30.     │
│                                              │
│  ⚠️ AUDIENCE RED FLAGS:                      │
│  ┌─────────────────────────────────────────┐ │
│  │ ⚠️ Syntax broken in Node.js 20+         │ │
│  │ Verified by 18 users in comments.       │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ ⚠️ Repository link in description is 404│ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  SCORE METRICS:                              │
│  Authenticity [██████░░░░] 58% (Spam ring)   │
│  Sentiment    [████████░░] 74% (Helpful)     │
│  Integrity    [████░░░░░░] 42% (Clickbait)   │
├──────────────────────────────────────────────┤
│  Was this accurate?   [ 👍 Agree ] [ 👎 Skip]│
└──────────────────────────────────────────────┘
```

#### Drawer Section Breakdown:
1. **Header Zone**:
   - VideoTrust AI brand mark with electric indigo spark icon.
   - Video title and creator name with truncation.
   - Close button (`Esc` key closes instantly).
2. **The Radial Score Ring**:
   - Circular SVG progress meter (diameter $72$px) showing `0–100` score in bold monospace.
   - Dynamic conic-gradient track matching the status color.
3. **Tabbed Navigation Segment**:
   - Three sleek pill tabs:
     - `Overview`: Short TL;DR + 5 Bullet Takeaways.
     - `Audience Truth`: Red-flag warnings vs. Top audience praise.
     - `Deep Metrics`: Raw breakdown of Authenticity, Sentiment, Integrity, and Engagement.
4. **Red-Flag Warning Cards**:
   - Card container with `rgba(244, 63, 94, 0.08)` background and `1px solid rgba(244, 63, 94, 0.25)` border.
   - Warning icon + specific excerpt extracted from user comments.
5. **Footer Feedback Loop**:
   - Instant 1-click feedback buttons allowing users to vote if the AI's recommendation was accurate.

---

### 4.3 Component 3: Search Results Mini-Badges (v1.1)
Small badges positioned directly on YouTube video search result cards over the thumbnail corner:
- `[ 🟢 92% ]`
- `[ 🔴 34% ]`
Allows users to filter bad videos **before even clicking on them**.

---

## 5. Micro-Animations & Motion Design

All animations use an intentional physics curve to feel swift and premium:

```css
--vt-spring-ease: cubic-bezier(0.16, 1, 0.3, 1);
```

| Action | Animation Spec |
| :--- | :--- |
| **Drawer Slide-In** | `transform: translateX(100%)` to `translateX(0)` over `260ms` with `--vt-spring-ease`. |
| **Badge Hover** | Scale from `1.0` to `1.03`, border brightens, box-shadow expands by `8px`. |
| **Radial Ring Fill** | Stroke-dashoffset fills smoothly from $0\%$ to target score over `600ms`. |
| **Tab Switch** | Content fades with `opacity: 0` to `1` and slight slide up (`translateY(4px)`) over `150ms`. |
| **Feedback Click** | Micro-ripple effect; button changes to *"Thanks! Recorded"* with checkmark. |

---

## 6. Responsive & Viewport Adaptability

| Viewport Width | Behavior |
| :--- | :--- |
| **Large Desktop (>1440px)** | Drawer width $420$px. In-page badge sits comfortably beside the Subscribe button. Full transparency glassmorphism. |
| **Standard Laptop (1024px–1440px)** | Drawer width $380$px. In-page badge adjusts font size slightly ($11$px). |
| **Compact / Split Screen (<1024px)** | Drawer expands to $100\%$ width (full slide-over sheet) to ensure read-friendly text. |
| **Theater Mode on YouTube** | Content script listens for Theater Mode toggle and repositions badge seamlessly to maintain zero overlap. |

---

## 7. Accessibility (a11y) & Performance Guardrails

1. **Contrast Compliance**: Text-to-background contrast ratio exceeds WCAG AAA standards ($>7:1$) on all status cards.
2. **Keyboard Accessibility**:
   - `Tab` navigates through tabs, links, and feedback buttons.
   - `Esc` key immediately dismisses the drawer and restores focus to the YouTube player.
   - `Space` key within YouTube does not trigger drawer buttons inadvertently (prevent playback interference).
3. **Paint & Layout Isolation**:
   - All extension elements use `contain: layout style` to guarantee zero layout shifts (CLS = 0) on YouTube's main DOM.
   - CSS backdrop-blur uses GPU-accelerated layers (`will-change: transform`).
