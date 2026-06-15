# NILIN Home Page Redesign - Implementation Plan

## Goal
Transform the NILIN home page to match Seed's aesthetic with a light theme:
- **Light theme** (cream/off-white base)
- **Hero with cycling background images** (3 images, auto-rotating like Seed)
- **Frosted glass buttons with texture** (light-mode friendly)
- **Clean, minimalist structure** similar to Seed
- **Keep the search bar** prominently featured
- **Use existing placeholder images** from dashboard

---

## Current State

### Hero Section (lines 148-282 in HomePage.tsx)
- Dark gradient overlay (`from-nilin-charcoal/85`)
- White text on dark
- Dark glass backgrounds
- Floating images on right side
- Search bar at bottom of hero content

### Seed Reference
- Light cream background
- White frosted glass navigation
- Lime-green frosted glass buttons with texture
- Full-width background images that cycle
- Clean typography with good contrast
- Simple, minimal structure

---

## Implementation

### Phase 1: CSS Updates

**File: `frontend/src/index.css`**

Add light-theme frosted glass button styles after line 200:

```css
/* Light theme frosted glass button - Seed inspired */
.btn-frosted-light {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow:
    0 4px 20px rgba(45, 45, 45, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  transition: all 0.3s ease;
}

.btn-frosted-light:hover {
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 6px 30px rgba(45, 45, 45, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  transform: translateY(-2px);
}

/* Light glass for dark elements on light bg */
.glass-light {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 20px rgba(45, 45, 45, 0.05);
}
```

### Phase 2: Hero Section Redesign

**File: `frontend/src/pages/HomePage.tsx`**

Transform the hero section (lines 148-282) from dark to light theme:

#### 2.1 Change Background Overlay
**Current (line 161):**
```tsx
<div className="absolute inset-0 bg-gradient-to-r from-nilin-charcoal/85 via-nilin-charcoal/50 to-transparent" />
```

**Change to light overlay:**
```tsx
<div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/30 to-white/20" />
```

#### 2.2 Change Top Vignette
**Current (line 150):**
```tsx
<div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/55 via-black/25 to-transparent" />
```

**Change to subtle light vignette:**
```tsx
<div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/90 via-white/40 to-transparent" />
```

#### 2.3 Update Badge
**Current (lines 169-172):**
```tsx
<div className="inline-flex items-center gap-2 px-4 py-2 glass-nilin rounded-full mb-6">
  <Sparkles className="w-4 h-4 text-nilin-coral" />
  <span className="text-sm text-nilin-charcoal">{HERO_SLIDES[currentSlide].badge}</span>
</div>
```

**Change to light frosted style:**
```tsx
<div className="inline-flex items-center gap-2 px-4 py-2 glass-light rounded-full mb-6">
  <Sparkles className="w-4 h-4 text-nilin-coral" />
  <span className="text-sm text-nilin-charcoal font-medium">{HERO_SLIDES[currentSlide].badge}</span>
</div>
```

#### 2.4 Update Headline
**Current (lines 174-176):**
```tsx
<h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-white mb-4">
```

**Change to dark text:**
```tsx
<h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-nilin-charcoal mb-4">
```

#### 2.5 Update Subtitle
**Current (lines 177-179):**
```tsx
<p className="text-xl text-white/80 mb-8 max-w-lg">
```

**Change to dark text:**
```tsx
<p className="text-xl text-nilin-warm-gray mb-8 max-w-lg">
```

#### 2.6 Update CTA Buttons
**Primary Button (lines 182-188):**
**Current:**
```tsx
<button className="btn-nilin inline-flex items-center gap-2 px-8 py-4 rounded-nilin text-white">
```

**Change to frosted light style:**
```tsx
<button className="btn-frosted-light inline-flex items-center gap-2 px-8 py-4 rounded-nilin text-nilin-charcoal font-medium">
```

**Secondary Button (lines 189-194):**
**Current:**
```tsx
<button className="glass-nilin inline-flex items-center gap-2 px-8 py-4 rounded-nilin text-white">
```

**Change to subtle outline:**
```tsx
<button className="glass-light inline-flex items-center gap-2 px-8 py-4 rounded-nilin text-nilin-charcoal font-medium hover:border-nilin-coral/30">
```

#### 2.7 Update Social Proof
**Avatar section (lines 224-227):**
**Current:**
```tsx
<div className="text-sm text-white">
  <p className="font-medium">20,510+</p>
  <p className="text-white/70">Happy Clients</p>
</div>
```

**Change to dark text:**
```tsx
<div className="text-sm text-nilin-charcoal">
  <p className="font-medium">20,510+</p>
  <p className="text-nilin-warm-gray">Happy Clients</p>
</div>
```

**Stars section (lines 229-234):**
**Current:**
```tsx
<span className="ml-1 text-white font-medium">4.9</span>
```

**Change to dark text:**
```tsx
<span className="ml-1 text-nilin-charcoal font-medium">4.9</span>
```

#### 2.8 Remove/Update Floating Images
The floating images on the right (lines 249-268) are very dark-themed. For Seed's clean aesthetic, options are:
1. Remove them entirely for a cleaner look
2. Update styling to be more subtle/light

**Recommended: Remove floating images section** (lines 249-268) for cleaner Seed-like aesthetic.

#### 2.9 Update Slide Indicators
**Current (lines 271-281):**
```tsx
<div className="h-1.5 rounded-nilin transition-all hover-lift bg-white/50 hover:bg-white/80" />
```

**Change to dark indicators:**
```tsx
<div className="h-1.5 rounded-nilin transition-all hover-lift bg-nilin-charcoal/30 hover:bg-nilin-charcoal/50" />
```

### Phase 3: Navigation Update

**File: `frontend/src/components/layout/NavigationHeader.tsx`**

The current header may need updates for light theme. Check if `variant="hero"` uses dark styling and adjust.

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/index.css` | Add `.btn-frosted-light`, `.glass-light` styles |
| `frontend/src/pages/HomePage.tsx` | Transform hero from dark to light theme |
| `frontend/src/components/layout/NavigationHeader.tsx` | Check/adjust for light hero compatibility |

---

## Design Tokens Summary

| Element | Before | After |
|---------|--------|-------|
| Hero BG | Dark charcoal overlay | Light white/cream overlay |
| Headlines | White text | Charcoal text |
| Body text | White/80% | Warm gray |
| Primary CTA | Coral (#E8B4A8) | Frosted white glass |
| Secondary CTA | Dark glass | Light glass |
| Badge | Glass with coral icon | Light glass with coral icon |
| Indicators | White/50% | Charcoal/30% |
| Floating images | Dark styled | Removed for clean look |

---

## Testing Checklist

- [ ] Hero images cycle smoothly (existing functionality)
- [ ] Text readable on all 3 background images
- [ ] Search bar prominent and functional
- [ ] Buttons have frosted glass effect
- [ ] Social proof section displays correctly
- [ ] Navigation works with light hero
- [ ] Mobile responsive
- [ ] No dark elements in hero (except necessary shadows)

---

## Risk: LOW
- CSS classes are additions only
- Hero changes are visual styling, not functional
- Search bar and navigation logic unchanged
