---
name: PrintEasy
description: Digital College Printing Management System
colors:
  primary: "#0071E3"
  primary-hover: "#0077ED"
  primary-pressed: "#006EDB"
  bg: "#F5F5F7"
  surface: "#FFFFFF"
  surface-secondary: "#F2F2F4"
  text-primary: "#1D1D1F"
  text-secondary: "#6E6E73"
  border: "#D2D2D7"
  border-subtle: "#E5E5EA"
  success: "#248A3D"
  success-surface: "#EBF7EE"
  warning: "#9A6700"
  warning-surface: "#FFF8E6"
  danger: "#D70015"
  danger-surface: "#FDEBED"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Inter, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Inter, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Inter, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.53
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "24px"
  badge:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: PrintEasy

## Overview

**Creative North Star: "The Academic Atelier"**

PrintEasy is an Apple HIG-inspired, institutional printing management interface designed for clarity, quiet confidence, and operational speed. Rather than feeling like an impersonal administrative backend or a flashy consumer portal, the system operates as a calm, precise digital atelier: generous whitespace, razor-sharp typography, and restrained functional accents.

The aesthetic strips away visual noise—eliminating decorative gradients, arbitrary drop shadows, and unanchored accent colors—to focus the user’s cognitive energy entirely on physical document preparation and status certainty. Every pixel is calibrated to feel approachable to a stressed student submitting a deadline paper and efficient for a high-volume print shop operator.

**Key Characteristics:**
- **Restrained Single-Accent System:** The classic developer blue (`#0071E3`) is reserved exclusively for interactive affordances and primary state transitions.
- **Structural Elevation:** Depth is communicated through 1px hairline dividers (`#D2D2D7`) and subtle tonal surfaces (`#FFFFFF` resting upon `#F5F5F7`), keeping the viewport grounded and readable.
- **Micro-Hierarchy & Tabular Alignment:** Numbers, timestamps, page ranges, and queue IDs use tabular alignment to ensure effortless scanning across dense operational lists.

---

## Colors

The palette is rooted in Apple HIG functional neutrals paired with an authoritative, calibrated blue accent. Status colors are distinct and muted to prevent visual fatigue.

### Primary
- **Atelier Blue** (`#0071E3`): Used strictly for primary interactive actions, active navigation anchors, and system-level focus rings. Hover: `#0077ED`. Pressed: `#006EDB`.

### Neutral
- **Canvas Tint** (`#F5F5F7`): App-wide canvas background providing soft contrast against white cards.
- **Pure Surface** (`#FFFFFF`): Elevated panels, input fields, and modal containers.
- **Secondary Surface** (`#F2F2F4`): Grouped table headers, inactive segments, and pill badges.
- **System Black** (`#1D1D1F`): Primary typography, headings, and high-emphasis labels.
- **System Gray** (`#6E6E73`): Supporting copy, field descriptions, and metadata.
- **Hairline Border** (`#D2D2D7`): Structural 1px containment borders on cards, inputs, and dividers.
- **Subtle Divider** (`#E5E5EA`): Inner table row dividers and list separators.

### Semantic
- **Success Forest** (`#248A3D`): Indicates `READY` status and completed handovers. Surface: `#EBF7EE`.
- **Attention Amber** (`#9A6700`): Indicates `PENDING` queue items requiring operator attention. Surface: `#FFF8E6`.
- **System Red** (`#D70015`): Indicates `FAILED` hardware alerts or destructive actions. Surface: `#FDEBED`.

### Named Rules
**The Single Accent Rule.** The primary blue accent (`#0071E3`) must never appear on more than two primary focal points simultaneously on any screen. Its rarity is the visual cue that guides the eye to the next immediate action.

---

## Typography

The typography leverages the platform's native system font stack to ensure zero font-download latency, instant layout rendering, and flawless rendering on macOS, Windows, and mobile devices.

**System Font Stack:**
`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Inter, sans-serif`

**Character:** Clean, objective, modern sans-serif with natural proportions, open apertures, and subtle optical smoothing.

### Hierarchy
- **Display** (600, 40px / 48px, tracking -0.02em): Large landing headers and empty state greetings.
- **H1** (600, 32px / 40px, tracking -0.01em): Main page titles and portal headers.
- **H2** (600, 24px / 32px): Primary section headings and modal titles.
- **H3** (600, 20px / 28px): Card titles and panel section groupings.
- **Body Large** (400, 17px / 26px): Lead paragraphs and onboarding descriptions.
- **Body** (400, 15px / 23px): Standard body text, form options, and data cell values.
- **Body Small** (400, 13px / 19px): Form helper text and secondary list attributes.
- **Caption** (500, 12px / 16px): Badge text, column headers, and metadata.

