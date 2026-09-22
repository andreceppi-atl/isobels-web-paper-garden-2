# Design System: Isobel's Web

> This is the closed token layer for the Webbed × PictoChat direction. Interface code uses semantic tokens only.

## 0. Meta

```yaml
version: 1.0.0
last_updated: 2026-09-20
upstream_source: Isobel's Web approved prototype
schema: https://github.com/Eldergenix/SUPER-DESIGN/schema/v1
framework:
  css: vanilla
  component_library: none
theme_modes: [light]
dark_mode_strategy: media
i18n:
  rtl_support: true
  logical_properties: true
```

## 1. Brand Narrative & Philosophy

A lost monochrome social cartridge: a mostly blank paper-world inside compact handheld chat chrome. The world is the interface, and every message, route, and silk line is evidence that somebody spent time there. It is intimate, cooperative, slightly strange, and never competitive.

**Principles:**
1. The player and their web stay visually primary.
2. Contribution is additive; another spider can never take territory away.
3. Labels beat ambiguous icons, with PictoChat density rather than dashboard density.
4. Physics may be expressive, but inputs remain forgiving.
5. Components use logical properties for RTL and pass WCAG 2.2 AA.

## 2. Color System

### 2.1 Primitive palette

```tokens color.ink
- paper (color): oklch(98.5% 0.006 95)
- 100   (color): oklch(97% 0.003 95)
- 200   (color): oklch(91% 0.006 95)
- 300   (color): oklch(78% 0.008 95)
- 600   (color): oklch(46% 0.008 95)
- 900   (color): oklch(16% 0.006 95)
- 1000  (color): oklch(8% 0.004 95)
```

### 2.2 Semantic layer

| Token | Light | Role |
|---|---|---|
| `--color-bg` | `{color.ink.paper}` | World paper |
| `--color-bg-subtle` | `{color.ink.100}` | Recessed paper |
| `--color-surface` | `{color.ink.100}` | HUD surface |
| `--color-surface-raised` | `{color.ink.paper}` | Raised dialog |
| `--color-fg` | `{color.ink.1000}` | Primary ink |
| `--color-fg-muted` | `{color.ink.600}` | Secondary ink |
| `--color-fg-subtle` | `{color.ink.600}` | Metadata |
| `--color-fg-on-accent` | `{color.ink.paper}` | Reversed ink |
| `--color-border` | `{color.ink.900}` | Rules and panels |
| `--color-border-strong` | `{color.ink.1000}` | Emphasized rules |
| `--color-accent` | `{color.ink.1000}` | Primary action |
| `--color-accent-hover` | `{color.ink.900}` | Primary hover |
| `--color-focus-ring` | `{color.ink.1000}` | Focus indicator |
| `--color-success` | `{color.ink.900}` | Connected state |
| `--color-warning` | `{color.ink.600}` | Expiring state |
| `--color-danger` | `{color.ink.1000}` | Error state |
| `--color-info` | `{color.ink.600}` | Informational state |
| `--color-thread-friend` | `{color.ink.600}` | Shared thread |
| `--color-thread-self` | `{color.ink.900}` | Player thread |

### 2.3 Contrast modes

```css
@media (forced-colors: active) {
  .interactive { border: 1px solid ButtonText; forced-color-adjust: none; }
  .interactive:focus-visible { outline: 3px solid Highlight; outline-offset: 2px; }
}
@media (prefers-contrast: more) {
  :root { --color-fg-muted: var(--color-fg); --color-border: var(--color-border-strong); }
}
```

## 3. Typography

```tokens font.family
- display (fontFamily): ["Georgia", "Times New Roman", "serif"]
- ui      (fontFamily): ["Courier New", "Courier", "monospace"]
```

