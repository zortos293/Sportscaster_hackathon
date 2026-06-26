---
name: Sportcast Design System
colors:
  surface: '#f9f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f9f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f5'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e4'
  on-surface: '#1a1c1d'
  on-surface-variant: '#5a403d'
  inverse-surface: '#2f3132'
  inverse-on-surface: '#f0f0f2'
  outline: '#8e706c'
  outline-variant: '#e3beba'
  surface-tint: '#b52420'
  primary: '#b52420'
  on-primary: '#ffffff'
  primary-container: '#ff5a4e'
  on-primary-container: '#600004'
  inverse-primary: '#ffb4ab'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#5d5f5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#929393'
  on-tertiary-container: '#2a2c2c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#92030b'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#f9f9fb'
  on-background: '#1a1c1d'
  surface-variant: '#e2e2e4'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system is engineered to deliver a high-energy, premium sports streaming experience. It balances the intensity of live athletics with a clean, cinematic minimalism that allows content to remain the focal point. The brand personality is professional, authoritative, and fast-paced, yet remains highly approachable through soft geometry and generous whitespace.

The aesthetic leans into **Modern Minimalism** with a **Tactile** edge. It utilizes large-scale imagery, high-contrast typography inspired by editorial sports journalism, and a refined "card-stack" visual architecture. The goal is to evoke the feeling of a premium physical arena—clean lines, expansive views, and focused action—translated into a digital interface.

## Colors
The palette is rooted in a "High-Contrast Athletics" philosophy. 

- **Primary (Warm Coral):** Used exclusively for calls to action, live indicators, and critical focus states. It provides the "pulse" of the application.
- **Base (White):** The primary surface color to maintain a clean, open, and airy feel reminiscent of Apple’s modern service design.
- **Contrast (Black):** Used for primary headings and heavy structural elements to provide a grounded, professional weight.
- **Neutrals:** A range of soft, cool-toned grays are used to differentiate content zones (e.g., `#F4F4F6` for background sections and `#E5E7EB` for borders) without introducing visual clutter.

## Typography
The typography system uses a pairing of **Montserrat** for headlines to convey strength and energy, and **Inter** for body text to ensure maximum legibility for data-heavy sports stats.

Headlines should use tight letter-spacing to feel impactful and "headline-ready." Body text utilizes a standard 1.5x line-height ratio to ensure readability during long-form content browsing. Labels and "Live" tags should frequently use uppercase styling with increased letter spacing to differentiate them from standard prose.

## Layout & Spacing
The layout follows a **Fluid Grid** system based on an 8px square rhythm. 

- **Desktop:** A 12-column grid with 24px gutters. Content is centered with a max-width of 1280px to prevent excessive line lengths.
- **Mobile:** A 4-column grid with 16px margins.
- **Horizontal Scrolling:** For "Content Rows" (e.g., Live Games, Suggested for You), elements should bleed off the edge of the screen to signify scrollability, mimicking the Netflix browsing pattern. 

Use generous vertical padding (64px+) between major sections to maintain the "Minimalist" feel and avoid the cramped nature of traditional sports scoreboards.

## Elevation & Depth
Depth is created through **Ambient Shadows** and **Tonal Layering**. Surfaces are stacked logically:

1. **Background (Level 0):** Pure White (#FFFFFF) or Soft Gray (#F4F4F6) for secondary sections.
2. **Cards/Containers (Level 1):** White background with a very soft, diffused shadow (0px 4px 20px rgba(0,0,0,0.05)).
3. **Hover States/Modals (Level 2):** Increased shadow spread (0px 12px 32px rgba(0,0,0,0.08)) to suggest physical lifting.

Avoid heavy inner shadows or sharp borders. Contrast should be achieved through subtle shifts in gray or the primary color, rather than dark outlines.

## Shapes
This design system utilizes a **Rounded** shape language to feel modern and accessible.

- **Standard Elements:** Buttons, input fields, and small cards use a `0.5rem` (8px) radius.
- **Large Containers:** Content cards and feature hero sections use `1rem` (16px) radius.
- **Pills/Chips:** Always use a fully rounded (999px) "pill" shape for categories and status badges (e.g., "LIVE").

## Components

### Buttons
- **Primary:** Pill-shaped, Primary (#FF5A4E) background, White text. Bold weight.
- **Secondary:** Pill-shaped, White background with a 1px soft gray border or transparent background with black text.
- **Icon Buttons:** Circular containers with centered icons, used for "Play," "Add to List," or "Share."

### Chips (Horizontal Scrolling)
- Used for sports categories (e.g., NBA, NFL, Soccer).
- **Inactive:** Light gray background (#F4F4F6) with Black text.
- **Active:** Black background with White text.

### Cards
- **Game Cards:** 16:9 aspect ratio for video previews. Feature a subtle gradient overlay at the bottom for legibility of overlaid text (Score, Time remaining).
- **Player/Stat Cards:** 1:1 or 4:5 aspect ratio with centered imagery and high-contrast typography.

### Input Fields
- Soft gray background with no border in default state.
- **Focus State:** 2px solid Primary (#FF5A4E) border or a subtle Primary glow. 
- Placeholder text in a muted gray Inter 14px.

### Live Indicators
- A small pill-shaped badge using the Primary color with a subtle "pulse" animation. Text should be white, uppercase, and 10px bold.