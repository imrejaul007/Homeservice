# NILIN Visual Identity System

## Overview

NILIN is a home services marketplace with a **warm, luxurious, approachable** visual identity. Think: Apple meets luxury spa. Every visual element should feel clean, minimal, modern, premium, and easy to see while still conveying luxury and high-end quality.

This document defines the visual language that should be consistent across:
- UI/UX design (website, app)
- Photography (product shots, lifestyle images)
- Marketing (banners, campaigns, social media)
- Creative assets (icons, illustrations)
- AI-generated visuals

---

## Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Cream** | `#FDFBF9` | Primary background - warm white |
| **Blush** | `#F5E6E0` | Soft highlights, secondary backgrounds |
| **Peach** | `#FAE5E0` | Hover states, soft accents |
| **Rose** | `#D4A89A` | Accent elements, borders |
| **Coral** | `#E8B4A8` | Primary accent, CTAs, active states |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Charcoal** | `#2D2D2D` | Primary text, icons |
| **Warm Gray** | `#6B6B6B` | Secondary text |
| **Light Gray** | `#9B9B9B` | Tertiary text, placeholders |
| **Soft Gray** | `#B5B0AB` | Muted text, disabled states |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#7BA889` | Success states, positive actions |
| **Warning** | `#E8C4A8` | Warning states, caution |
| **Error** | `#C88B8B` | Error states, destructive actions |

---

## Typography

### Font Families

| Role | Font | Fallback |
|------|------|----------|
| **Display/Headings** | Cormorant Garamond | Georgia, serif |
| **Body/UI** | Inter | system-ui, sans-serif |

### Type Scale

- **Display**: 48-60px, light weight (300), tight tracking
- **H1**: 36px, medium weight (400)
- **H2**: 30px, regular weight (400)
- **H3**: 24px, regular weight (400)
- **Body**: 16px, regular weight (400)
- **Small**: 14px, regular weight (400)
- **Caption**: 12px, regular weight (400)

---

## Lighting & Photography

### Studio Lighting Guidelines

For all NILIN photography (products, lifestyle, campaigns):

| Element | Guideline |
|---------|----------|
| **Temperature** | Warm (3200K-4500K) - avoid cool/blue tones |
| **Quality** | Soft diffused light - no harsh shadows |
| **Shadows** | Gentle, soft-edged shadows - never hard |
| **Highlights** | Subtle rim lighting for depth |
| **Contrast** | Low to medium contrast - keep it soft |

### Photography Style

- **Subject**: Clean, minimal product/service presentation
- **Background**: Cream or warm white surfaces
- **Props**: Organic textures (linen, terry cloth, natural materials)
- **Mood**: Calm, sophisticated, aspirational
- **Composition**: Rule of thirds or centered, generous negative space

---

## UI/UX Guidelines

### Spacing System

Generous whitespace is essential for the luxury feel:

| Name | Value | Usage |
|------|-------|-------|
| **xs** | 4px | Tight spacing, inline elements |
| **sm** | 8px | Related elements |
| **md** | 16px | Default spacing |
| **lg** | 24px | Section spacing |
| **xl** | 32px | Major section breaks |
| **2xl** | 48px | Page section spacing |

### Border Radius

Soft, rounded corners convey approachability:

| Name | Value | Usage |
|------|-------|-------|
| **sm** | 6px | Small elements, inputs |
| **md** | 10px | Cards, buttons |
| **lg** | 12px | Modals, large cards |
| **xl** | 16px | Feature cards |
| **2xl** | 24px | Large containers |

### Shadows

Shadows should be warm-tinted and soft:

```css
/* Base shadow - subtle depth */
box-shadow: 0 4px 20px rgba(45, 45, 45, 0.06);

/* Warm shadow - accent glow */
box-shadow: 0 4px 20px rgba(232, 180, 168, 0.12);

/* Ambient - diffused lighting effect */
box-shadow: 0 2px 16px rgba(45, 45, 45, 0.05);

/* Glow - premium elements */
box-shadow: 0 0 30px rgba(232, 180, 168, 0.2);
```

### Glass Effects

For premium UI elements (navigation, cards, modals):

