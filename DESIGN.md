# Design

## Visual Theme

**Warm luxury minimal** — NILIN's signature aesthetic. Clean surfaces with warm blush/cream tones, subtle glass effects, and coral accents. The feel is "curated boutique" not "discount platform."

## Color Palette

### Brand Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `nilin-blush` | `#F5E6E0` | Light accent backgrounds, subtle highlights |
| `nilin-peach` | `#FAE5E0` | Secondary surfaces, hover states |
| `nilin-cream` | `#FDFBF9` | Primary body background |
| `nilin-rose` | `#D4A89A` | Primary text accent, muted emphasis |
| `nilin-coral` | `#E8B4A8` | Primary brand color, CTAs, interactive elements |

### Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `nilin-charcoal` | `#2D2D2D` | Primary text, headings |
| `nilin-warmGray` | `#6B6B6B` | Body text, secondary content |
| `nilin-lightGray` | `#9B9B9B` | Placeholder text, disabled states |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `nilin-success` | `#7BA889` | Success states, positive feedback |
| `nilin-warning` | `#E8C4A8` | Warning states, attention needed |
| `nilin-error` | `#C88B8B` | Error states, destructive actions |

### Surfaces
| Token | Hex | Usage |
|-------|-----|-------|
| `nilin-surface` | `#FFFFFF` | Cards, elevated surfaces |
| `nilin-muted` | `#F8F6F4` | Disabled backgrounds, subtle sections |
| `nilin-border` | `#E8E4E0` | Borders, dividers |
| `nilin-overlay` | `rgba(45, 45, 45, 0.05)` | Subtle overlays |

### Legacy shadcn/ui HSL Variables
```css
--background: 40 20% 98%      /* ~#FDFBF9 */
--foreground: 0 0% 18%        /* ~#2D2D2D */
--primary: 12 48% 78%         /* ~#E8B4A8 */
--secondary: 20 40% 88%       /* ~#D4A89A */
--muted: 20 20% 95%           /* ~#F5F4F3 */
--accent: 20 40% 88%          /* ~#D4A89A */
--destructive: 0 30% 75%     /* ~#C88B8B */
--border: 20 15% 90%          /* ~#E8E4E0 */
--radius: 12px
```

## Typography

### Font Stack
- **Headings**: `Cormorant Garamond` — elegant serif with optical sizing
- **Body**: `Inter` — clean geometric sans for readability
- **Fallbacks**: `Georgia, serif` / `system-ui, sans-serif`

### Type Scale
| Element | Class | Size | Weight | Line Height |
|---------|-------|------|--------|------------|
| H1 | `text-4xl md:text-5xl lg:text-6xl` | 36/48/60px | 300 (light) | tight |
| H2 | `text-3xl md:text-4xl` | 30/36px | 400 | tight |
| H3 | `text-2xl md:text-3xl` | 24/30px | 400 | tight |
| H4 | `text-xl md:text-2xl` | 20/24px | 500 | normal |
| H5 | `text-lg md:text-xl` | 18/20px | 500 | normal |
| H6 | `text-base md:text-lg` | 16/18px | 600 | normal |
| Body | `text-base` | 16px | 400 | relaxed (1.7) |

### Heading Guidelines
- Letter-spacing: `-0.025em` on all headings
- Use `text-wrap: balance` on H1–H3 for even line lengths
- Display ceiling: `clamp()` max ≤ 6rem (~96px)

## Spacing

Uses Tailwind's default spacing scale with NILIN-specific additions:

### Custom Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `18` | 4.5rem (72px) | Large section gaps |
| `22` | 5.5rem (88px) | Hero section spacing |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `lg` | `var(--radius)` (12px) | Default for cards, buttons |
| `md` | 10px | Smaller components |
| `sm` | 8px | Inputs, badges |
| `xl` | 16px | Modal containers |
| `2xl` | 20px | Large cards |

### NILIN Custom Radii
| Class | Radius | Usage |
|-------|--------|-------|
| `rounded-nilin` | 12px | Standard NILIN rounded |
| `rounded-nilin-lg` | 16px | Large containers |
| `rounded-nilin-xl` | 24px | Hero elements |

## Shadows

### NILIN Signature Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `shadow-nilin-sm` | `0 2px 12px rgba(45, 45, 45, 0.04)` | Subtle elevation |
| `shadow-nilin` | `0 4px 20px rgba(45, 45, 45, 0.06)` | Default card shadow |
| `shadow-nilin-md` | `0 6px 24px rgba(45, 45, 45, 0.08)` | Medium elevation |
| `shadow-nilin-lg` | `0 8px 30px rgba(45, 45, 45, 0.1)` | Hover states, modals |
| `shadow-nilin-warm` | `0 4px 20px rgba(232, 180, 168, 0.12)` | Warm accent shadow |
| `shadow-nilin-warm-lg` | `0 8px 30px rgba(232, 180, 168, 0.18)` | Prominent warm glow |
| `shadow-nilin-glow` | `0 0 30px rgba(232, 180, 168, 0.2)` | Coral glow effect |

## Glass Effects

### NILIN Glass Classes
| Class | Effect |
|-------|--------|
| `glass-nilin` | `rgba(255, 255, 255, 0.6)` bg, 12px blur, subtle border |
| `glass-nilin-strong` | `rgba(253, 251, 249, 0.85)` bg, 20px blur, stronger border |
| `glass-nilin-dark` | `rgba(45, 45, 45, 0.15)` bg, 16px blur, for dark contexts |

