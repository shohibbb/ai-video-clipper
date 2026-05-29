---
name: Cyber-Editorial Obsidian
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#383939'
  surface-container-lowest: '#0c0f0e'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2a'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e1'
  on-surface-variant: '#c6c9ab'
  inverse-surface: '#e2e2e1'
  inverse-on-surface: '#2f3130'
  outline: '#909378'
  outline-variant: '#454932'
  surface-tint: '#b9d300'
  primary: '#ffffff'
  on-primary: '#2c3400'
  primary-container: '#d3f000'
  on-primary-container: '#5d6b00'
  inverse-primary: '#576400'
  secondary: '#d7ffc5'
  on-secondary: '#053900'
  secondary-container: '#2ff801'
  on-secondary-container: '#0f6d00'
  tertiary: '#ffffff'
  on-tertiary: '#27313f'
  tertiary-container: '#d9e3f6'
  on-tertiary-container: '#5b6575'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d3f000'
  primary-fixed-dim: '#b9d300'
  on-primary-fixed: '#191e00'
  on-primary-fixed-variant: '#414c00'
  secondary-fixed: '#79ff5b'
  secondary-fixed-dim: '#2ae500'
  on-secondary-fixed: '#022100'
  on-secondary-fixed-variant: '#095300'
  tertiary-fixed: '#d9e3f6'
  tertiary-fixed-dim: '#bdc7d9'
  on-tertiary-fixed: '#121c2a'
  on-tertiary-fixed-variant: '#3d4756'
  background: '#121414'
  on-background: '#e2e2e1'
  surface-variant: '#333535'
typography:
  headline-xl:
    fontFamily: Be Vietnam Pro
    fontSize: 72px
    fontWeight: '900'
    lineHeight: 80px
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.03em
  headline-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.25em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  headline-xl-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 40px
    fontWeight: '900'
    lineHeight: 48px
    letterSpacing: -0.04em
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 20px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style

This design system establishes a high-performance, developer-centric environment that blends the structural authority of a technical manual with the electric energy of a high-end IDE. It is designed to evoke precision, technical mastery, and intentionality.

The aesthetic follows a **Modern Cyber-Editorial** style. It utilizes an ultra-dark canvas to maximize focus, accented by high-voltage neon highlights that signify interactivity and system telemetry. The interface feels "overclocked" yet highly disciplined—relying on heavy whitespace, razor-sharp typography, and translucent obsidian layers that mimic a sophisticated digital terminal.

Key visual pillars include:
- **High-Density Focus:** Dark surfaces that reduce eye strain during prolonged technical sessions.
- **Neon Precision:** Functional color used exclusively for action, status, and navigation.
- **Structural Framing:** A subtle underlying grid that organizes information with mathematical rigor.

## Colors

The palette is optimized for a dark-first experience, prioritizing high contrast and legibility in low-light environments.

- **Background:** A deep Obsidian Canvas (`#0B0A09`) serves as the foundation.
- **Primary (Neon Lime):** The hyper-interactive color for call-to-actions, primary buttons, and active focus states.
- **Secondary (Laser Green):** Reserved for "success" states, completed tasks, and operational system health.
- **Neutral (Silver White):** Used for primary text to ensure razor-sharp readability against the dark canvas.
- **Muted (Steel):** A grounding neutral for secondary borders, navigation links, and inactive UI elements.

Borders should use a "Neon Hairline" approach: `rgba(223, 254, 0, 0.15)` for a subtle, glowing structural definition.

## Typography

The typography system relies on a high-contrast mix of contemporary sans-serifs and technical monospaced fonts.

- **Display & Headlines:** Be Vietnam Pro is used for its bold, punchy geometry. Large display sizes must use aggressive negative letter spacing to create a solid "block" of text.
- **Body:** Inter provides a neutral, systematic foundation for long-form reading and interface copy. It should be set with generous line heights to maintain breathability.
- **Technical Metadata:** JetBrains Mono is utilized for labels, tags, and code snippets. Label-caps should always be uppercase with wide tracking to contrast against the tight tracking of headlines.

## Layout & Spacing

This design system uses a **Fluid Grid** approach anchored by a 4px baseline unit. Layouts are structured to emphasize central work content with side-aligned telemetry bars.

- **Desktop:** A 12-column grid with a `max-width` of 1280px. Gutters are fixed at 20px to maintain a compact, data-dense feel.
- **Mobile:** A single-column layout with 20px safe-area margins.
- **Spacing Rhythm:** Use `md` (16px) for internal component padding and `xl` (32px) for vertical section gaps.

Layouts should favor asymmetric proportions (e.g., 60/40 or 70/30) to distinguish between primary content and secondary utility/stats sidebars.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Glassmorphism**, rather than traditional shadows.

1.  **Base Layer:** The Obsidian Canvas (`#0B0A09`).
2.  **Surface Layer:** Translucent Obsidian Panels (`rgba(22, 21, 20, 0.84)`) with a `24px` backdrop blur. This allows the background and any background grid lines to bleed through softly.
3.  **Accent Layer:** Components on this level use the Neon Hairline border to "pop" from the background.

Shadows, when used, are extremely diffused and low-opacity (`rgba(0, 0, 0, 0.60)`), acting as an ambient occlusion rather than a light-source shadow.

## Shapes

The shape language balances industrial rigidity with "squircle" softness. 

- **Containers & Cards:** Use `rounded-xl` (1.5rem) or `rounded-[2rem]` for main structural panels to create a premium, tactile feel.
- **Buttons & Inputs:** Use `rounded-lg` (1rem) to maintain a cohesive, friendly but professional look.
- **Badges & Pills:** Use `rounded-full` for status indicators and navigation pills.

Large corner radii are essential to offset the strict geometric grid lines of the typography and background textures.

## Components

- **Buttons:**
    - **Primary:** Solid Neon Lime (`#DFFE00`) with Obsidian text. On hover, it shifts to Laser Green (`#39FF14`) with a slight upward translation (-2px).
    - **Secondary:** Transparent background with a 1px Steel border. On hover, the border glows Neon Lime.
- **Inputs:** `rounded-lg` with a solid Charcoal (`#161514`) background. The focus state triggers a 1px Neon Lime border and a `ring-4` glowing shadow (`rgba(223, 254, 0, 0.10)`).
- **Cards:** Utilize the translucent obsidian panel styling. Headers within cards should use the `label-caps` typography style.
- **Chips/Status Badges:** Compact, `rounded-full` shapes with high-contrast text. Use Neon Lime for "active," Laser Green for "success," and Steel for "inactive."
- **Lists:** Data-heavy lists should use thin Neon Hairline dividers and `label-mono` for secondary data points to maintain a technical, CLI-inspired aesthetic.