```css
/* Light glass - cards */
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgba(232, 228, 224, 0.5);

/* Strong glass - navigation */
background: rgba(253, 251, 249, 0.85);
backdrop-filter: blur(20px);
border: 1px solid rgba(232, 228, 224, 0.7);
```

---

## Mood Keywords

These words should guide all visual decisions:

**Core Identity:**
- Luxury
- Minimal
- Warm
- Approachable
- Sophisticated
- Calm

**Visual Attributes:**
- Clean
- Soft
- Premium
- Modern
- Refined
- Elegant

**What NILIN Is NOT:**
- Cold
- Clinical
- Harsh
- Generic
- Over-designed
- Cheap-looking

---

## AI Visual Generation

### Prompt Template

Use this template for generating NILIN-consistent visuals:

```
[Subject description] in NILIN brand aesthetic,
soft diffused studio lighting, warm color temperature (3200K-4500K),
minimalist composition, generous whitespace, cream background,
professional photography, high-end luxury beauty brand,
8K resolution, photorealistic, soft shadows
```

### Negative Prompts

```
harsh lighting, cold tones, blue tint, high contrast,
busy background, cluttered composition, amateur photography,
low quality, distorted, blurry, oversaturated
```

### Recommended Tools

| Tool | Use Case |
|------|----------|
| **Midjourney** | Quick concept generation |
| **Stable Diffusion + LoRA** | Consistent brand assets |
| **DALL-E 3** | Product mockups |
| **ComfyUI + IPAdapter** | Style transfer from reference images |

### LoRA Training (Long-term)

For consistent AI-generated visuals:

1. Collect 15-20 curated NILIN-style reference images
2. Train custom LoRA using SDXL
3. Use IPAdapter for style transfer
4. Maintain reference image library

### Color Injection in Prompts

To ensure color accuracy in AI generations:

```
[Subject] with colors: #E8B4A8 (coral), #FDFBF9 (cream), #2D2D2D (charcoal)
Warm peachy skin tones, blush pink accents
```

---

## Visual Examples

### Reference Aesthetic (BLONDIES Campaign)

The BLONDIES campaign exemplifies NILIN's visual direction:
- Warm cream/beige backgrounds (#F5F0EB, #EDE5DD)
- Soft diffused studio lighting
- Clean minimalist compositions
- Organic textures (terry cloth, linen)
- Calm, sophisticated mood

### Do This:
- ✅ Warm cream backgrounds
- ✅ Soft shadows with warm undertone
- ✅ Generous whitespace
- ✅ Clean, minimal layouts
- ✅ Soft, rounded corners
- ✅ Glassmorphism effects

### Not This:
- ❌ Pure white backgrounds (#FFFFFF)
- ❌ Harsh shadows
- ❌ Cluttered compositions
- ❌ Sharp, aggressive corners
- ❌ Flat, untextured surfaces
- ❌ High contrast, cold tones

---

## Implementation

### Frontend Usage

```tsx
import { tokens } from '@/theme/tokens';

// Using CSS variables
const style = {
  backgroundColor: tokens.colors.cream,
  boxShadow: tokens.shadows.warm,
  borderRadius: tokens.borderRadius.lg,
};

// Using glass effects
const glassCard = {
  background: tokens.glass.light.bg,
  backdropFilter: tokens.glass.light.backdrop,
  border: `1px solid ${tokens.glass.light.border}`,
};
```

### CSS Utilities

Available in `index.css`:
- `.glass` - Glassmorphism card
- `.glass-btn` - Glass button
- `.glass-dark` - Glass for dark backgrounds
- `.card-hover` - Lift on hover
- `.animate-accordion-*` - Smooth accordions

---

## Resources

- [Design Tokens Overview](https://medium.com)
- [ComfyUI Workflows](https://comfyworkflows.com)
- [Stable Diffusion Documentation](https://stable-diffusion-art.com)
- [LoRA Training Guide](https://stable-diffusion-art.com/lora-training)

---

## Version

- **Version**: 1.0
- **Last Updated**: 2026-05-12
- **Status**: Active
- **Owner**: NILIN Design Team