### Named Rules
**The Tabular Numerals Rule.** All dynamic counters, copy quantities, page ranges, queue timestamps, and file sizes must explicitly declare `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) to prevent layout shifts and column staggering.

---

## Layout

PrintEasy uses an intentional, structured spatial container optimized for scanning.

- **Centered Container:** Global content wrapper is capped at `1200px` (`max-w-[1200px] mx-auto`).
- **Gutters:** `16px` on mobile screens, expanding to `24px` on tablet, and `32px` on desktop viewports.
- **Base Grid:** 4px micro-spacing scale with all structural margins and paddings operating in 8px increments (`--pe-space-2: 8px`, `--pe-space-4: 16px`, `--pe-space-6: 24px`, `--pe-space-8: 32px`).
- **Responsive Behavior:** Dense desktop queue tables gracefully stack into discrete summary cards on mobile viewports under 640px.

---

## Elevation & Depth

PrintEasy rejects loud 3D skeuomorphism, colored glow halos (`shadow-blue-500/30`), and floating multi-layer blur effects in favor of crisp, structural delineation.

### Shadow Vocabulary
- **Card Shadow** (`box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04)`): Grounded ambient shadow used on primary surface cards.
- **Popover Shadow** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12)`): Floating elevation for notification dropdowns, tooltips, and modal dialogs.

### Named Rules
**The Hairline Primacy Rule.** Depth in PrintEasy is created first by the 1px `#D2D2D7` border separating white surfaces from the canvas. Shadows serve only as secondary ambient grounding; they are never colored or inflated.

---

## Shapes

- **Micro Controls (`--pe-radius-xs: 6px`):** Inner select dropdowns, utility buttons, and icon containers.
- **Standard Controls (`--pe-radius-sm: 10px`):** Primary buttons, text inputs, and segmented tabs.
- **Surface Cards (`--pe-radius-md: 14px`):** Upload zones, queue panels, and data tables.
- **Modal Dialogs (`--pe-radius-lg: 20px`):** Confirmation sheets and alert modals.
- **Pill Geometry (`--pe-radius-pill: 999px`):** Status indicators, role tags, and notification counter bubbles.

---

## Components

### Buttons
- **Shape:** Rounded rectangle (`10px` radius).
- **Primary:** Solid `#0071E3` background, pure white text, 8px vertical by 16px horizontal padding. Hover: `#0077ED`. Pressed: `#006EDB`.
- **Secondary:** Surface `#FFFFFF` with 1px `#D2D2D7` border and `#1D1D1F` text.
- **Touch Target:** Minimum bounding box of 44 × 44 CSS pixels on all interactive workstation controls.

### Inputs & Selects
- **Style:** Pure white surface, 1px `#D2D2D7` border, 8px 12px internal padding, `10px` radius.
- **Focus:** 2px ring in Atelier Blue `#0071E3` with 2px offset.
- **Validation:** Clear helper text rendered immediately adjacent to the input.

### Status Indicators
- **Shape:** Compact pill badge (`rounded-full`) with a 6px circular indicator dot.
- **Pairing:** Status must always feature text alongside color (e.g. `Ready for Pickup`).
- **Tokens:**
  - `PENDING`: Background `#FFF8E6`, text `#9A6700`, dot `#9A6700`.
  - `PROCESSING`: Background `#EBF5FF`, text `#0071E3`, dot `#0071E3`.
  - `READY`: Background `#EBF7EE`, text `#248A3D`, dot `#248A3D`.
  - `COLLECTED`: Background `#F2F2F4`, text `#6E6E73`, dot `#6E6E73`.
  - `FAILED`: Background `#FDEBED`, text `#D70015`, dot `#D70015`.

---

## Do's and Don'ts

### Do:
- **Do** wrap every number, price, date, and page count in `font-variant-numeric: tabular-nums`.
- **Do** use sentence case on all labels, badges, and headings (`Ready for pickup`, not `READY FOR PICKUP`).
- **Do** maintain a strict 44px touch target on all staff workstation actions.
- **Do** pair every status indicator with explicit textual state descriptions.
- **Do** constrain desktop views to `max-w-[1200px]`.

### Don't:
- **Don't** introduce third-party accent colors such as Tailwind purples, oranges, or magentas into administrative dashboards.
- **Don't** use colored glow shadows (e.g., `shadow-blue-500/20`).
- **Don't** use `uppercase` on badges or labels.
- **Don't** communicate state through color alone.
- **Don't** rely on heavy backdrop blur effects that degrade performance on older campus library workstations.