### Legacy Glass Classes
| Class | Effect |
|-------|--------|
| `glass` | Frosted glass with 20px blur, white tint |
| `glass-dark` | Dark frosted glass for dark backgrounds |
| `glass-blur` | Pure glass with 24px blur + saturation |

## Components

### Button

**Variants:**
| Variant | Appearance | Usage |
|---------|------------|-------|
| `primary` | Coral bg, white text | Main CTAs |
| `secondary` | Transparent, coral border | Secondary actions |
| `ghost` | Transparent, coral text | Tertiary actions |
| `danger` | Error color bg | Destructive actions |
| `outline` | Transparent, coral border | Alternative secondary |

**Sizes:**
| Size | Padding | Text | Radius |
|------|---------|------|--------|
| `sm` | `px-3 py-1.5` | `text-xs` | `rounded-lg` |
| `md` | `px-4 py-2.5` | `text-sm` | `rounded-nilin` |
| `lg` | `px-6 py-3` | `text-base` | `rounded-nilin-lg` |

**States:**
- Hover: `-translate-y-0.5` lift + warm shadow
- Active: `scale-[0.98]` press effect
- Focus: 2px coral ring with 2px offset
- Loading: Spinner + disabled cursor
- Premium: `animate-nilin-glow` pulse effect

### Badge

**Variants:**
| Variant | Background | Text | Usage |
|---------|------------|------|-------|
| `default` | `bg-nilin-blush` | charcoal | Neutral status |
| `primary` | `bg-nilin-coral/15` | coral | Active/highlighted |
| `success` | `bg-nilin-success/15` | success | Positive states |
| `warning` | `bg-nilin-warning/20` | amber-700 | Caution |
| `error` | `bg-nilin-error/15` | error | Negative states |

**Sizes:** `sm` (compact), `md` (default)
**Features:** Optional dot indicator, pill shape

### Input

**Base:** `input-nilin` class with:
- White background
- 1px `nilin-border` border
- 8px border radius
- Focus: coral border + 3px coral ring

**Sizes:** `sm`, `md`, `lg` with corresponding padding
**Features:** Label, error state, helper text, prefix/suffix icons

### Card

**Standard Card:**
- White background
- 1px border (`nilin-border/50`)
- 12–16px border radius
- Hover: lift + shadow-nilin-lg

**Glass Card:**
- Semi-transparent white (`bg-white/60`)
- Backdrop blur
- Subtle border

**Service Card Variants:**
- `list`: Horizontal layout with 80px image
- `grid`: Vertical layout with aspect-[4/3] image
- `compact`: 144px horizontal card for carousels

## Animations

### NILIN Animations
| Name | Effect | Duration |
|------|--------|----------|
| `animate-nilin-in` | Fade + translateY(10px) | 400ms |
| `animate-nilin-scale` | Fade + scale(0.95→1) | 300ms |
| `animate-nilin-float` | Subtle Y oscillation | 3s infinite |
| `animate-nilin-glow` | Shadow pulse for CTAs | 2s infinite |

### Standard Animations
| Name | Effect | Duration |
|------|--------|----------|
| `fade-in` | Opacity 0→1 | 200ms |
| `slide-up` | Opacity + translateY | 400ms |
| `accordion-down/up` | Height animation | 200ms |
| `toast-slide-in` | Slide from right | 300ms |

### Hover Interactions
- Cards: `-translate-y-0.5` to `-translate-y-1` lift
- Buttons: `-translate-y-0.5` lift
- Images: `scale(1.05)` to `scale(1.1)` zoom
- Arrows: `translate-x-1` slide

### Reduced Motion
All animations respect `prefers-reduced-motion: reduce`:
- Motion animations disable
- Glass effects reduce opacity
- Spotlight orbits reduce to static gradient

## Layout

### Grid System
- Responsive grid: `repeat(auto-fit, minmax(280px, 1fr))`
- No breakpoint defaults — mobile-first
- Max container: 1400px with 2rem padding

### Z-Index Scale
| Level | Value | Usage |
|-------|-------|-------|
| Base | 0 | Default stacking |
| Dropdown | 10 | Dropdown menus |
| Sticky | 20 | Sticky headers |
| Modal backdrop | 30 | Modal overlays |
| Modal | 40 | Modal dialogs |
| Toast | 50 | Toast notifications |
| Tooltip | 60 | Tooltips |

## Iconography

**Library:** Lucide React
**Consistent sizing:**
- Inline icons: 16px (text-sm context)
- Button icons: 16px/20px based on button size
- Card icons: 20px
- Section icons: 24px

**Icon colors:**
- Default: `text-nilin-warmGray`
- Active: `text-nilin-coral`
- Success: `text-nilin-success`
- Error: `text-nilin-error`

## Scrollbars

### NILIN Branded Scrollbar
```css
.scrollbar-nilin {
  scrollbar-width: thin;
  scrollbar-color: #E8B4A8 #F5E6E0;
}
```

### Thin Scrollbar
```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(232, 180, 168, 0.4) transparent;
}
```

## Accessibility

### Focus States
- 2px coral ring with 2px offset
- `focus-visible` only (no focus on click)
- Ring color: `ring-nilin-coral`

### Color Contrast
- Body text on cream: ≥4.5:1 ✓
- Warm gray on cream: Check per usage
- Avoid muted gray placeholders without contrast boost

### Motion
- All animations optional via `prefers-reduced-motion`
- No layout-triggering animations
- Smooth scroll enabled globally
