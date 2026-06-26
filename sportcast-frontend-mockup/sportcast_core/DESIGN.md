---
name: Sportcast Core
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#5a403d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#8e706c'
  outline-variant: '#e3beba'
  surface-tint: '#b52420'
  primary: '#b52420'
  on-primary: '#ffffff'
  primary-container: '#ff5a4e'
  on-primary-container: '#600004'
  inverse-primary: '#ffb4ab'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#006d36'
  on-tertiary: '#ffffff'
  tertiary-container: '#00a957'
  on-tertiary-container: '#003416'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#92030b'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#6afe9b'
  tertiary-fixed-dim: '#49e182'
  on-tertiary-fixed: '#00210c'
  on-tertiary-fixed-variant: '#005227'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
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
    lineHeight: 32px
  headline-md:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Montserrat
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Montserrat
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The brand personality is energetic, athletic, and media-focused, centered around the thrill of live sports broadcasting. The design style is **Corporate / Modern** with a high-performance edge, characterized by clean lines, ample negative space, and dynamic accents. 

Inspired by the new logo's geometry, the visual language incorporates continuous paths and rounded terminals. The aesthetic emphasizes motion and clarity, ensuring that complex sports data and high-energy video content remain the primary focus. The UI should evoke a sense of professional reliability combined with the excitement of a live event.

## Colors

The palette is anchored by the signature **Coral Accent (#FF5A4E)**, used for primary actions, branding elements, and "live" indicators to signal urgency and energy. 

- **Primary:** Coral is used sparingly for high-impact touchpoints.
- **Secondary:** Deep Onyx (#1A1A1A) provides strong contrast for text and structural headers, mirroring the logo's wordmark.
- **Tertiary:** A vibrant Success Green is used for positive score changes and betting "up" indicators.
- **Neutral:** A cool-toned grayscale spectrum ensures a clean, professional environment for data-heavy layouts. 
- **Functional:** Use high-transparency blacks (8-12%) for subtle surface differentiation.

## Typography

The typography system uses **Montserrat** exclusively to maintain a bold, geometric, and modern feel. 

Headlines utilize heavier weights (Bold/700) to mimic the impact of sports headlines, while body copy remains at Regular (400) for high legibility during long-form reading or stat analysis. Labels and utility text use Semi-Bold (600) and uppercase styling for a "broadcast ticker" feel. Tighten letter-spacing on display sizes to create a more locked-in, professional appearance.

## Layout & Spacing

This design system employs a **Fluid Grid** model based on an 8px spatial scale. 

- **Desktop:** 12-column grid with 24px gutters and 40px outer margins. Content is typically centered with a maximum width of 1440px.
- **Tablet:** 8-column grid with 16px gutters.
- **Mobile:** 4-column grid with 12px gutters and 16px side margins.

Use "sm" (12px) for internal component spacing and "md" (24px) for spacing between distinct content modules. Large "xl" spacing is reserved for Hero section padding to maintain an airy, premium feel.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Ambient Shadows**. Surfaces are kept primarily flat to maintain a "digital dashboard" aesthetic, with depth used only to indicate interactivity or temporary states.

- **Level 0 (Base):** Neutral background (#F4F5F7).
- **Level 1 (Cards):** Pure white (#FFFFFF) with no shadow, but a 1px stroke in #E5E7EB.
- **Level 2 (Hover/Active):** Subtle, extra-diffused shadow (0px 4px 20px rgba(0,0,0,0.05)) to suggest lifting.
- **Level 3 (Overlays/Modals):** High-elevation shadows with a larger blur radius (0px 12px 32px rgba(0,0,0,0.12)) and a dimming backdrop overlay.

## Shapes

The shape language is directly informed by the new logo's rounded 'S' path. UI elements use a **Rounded** (0.5rem / 8px) corner radius as the standard. This balance provides a modern, approachable feel without becoming overly "bubbly."

- **Standard Buttons & Inputs:** 8px (0.5rem).
- **Cards & Containers:** 16px (1rem).
- **Interactive Tags/Chips:** Full pill-shape for maximum distinction from buttons.
- **Icons:** Use a 2px stroke weight with rounded caps and joins to match the logo's stroke characteristics.

## Components

### Buttons
Primary buttons use the Coral (#FF5A4E) background with white Montserrat Semi-Bold text. Secondary buttons utilize a ghost style: 1px Onyx border with Onyx text. Hover states should include a slight darkening of the background color and a Level 2 shadow.

### Cards
Cards are the primary container for scores and news. Use a 16px corner radius and a subtle 1px gray-200 border. Content inside cards should follow the 16px internal padding rule.

### Input Fields
Inputs feature an 8px radius and a 1px border that shifts to Coral on focus. Labels should be small, uppercase Montserrat (label-md).

### Chips & Badges
"Live" status badges must use a Coral background with a pulsing dot icon. Categorical chips (e.g., "NBA", "NFL") use a light gray background with Onyx text and a full pill-shape radius.

### Play Indicators
Drawing from the logo's play button, all video thumbnails must feature a centered play icon with a 20% Coral tint backdrop blur or a solid Coral fill. The triangle within the icon must match the specific equilateral proportions of the logo's play mark.