| Token | Value | Use |
|---|---|---|
| `--text-xs` | `clamp(0.75rem, 0.72rem + 0.15vw, 0.875rem)` | Metadata |
| `--text-sm` | `clamp(0.875rem, 0.82rem + 0.2vw, 1rem)` | Compact UI |
| `--text-base` | `clamp(1rem, 0.94rem + 0.25vw, 1.125rem)` | Body |
| `--text-lg` | `clamp(1.125rem, 1rem + 0.55vw, 1.375rem)` | Panel title |
| `--text-xl` | `clamp(1.375rem, 1.15rem + 1vw, 1.75rem)` | Section title |
| `--text-2xl` | `clamp(1.75rem, 1.35rem + 1.8vw, 2.5rem)` | Screen title |
| `--text-3xl` | `clamp(2.25rem, 1.6rem + 3vw, 3.75rem)` | Brand |
| `--text-4xl` | `clamp(3rem, 2rem + 5vw, 5rem)` | Splash |

## 4. Spacing

```tokens space
- 0  (dimension): 0
- px (dimension): 1px
- 1  (dimension): 4px
- 2  (dimension): 8px
- 3  (dimension): 12px
- 4  (dimension): 16px
- 5  (dimension): 20px
- 6  (dimension): 24px
- 8  (dimension): 32px
- 12 (dimension): 48px
```

```tokens inset
- xs (dimension): {space.2}
- sm (dimension): {space.3}
- md (dimension): {space.4}
- lg (dimension): {space.6}
```

```tokens stack
- xs (dimension): {space.1}
- sm (dimension): {space.2}
- md (dimension): {space.4}
- lg (dimension): {space.6}
```

```tokens inline
- xs (dimension): {space.1}
- sm (dimension): {space.2}
- md (dimension): {space.3}
- lg (dimension): {space.4}
```

```tokens measure
- editor (dimension): 19rem
```

Use logical properties such as `padding-inline`, `margin-block`, and `inset-inline-start`.

## 5. Radius & Shape

```tokens radius
- none (dimension): 0
- md   (dimension): 0
- lg   (dimension): 0
- full (dimension): 9999px
```

Panels are rectangular paper regions. Full radius is reserved for status dots.

## 6. Elevation & Shadow

```tokens shadow
- none   (shadow): none
- offset (shadow): 6px 6px 0 var(--color-border)
- focus  (shadow): 0 0 0 2px var(--color-bg), 0 0 0 5px var(--color-focus-ring)
```

Elevation uses a hard ink offset only; no blurred shadows. The focus ring is always a double-layer box-shadow.

## 7. Motion

```tokens duration
- instant (duration): 75ms
- fast    (duration): 150ms
- base    (duration): 200ms
- slow    (duration): 240ms
```

```tokens ease
- out    (cubicBezier): [0.2, 0, 0, 1]
- in     (cubicBezier): [0.4, 0, 1, 1]
- in-out (cubicBezier): [0.4, 0, 0.2, 1]
```

Animate only transform and opacity. Physics motion is exempt, but decorative bobbing must respect reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## 8. Component State Matrix

Buttons require default, hover, focus-visible, active, disabled, and loading states. Inputs require default, hover, focus-visible, disabled, readonly, error, and placeholder states. Minimum target size is 44px × 44px. Focus uses `box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 5px var(--color-focus-ring)`.

World data views provide loading, empty, error, success, and content states. Network disconnect is an explicit solo/trying-to-reconnect state rather than a hidden failure.

## 9. Layout & Responsive

- Page shells support 320, 375, 428, 768, 1024, 1280, 1440, and 1920 widths.
- The world uses `100dvh`; HUD panels collapse into a bottom PictoChat strip on narrow screens.
- Touch targets remain at least 44px with 8px separation.
- Reusable panels prefer container queries; page composition uses viewport media queries.
- Images preserve aspect ratio and the page has no horizontal scroll at 200% zoom.

## 10. Agent Prompt Guide

Keep physics and presentation separate. Gameplay systems emit small state objects; DOM HUD components consume them. Add semantic tokens here before use. Run the design-system linter, component validator, the full server rules suite, and the map geometry checks before considering a change complete.
