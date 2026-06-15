# Implementation Log — June 13, 2026

## Project: Homeservice Platform — Homepage UI Enhancements & Global Header Fix

---

## Executive Summary

This log documents frontend work performed on **June 13, 2026** to upgrade the NILIN homepage with interactive card experiences (Aceternity-style 3D cards, magazine-style spotlight cards, draggable experience stack) and to fix a **global navigation header regression** that affected every non-homepage route after the homepage hero scroll animation was introduced.

**Primary goals:**

1. Add premium interactive card UI to homepage sections (Popular Services, Curated Experiences, Beauty Studio, The NILIN Experience).
2. Preserve the homepage hero header scroll morph animation without leaking those styles to other pages.
3. Restore a full-width, correctly aligned header on login, customer dashboard, provider pages, and all other routes.

**Build status:** `npm run type-check` passes in `frontend/`.

**Scope:** Frontend only — no backend or database changes in this session.

---

## Table of Contents

1. [Infrastructure & Dependencies](#1-infrastructure--dependencies)
2. [Popular Services — 3D Card Carousel](#2-popular-services--3d-card-carousel)
3. [Curated Experiences (OfferBanner)](#3-curated-experiences-offerbanner)
4. [Beauty Studio (CategorySpotlight)](#4-beauty-studio-categoryspotlight)
5. [The NILIN Experience — Draggable Stack](#5-the-nilin-experience--draggable-stack)
6. [Navigation Header — Global Fix](#6-navigation-header--global-fix)
7. [Bug Fixes & Technical Notes](#7-bug-fixes--technical-notes)
8. [Files Created / Modified](#8-files-created--modified)
9. [Testing Checklist](#9-testing-checklist)
10. [Known Limitations & Follow-ups](#10-known-limitations--follow-ups)

---

## 1. Infrastructure & Dependencies

### shadcn/ui initialization

Initialized shadcn in the frontend project to support Aceternity registry components:

- **Config file:** `frontend/components.json`
- **Style:** `base-nova`
- **Aliases:** `@/components`, `@/lib/utils`, `@/components/ui`
- **Registry:** `@aceternity` → `https://ui.aceternity.com/registry/{name}.json`

### Packages installed

| Package | Purpose |
|---------|---------|
| `@aceternity/3d-card` | 3D tilt card primitives (CardContainer, CardBody, CardItem) |
| `@aceternity/3d-card-demo` | Reference/demo source |
| `@aceternity/draggable-card` | Draggable card primitive (installed; custom implementation used for experiences) |

### Shared UI primitives added

| File | Description |
|------|-------------|
| `frontend/src/components/ui/3d-card.tsx` | Aceternity 3D card source — mouse-tracking tilt via `rotateY` / `rotateX` + `translateZ` |
| `frontend/src/components/ui/draggable-card.tsx` | Aceternity draggable card — import fixed to use `framer-motion` (see §7) |

**`CardBody` extension:** Spread `...rest` onto the outer div so consumers can pass `onClick` for navigation without wrapping in extra elements.

---

## 2. Popular Services — 3D Card Carousel

### Location

- **Page:** `frontend/src/pages/HomePage.tsx` — inline carousel after Ongoing Bookings + category pills
- **Component:** `frontend/src/components/home/PopularServiceCard.tsx` (new)

### What changed

Replaced flat div-based service cards with Aceternity **CardContainer / CardBody / CardItem** structure while preserving all existing data bindings (image, category, price, rating, navigation).

### Visual design

- **Category-aware gradients** — `CATEGORY_GRADIENTS` map (hair, makeup, nails, skin, spa, massage, default) drives card background, image overlay, and shadow tint.
- **Stacked depth layer** — a `CardItem` at `translateZ={-60}` sits behind the main card (`translate-x-3 translate-y-4 scale-[0.96]`) for a “card behind card” pop effect.
- **Dark text on light theme** — `text-nilin-charcoal`, warm gray subtitles, coral gradient price, charcoal “Book now →” CTA.
- **Featured badge** — first two carousel items show a coral gradient “Featured” pill with Sparkles icon.
- **Rating pill** — top-right on image with amber star + numeric rating.

### Card dimensions

- Width: `300px` (mobile) → `340px` (sm+)
- Image height: `h-64`
- Larger CTA: `px-6 py-3 rounded-xl`

### Carousel layout (HomePage)

- Horizontal scroll container with `pt-6 pb-12 px-4` to prevent 3D hover tilt from clipping at top/bottom.
- Left/right chevron buttons for smooth scroll (`scrollBy ±360px`).
- `scrollbar-hide` for clean horizontal scroll.

### Interaction

- Click on `CardBody` navigates to service detail (handler passed from HomePage).
- Mouse hover triggers 3D tilt on `CardContainer` (perspective transform on mouse move).

---

## 3. Curated Experiences (OfferBanner)

### Location

- **Component:** `frontend/src/components/home/OfferBanner.tsx`
- **Homepage section title:** “Curated Experiences” (exclusive offers carousel)

> **Note:** User screenshot referenced this section (not Popular Services). Offers are loaded via `offerService`, not Sanity CMS.

### What changed

- Integrated **3D card stack** (same Aceternity pattern as Popular Services).
- Enlarged cards and typography for editorial feel.
- Switched text from white-on-dark to **dark text on warm gradient cards**.
- Reduced side padding on section container for wider carousel feel.
- Enlarged **“Claim Experience”** button (`py-5 sm:py-6`, `text-lg`, full width).

### Card specs

| Property | Value |
|----------|-------|
| Width | `460px` → `500px` (sm+) |
| Min height | `460px` |
| Border radius | `rounded-3xl` |
| Back layer | `translateZ={-55}`, offset shadow stack |
| Gradients | 6 premium palettes (rose gold, champagne, nude, blush, ivory, lavender) |

### Typography & content

- Title: `text-3xl font-serif text-nilin-charcoal`
- Subtitle/body: `text-nilin-charcoal/80`
- Badge row: display badge + discount pill with Gift icon
- Countdown timer when `validUntil` is set (pulse when expiring within 3 days)
- Promo code display at bottom (`font-mono` on white/70 pill)
- Staggered entrance animation (`opacity` + `translateY`, 120ms delay per index)

### Section layout

- Background: `#F6EFE8` warm cream
- Container: `max-w-[100rem] mx-auto` with reduced horizontal padding (`px-2 sm:px-3 lg:px-4`)
- Header: large serif “Curated Experiences” + “View all offers” link
- Carousel: horizontal scroll with nav arrows below when scrollable (same pattern as CategorySpotlight)

### Preserved behavior

- Offer claim flow (auth check, confirmation modal, `executeClaim`)
- Claimed / fully redeemed / claiming states on CTA
- Price localization via `usePriceConversion` + `localizeAedAmountsInText`
- Focus sync for claim status (`syncClaimedStatus` on window focus)

---

## 4. Beauty Studio (CategorySpotlight)

### Location

- **Component:** `frontend/src/components/home/CategorySpotlight.tsx` (substantial rewrite)
- **Homepage usage:** `<CategorySpotlight limit={10} />` (increased from default 6)

### What changed

Replaced a simpler horizontal card row with a **magazine-style spotlight** using Framer Motion (not Aceternity 3D — intentional design choice for editorial portrait cards).

### Visual design

- **Warm section background** — gradient `#F6EFE8` → blush → cream with soft blurred orbs.
- **Large portrait cards** — `320px` → `420px` wide, `aspect-[3/4]` image frame.
- **Orbit border effect** — CSS class `spotlight-orbit-border` (see `frontend/src/index.css`) with animated conic-gradient “light orbit” on hover/active.
- **Magazine hover** — card lifts (`y: -14`), image parallax on mouse move, subtle 3D perspective tilt on inner card.
- **Dark text** — charcoal titles, warm gray subtitles, coral accent labels (“Studio Pick”).
- **Removed** “View All Services” footer link (per design request).

### Data

- Fetches featured packages via `customerDashboardApi.getFeaturedPackages({ limit, category })`.
- Falls back to `getPackages({ sortBy: 'popularity' })` if no featured results.
- Localized pricing via `usePriceConversion`.

### Navigation UX

- Scroll arrows **below cards only when scrollable** (`canScroll` derived from `scrollWidth > clientWidth + 8`).
- Scroll step: `±440px`.
- Card click navigates to `/packages/:id`.

### CSS: spotlight orbit border

Added to `frontend/src/index.css`:

```css
.spotlight-orbit-border       /* wrapper with 2.5px padding, isolation */
.spotlight-orbit-border::before / ::after   /* dual conic-gradient layers, spin animation */
.spotlight-orbit-border.is-orbit-active     /* boosted opacity on hover */
.spotlight-orbit-border-inner               /* inner content layer above gradient */
@keyframes spotlight-orbit-spin             /* 3.8s linear infinite */
@media (prefers-reduced-motion: reduce)     /* disables spin, static opacity */
```

---

## 5. The NILIN Experience — Draggable Stack

### Location

- **New component:** `frontend/src/components/experience/ExperienceDraggableStack.tsx`
- **Updated section:** `frontend/src/components/experience/ExperienceSection.tsx`

### What changed

Replaced the previous static grid layout with a **scattered, draggable card canvas** inspired by Aceternity draggable cards, implemented with a **custom bounded drag** solution (not the generic `DraggableCardBody`).

### Why custom implementation

The generic Aceternity `DraggableCardBody` used **window-wide drag constraints**, causing cards to escape the section canvas. `ExperienceDraggableCard` uses:

- `dragConstraints={containerRef}` — cards stay inside the rounded canvas
- `dragElastic={0.42}` — rubber-band feel at edges
- `dragMomentum={false}` — predictable release
- `snapToHome()` on drag end — spring animation back to original scatter position
- `onTap` opens `ExperienceDetailModal`

### Card layout

- **10 preset scatter positions** in `CARD_LAYOUTS` (absolute positioning with rotation + z-index).
- Card size: `300px` → `400px` (responsive).
- Canvas: `min-h-[700px]` → `820px`, `rounded-[2rem]`, glass background, perspective `2000px`.
- Background watermark text: section subtitle centered at low opacity.
- Hint text: “Drag to play · Tap a card to open the full story”.

### Card content

- Hero image with Featured badge + multi-image count
- Star rating + numeric score
- Title (serif), description (line-clamp-2)
- User avatar / name / linked service name
- “Tap to read full story” affordance

### ExperienceSection updates

- Default `limit = 10`
- Tries `experienceApi.getFeaturedExperiences()` first, falls back to `getExperiences({ limit })`
- Loading state: `DraggableSkeleton` (scattered pulse placeholders)
- Renders `<ExperienceDraggableStack experiences={...} subtitle={...} />` instead of grid
- Empty/error states preserved with CTAs to book or write experience

### Data source

Experiences load from **`experienceApi`** (backend REST), not Sanity CMS.

---

## 6. Navigation Header — Global Fix

### Problem (reported on `/customer/dashboard`)

After adding the homepage hero scroll animation to `NavigationHeader`, **all other pages** exhibited:

- Header appearing as a **narrow white block on the left** (~60% viewport width)
- **Dark hero/content bleeding through** on the right side of the header row
- Category tabs misaligned with the header background
- Search/account controls visually disconnected from full-width layout

**Root cause:** Homepage hero animation styles (fixed positioning, animated width/max-width, centered pill morph, logo scaling) were applied to the **default** header variant used on every other page.

### Solution overview

Introduced an explicit **`variant` prop** on `NavigationHeader`:

| Variant | Used on | Behavior |
|---------|---------|----------|
| `'hero'` | HomePage only | Fixed overlay, transparent→solid scroll morph, pill width animation |
| `'default'` | All other pages | Sticky full-width bar, no hero morph, stable layout |

### Default variant changes (`NavigationHeader.tsx`)

| Before (broken) | After (fixed) |
|-----------------|---------------|
| `position: fixed` | `position: sticky; top: 0` |
| `maxWidth: 1400px` on `<header>` | `width: 100%; maxWidth: 100%` on `<header>` |
| Content + background same width | Background full-width; inner row `max-w-[1400px] mx-auto` |
| Fixed `height: 64px` on header | `minHeight: 64px` on inner row only (category tabs add second row naturally) |
| Hero `isFloating` on scroll | `isFloating` **only when** `variant === 'hero'` |
| Hero logo/text scale on all pages | Scale animations **only on hero variant** |

### Hero variant (unchanged intent)

HomePage continues to use:

```tsx
<NavigationHeader variant="hero" showSearch={false} showCategoryTabs={false} />
```

Hero section retains top padding (`pt-24 md:pt-28`) to clear the fixed overlay header.

### Auth pages — simplified header

Login and registration pages now use a compact header without search or category tabs:

```tsx
<NavigationHeader showSearch={false} showCategoryTabs={false} />
```

**Files updated:**

- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/CustomerRegistration.tsx`
- `frontend/src/components/auth/ProviderRegistration.tsx`

### All other pages

No per-page changes required — any page using default `<NavigationHeader />` automatically receives the fixed layout. This includes:

- Customer dashboard, bookings, profile, messages
- Provider dashboard, analytics, calendar, earnings
- Search, service detail, booking wizards
- Static pages (About, Privacy, Help, etc.)

---

## 7. Bug Fixes & Technical Notes

### `motion/react` import failure

**File:** `frontend/src/components/ui/draggable-card.tsx`

**Issue:** Aceternity registry template imported from `motion/react`, which is not installed in this project.

**Fix:** Changed import to `framer-motion` (the package already used elsewhere in the codebase).

### Draggable cards escaping canvas

**Issue:** Generic `DraggableCardBody` constraints referenced the window, not the section container.

**Fix:** Built `ExperienceDraggableCard` in `ExperienceDraggableStack.tsx` with `dragConstraints={containerRef}` and snap-back spring on release.

### Category tabs hidden after scroll on non-home pages

**Issue:** `isFloating` was `true` on default pages after `scrollY > 10`, hiding category tabs.

**Fix:** `const isFloating = isHeroVariant && scrollProgress > 0.1;`

### Invalid Tailwind class

Removed `bg-white/98` (non-standard) from duplicate category tab wrappers; simplified to single `{showCategoryTabs && !isFloating && <CategoryTabs />}` render.

### TypeScript

`npm run type-check` in `frontend/` completes with exit code 0 after all changes.

---

## 8. Files Created / Modified

### Created

| File | Description |
|------|-------------|
| `frontend/src/components/home/PopularServiceCard.tsx` | 3D popular service card |
| `frontend/src/components/experience/ExperienceDraggableStack.tsx` | Bounded draggable experience canvas |
| `frontend/src/components/ui/3d-card.tsx` | Aceternity 3D card primitives |
| `frontend/components.json` | shadcn config with Aceternity registry |

### Modified (primary)

| File | Changes |
|------|---------|
| `frontend/src/pages/HomePage.tsx` | PopularServiceCard integration, carousel padding, CategorySpotlight `limit={10}`, hero header variant |
| `frontend/src/components/home/OfferBanner.tsx` | 3D cards, larger layout, dark text, reduced padding |
| `frontend/src/components/home/CategorySpotlight.tsx` | Magazine cards, orbit border, framer-motion hover, scroll arrows |
| `frontend/src/components/experience/ExperienceSection.tsx` | Draggable stack instead of grid |
| `frontend/src/components/layout/NavigationHeader.tsx` | `variant` prop, default sticky full-width fix, hero-only animations |
| `frontend/src/index.css` | `.spotlight-orbit-border` animation utilities |
| `frontend/src/components/ui/draggable-card.tsx` | `framer-motion` import fix |
| `frontend/src/components/auth/LoginForm.tsx` | Simplified header props |
| `frontend/src/components/auth/CustomerRegistration.tsx` | Simplified header props |
| `frontend/src/components/auth/ProviderRegistration.tsx` | Simplified header props |

---

## 9. Testing Checklist

### Homepage (`/`)

- [ ] Hero header starts transparent over carousel, morphs to solid pill on scroll
- [ ] Popular Services carousel scrolls horizontally; 3D tilt on hover; click opens service
- [ ] Curated Experiences cards show dark text, stacked depth, Claim Experience works
- [ ] Beauty Studio shows 10 packages, orbit border on hover, arrows when scrollable
- [ ] NILIN Experience cards drag within canvas, snap back, tap opens modal

### Global header (non-home routes)

- [ ] `/customer/dashboard` — full-width white header + category tabs; dark welcome strip below (no bleed-through)
- [ ] `/login` — compact header (no search, no category tabs)
- [ ] `/register/customer` and `/register/provider` — same compact header
- [ ] `/search`, `/provider/*` — full header with search + category tabs aligned
- [ ] Scroll on dashboard — category tabs **remain visible** (not hidden)

### Regression

- [ ] Mobile header menu and search overlay still work
- [ ] Notification bell and account dropdown functional
- [ ] `prefers-reduced-motion` disables orbit border spin

---

## 10. Known Limitations & Follow-ups

1. **Dashboard hero strip** — The dark welcome banner on `CustomerDashboard` is intentional page content below the header, not part of the nav. With sticky header, it should no longer overlap; verify on narrow viewports.
2. **Provider/admin dashboards** — Use default header; no custom variant. Category tabs may be optional on dense dashboard UIs (could add `showCategoryTabs={false}` per route in a future pass).
3. **3D card performance** — Many simultaneous 3D cards in carousels may impact low-end mobile GPUs; monitor if jank is reported.
4. **Experience data** — Featured experiences depend on backend `experienceApi`; empty state shows when no records exist.
5. **No E2E tests added** — Manual verification recommended for hover/drag interactions.

---

## Appendix: NavigationHeader API

```tsx
interface NavigationHeaderProps {
  showSearch?: boolean;        // default: true
  onSearch?: (query: string) => void;
  showCategoryTabs?: boolean;  // default: true
  variant?: 'default' | 'hero'; // default: 'default'
}
```

**Recommended usage:**

```tsx
// Homepage only
<NavigationHeader variant="hero" showSearch={false} showCategoryTabs={false} />

// Auth pages
<NavigationHeader showSearch={false} showCategoryTabs={false} />

// Everything else
<NavigationHeader />
```

---

*End of implementation log — June 13, 2026*

---

## Supplement — Homepage Redesign (Seed-Inspired UI)

### Overview

Transformed the NILIN homepage to match Seed.com's elegant, light-themed aesthetic while maintaining NILIN's luxury beauty brand identity.

### Design Goals

- **Light theme** (cream/off-white base, not dark)
- **Hero with cycling background images** (3 images, auto-rotating like Seed)
- **Frosted glass buttons with texture** (light-mode friendly)
- **Clean, minimalist structure** similar to Seed
- **Keep the search bar** prominently featured
- **Use existing placeholder images** from dashboard

---

### 1. Scroll-Morphing Navigation Header

**Location:** `frontend/src/components/layout/NavigationHeader.tsx`

#### Concept

Transformed the header into a premium scroll-reactive navbar inspired by Superpower.com, Linear, Stripe, and Vercel.

#### States

**State 1: Hero State (Page Top)**
- Header feels integrated into hero section
- Background transparent
- No shadow, no border
- Large breathing room
- Logo centered
- Actions aligned right

**State 2: Floating State (After Scroll ~80px)**
- Smooth morph into floating glass capsule
- Width shrinks to 90% centered
- Border radius animates to pill shape
- Background opacity increases
- Shadow deepens
- Backdrop blur increases
- Position floats 16px from top

#### Key Implementation Details

```typescript
// Scroll animation constants
const SCROLL_START = 0;
const SCROLL_END = 80;

// Smooth scroll progress with requestAnimationFrame
useEffect(() => {
  let ticking = false;
  const updateScrollProgress = () => {
    const scrollY = window.scrollY;
    const rawProgress = (scrollY - SCROLL_START) / (SCROLL_END - SCROLL_START);
    const progress = Math.max(0, Math.min(1, rawProgress));
    setScrollProgress(progress);
    ticking = false;
  };
  // ... scroll listener with requestAnimationFrame
}, [isHeroVariant]);

// Dynamic style interpolation
const navWidth = isHeroVariant ? `${100 - (easedProgress * 10)}%` : '100%';
const navBorderRadius = isHeroVariant ? `${easedProgress * 9999}px` : '0px';
const navBackground = isHeroVariant
  ? `rgba(255, 255, 255, ${0.3 + (easedProgress * 0.55)})`
  : 'rgba(255, 255, 255, 0.95)';
```

#### Size Scaling

- **Navbar height**: 64px → 72px when scrolling
- **NILIN logo**: Scales with `scaleFactor`
- **Text sizes**: Larger at top, scale slightly when scrolling
- **Icons/buttons**: Scale up when floating

#### Account Button

- Merges seamlessly with navbar (rounded left edge)
- Background blends with floating navbar
- Larger avatar and text
- Hover effects with lift

---

### 2. Hero Section Redesign

**Location:** `frontend/src/pages/HomePage.tsx`

#### Changes Made

**Background**
- Height increased: `h-[85vh]` → `h-[100vh]`
- Padding top for navbar clearance: `pt-20 md:pt-24` → `pt-24 md:pt-28`

**Top Vignette**
Changed from dark to light overlay:
```tsx
// Before (dark)
<div className="absolute top-0 h-32 bg-gradient-to-b from-black/55 via-black/25 to-transparent" />

// After (light)
<div className="absolute top-0 h-32 bg-gradient-to-b from-white/90 via-white/40 to-transparent" />
```

**Background Slides Overlay**
```tsx
// Light gradient overlay for readability
<div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/30 to-white/10" />
```

**Headline**
- Size: `text-5xl md:text-6xl lg:text-7xl`
- Color: `text-white` → `text-nilin-charcoal`
- Shadow: `drop-shadow-lg` for depth
- `whitespace-nowrap` to keep on one line

**CTA Buttons**
```tsx
// Primary Button - Frosted glass
<button className="btn-frosted-light text-nilin-charcoal font-medium">

// Secondary Button
<button className="glass-light text-nilin-charcoal font-medium">
```

**Floating Images**
- Removed for cleaner Seed-like aesthetic

#### New CSS Classes

Added to `frontend/src/index.css`:

```css
/* Light frosted glass button - Seed inspired */
.btn-frosted-light {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 20px rgba(45, 45, 45, 0.08);
  transition: all 0.3s ease;
}

.btn-frosted-light:hover {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 30px rgba(45, 45, 45, 0.12);
  transform: translateY(-2px);
}

.glass-light {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 20px rgba(45, 45, 45, 0.05);
}
```

---

### 3. Trending Searches Section

**Location:** `frontend/src/components/search/TrendingSearches.tsx`

#### Overview

Transformed from basic pill tags to a modern, glassy design matching the curated aesthetic.

#### Design

- Badge: "Hot right now" with TrendingUp icon
- Title: "Trending searches"
- Glassy pill badges with backdrop blur
- Number badges with coral accent
- Emoji icons
- Arrow slides in on hover

#### Key Code

```tsx
{/* Glassy Pill */}
<button className={cn(
  'group flex items-center gap-3 pl-1 pr-5 py-2 rounded-full',
  'bg-white/70 backdrop-blur-md',
  'border border-white/80',
  'shadow-sm hover:shadow-lg',
  'hover:-translate-y-1'
)}>
  <span className="w-9 h-9 rounded-full bg-nilin-coral/20 text-nilin-coral">
    {index + 1}
  </span>
  <span className="text-xl">{item.emoji}</span>
  <span className="text-sm">{item.term}</span>
  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
</button>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | 'default' \| 'hero' \| 'minimal' \| 'modern' | 'modern' | Style variant |
| title | string | 'Trending searches' | Section title |
| limit | number | 8 | Max items to show |
| showViewAll | boolean | false | Show "View all" button |

---

### 4. Category Cards Section

**Location:** `frontend/src/components/home/CategoryCards.tsx`

#### Overview

Redesigned with staggered animations, premium hover effects, and modern button styling.

#### Changes

**Header**
- Title: `text-4xl md:text-5xl` (larger)
- Subtitle: `text-lg` (larger)

**Circles**
- Size increased: `w-20 h-20 md:w-28 md:h-28` → `w-24 h-24 md:w-32 md:h-32`
- Enhanced glow effect
- Hover: scale 110%, shadow, lift

**Staggered Animation**
```tsx
style={{
  opacity: isVisible ? 1 : 0,
  transform: isVisible
    ? 'translateY(0) scale(1)'
    : 'translateY(30px) scale(0.9)',
  transition: `opacity 0.6s ease ${index * 100}ms, transform 0.6s ease ${index * 100}ms`,
}}
```

---

### 5. Curated Reels (Trending Now) Section

**Location:** `frontend/src/components/home/CuratedReels.tsx`

#### Overview

Completely redesigned with drag functionality, larger cards, 3D effects, and premium animations.

#### Header Design
- Badge: "@NILIN.trending"
- Title: "Trending Now" - Large typography (4xl-6xl)
- "View All" button with arrow animation

#### Cards - TrendingFeedCard

**Location:** `frontend/src/components/home/TrendingFeedCard.tsx`

#### Dimensions
| State | Width | Height |
|-------|-------|--------|
| Default | 400px | 530px |
| Hover | 430px | 570px |

#### 3D Effect
```tsx
style={{
  transform: isHovered
    ? 'perspective(1000px) rotateY(-4deg) rotateX(3deg) scale(1.02)'
    : 'perspective(1000px) rotateY(0deg) rotateX(0deg)',
  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
}}
```

#### Features
- **Drag to explore**: Full mouse drag support
- **Video indicator**: Play button appears on hover
- **Explore CTA**: Bottom right, slides in on hover
- **Glow effect**: Coral gradient overlay
- **Border highlight**: Coral border on hover

#### Drag Implementation
```tsx
const handleMouseDown = (e: React.MouseEvent) => {
  setIsDragging(true);
  setDragStartX(e.pageX - scrollRef.current.offsetLeft);
  // ... drag logic
};
```

---

### 6. Offer Banner (Curated Experiences) Section

**Location:** `frontend/src/components/home/OfferBanner.tsx`

#### Overview

Transformed from generic coupon cards to premium "Featured Beauty Experiences" with luxury gradients.

#### Header
- Badge: "Exclusive" with Sparkles icon
- Title: "Curated Experiences" - Large elegant typography
- Supporting copy aligned right
- Warm background: `#F6EFE8`

#### Cards - Premium Design

**Luxury Gradients**
```typescript
const CARD_GRADIENTS = [
  'from-[#E8C4B8] via-[#D4A89A] to-[#C8A9A8]', // Rose Gold
  'from-[#F5E6D3] via-[#E8D4C0] to-[#D4C0A8]', // Champagne
  'from-[#F0E6DC] via-[#E5D8CC] to-[#D8C8B8]', // Soft Nude
  'from-[#E5D0D8] via-[#D8C0C8] to-[#C8B0B8]', // Blush Pink
  'from-[#F0E8E0] via-[#E8DED8] to-[#D8D0C8]', // Ivory
  'from-[#E8DDE5] via-[#D8D0D8] to-[#C8C0C8]', // Lavender
];
```

**Card Structure**
```
┌─────────────────────────────────────┐
│ [Badge]              [20% OFF]     │
│                                     │
│    Exclusive Bridal Package           │
│    For your special day...           │
│                                     │
│    ⏱ 2d 14h remaining             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    Claim Experience  →      │   │
│  └─────────────────────────────┘   │
│                                     │
│    or use code BRIDAL20             │
└─────────────────────────────────────┘
```

**Hover Effects**
- **Dominant card**: Scale 1.03, elevated shadow
- **Neighbor cards**: 50% opacity, scale 0.97
- **CTA**: Arrow slides right on hover

#### Features
- Staggered entrance animation (120ms between cards)
- Decorative blur circles
- Countdown timer display
- "Claim Experience" CTA
- Code displayed at bottom

#### Dimensions
- Card width: `380px`
- Card height: `320px min-height`
- Padding: `p-8`

---

### Files Created/Modified for Homepage Redesign

| File | Changes |
|------|---------|
| `frontend/src/index.css` | Added frosted glass button styles, animations |
| `frontend/src/pages/HomePage.tsx` | Hero redesign, light theme, removed category pills |
| `frontend/src/components/layout/NavigationHeader.tsx` | Scroll-morphing navbar, floating state |
| `frontend/src/components/location/LocationDropdown.tsx` | Light theme styling |
| `frontend/src/components/search/HeaderSearchDropdown.tsx` | Simplified light theme |
| `frontend/src/components/search/TrendingSearches.tsx` | Glassy pill design, animations |
| `frontend/src/components/home/CategoryCards.tsx` | Staggered animations, premium button |
| `frontend/src/components/home/CuratedReels.tsx` | Drag functionality, layout changes |
| `frontend/src/components/home/TrendingFeedCard.tsx` | 3D effects, larger cards, explore CTA |
| `frontend/src/components/home/OfferBanner.tsx` | Premium card design, luxury gradients |

---

### Testing Checklist - Homepage Redesign

- [ ] Homepage has light theme with cycling background images
- [ ] Navigation bar morphs into floating capsule on scroll
- [ ] NILIN logo scales larger at top of page
- [ ] Location and Track Order visible at all times
- [ ] Account button merges seamlessly with navbar
- [ ] Notification bell has larger size
- [ ] Text is readable over background images
- [ ] Headline stays on one line
- [ ] CTA buttons have frosted glass effect
- [ ] Social proof displays correctly
- [ ] Background images cycle smoothly
- [ ] "Trending searches" title displays correctly
- [ ] Pills have glassy appearance
- [ ] Hover animations work (lift, arrow slide)
- [ ] Categories animate in with stagger
- [ ] Cards are larger (400px+ width)
- [ ] 3D effect works smoothly without glitches
- [ ] Drag functionality works
- [ ] Explore CTA appears at bottom right on hover
- [ ] Navigation arrows are below cards
- [ ] Cards have luxury gradient backgrounds
- [ ] Hover focuses one card, dims others

---

## Supplement — Extended Session Details (Append-Only)

> **Note:** This section was appended per request. All content above is preserved unchanged.

### Session chronology (order of work)

Work was performed in this sequence across the June 13 session:

1. **shadcn + Aceternity setup** — Initialized `components.json`, installed `@aceternity/3d-card`, `@aceternity/3d-card-demo`, and `@aceternity/draggable-card`; added `frontend/src/components/ui/3d-card.tsx`.
2. **Popular Services 3D carousel** — Extracted `PopularServiceCard.tsx`, wired into `HomePage.tsx` inline carousel (after Ongoing Bookings + category pills).
3. **Popular Services polish** — Category gradients, stacked back card (`translateZ={-60}`), larger CTA, carousel padding to prevent hover clip.
4. **Curated Experiences (`OfferBanner`)** — User screenshot clarified this section (not Popular Services). Applied 3D stack, dark-on-light text, wider cards, larger “Claim Experience” button, reduced container padding.
5. **Beauty Studio (`CategorySpotlight`)** — Magazine-style Framer Motion cards, orbit border CSS, 10-card limit, scroll arrows below when scrollable, removed “View All Services”.
6. **The NILIN Experience** — New `ExperienceDraggableStack.tsx`; replaced grid in `ExperienceSection.tsx` with bounded draggable scatter canvas.
7. **Header regression fix** — After homepage hero animation landed in `NavigationHeader`, user reported broken header on `/customer/dashboard` (screenshot: narrow white bar left, dark hero bleeding right). Split hero vs default variants; fixed all non-home routes globally.
8. **Auth header cleanup** — Login + both registration flows use compact header (no search, no category tabs).
9. **Verification** — `npm run type-check` in `frontend/` passes (exit code 0).

---

### User-reported issues → resolutions

| User report | Root cause | Resolution |
|-------------|------------|------------|
| Screenshot showed “Curated Experiences” not Popular Services | Section mis-identified initially | Changes applied to `OfferBanner.tsx`, not Popular Services |
| Experience cards drag off-screen | Aceternity `DraggableCardBody` uses window constraints | Custom `ExperienceDraggableCard` with `dragConstraints={containerRef}` + `snapToHome()` |
| `motion/react` module not found | Registry template import incompatible with project deps | Switched to `framer-motion` in `draggable-card.tsx` |
| Header white block ~60% width on dashboard | Hero `fixed` + animated width/maxWidth applied to default variant | Default: `sticky`, `width/maxWidth: 100%`, inner `max-w-[1400px] mx-auto` |
| Category tabs disappear on scroll (non-home) | `isFloating = scrollProgress >= 1` on default pages | `isFloating = isHeroVariant && scrollProgress > 0.1` |
| Logo/search oddly scaled on dashboard | Hero scale values applied everywhere | `logoScale`, `textScale`, `scaleFactor` gated behind `isHeroVariant` |

**Reference screenshot:** `Screenshot 2026-06-13 183744.png` — `/customer/dashboard` showing misaligned header before fix.

---

### `PopularServiceCard.tsx` — component structure

**Props:**

```tsx
interface PopularServiceCardProps {
  service: Service;
  index: number;
  onClick: () => void;
  getServiceImage: (service: Service) => string;
  getDisplayPrice: (service: Service) => string;
}
```

**3D layer stack (inside `CardContainer`):**

1. **Back depth layer** — `CardItem translateZ={-60}`, absolute, `translate-x-3 translate-y-4 scale-[0.96]`, category gradient, `pointer-events-none`.
2. **Main `CardBody`** — clickable; gradient background, hover shadow ring.
3. **Foreground `CardItem`s** — title (`translateZ="50"`), category pill (`translateZ="60"`), image block with rating pill, price + “Book now →” CTA.

**Category gradient map keys:** `hair`, `makeup`, `nails`, `skin`, `spa`, `massage`, `default` — matched via substring on `service.category`.

**Featured badge:** Rendered when `index < 2` (first two carousel items).

**HomePage wiring:**

```tsx
<div className="flex gap-6 overflow-x-auto pt-6 pb-12 px-4 scrollbar-hide">
  {popularServices.map((service, index) => (
    <PopularServiceCard
      key={service._id || index}
      service={service}
      index={index}
      onClick={() => handleServiceClick(service._id)}
      getServiceImage={getServiceImage}
      getDisplayPrice={getDisplayPrice}
    />
  ))}
</div>
```

Carousel chevrons scroll by `±360px` via `popularScrollRef`.

---

### `3d-card.tsx` — CardBody extension

Aceternity source was copied into `frontend/src/components/ui/3d-card.tsx`. One project-specific change:

- **`CardBody`** spreads `...rest` onto the outer wrapper div so parent components can pass `onClick` directly without an extra wrapper element (required for Popular Services and OfferBanner navigation).

Exports: `CardContainer`, `CardBody`, `CardItem`, `useMouseEnter`, `useMouseLeave`.

---

### `OfferBanner.tsx` — additional implementation notes

- Uses same Aceternity 3D pattern as Popular Services (back stack + `CardBody` click).
- **6 gradient palettes** for offer cards (rose gold, champagne, nude, blush, ivory, lavender).
- **Section background:** `#F6EFE8`.
- **Container:** `max-w-[100rem]` with tighter horizontal padding than before.
- **Preserved:** claim modal, auth gate, `executeClaim`, focus-sync for claim status, AED price localization.
- **Data:** `offerService` API — not Sanity CMS.

---

### `CategorySpotlight.tsx` — additional implementation notes

- **Framer Motion** (not 3D card) for editorial portrait hover: lift, image parallax, subtle perspective tilt.
- **`SpotlightCard`** sub-component encapsulates orbit border + hover state.
- **Fetch strategy:** `getFeaturedPackages({ limit, category })` → fallback `getPackages({ sortBy: 'popularity' })`.
- **Scroll detection:** `canScroll = scrollWidth > clientWidth + 8`; arrows only render when true.
- **HomePage:** `<CategorySpotlight limit={10} />` (was default 6).

**CSS added to `index.css`:**

- `.spotlight-orbit-border` — wrapper with 2.5px padding, `isolation: isolate`
- `::before` / `::after` — dual conic-gradient layers, `spotlight-orbit-spin` keyframes (3.8s linear)
- `.spotlight-orbit-border.is-orbit-active` — boosted opacity on hover
- `@media (prefers-reduced-motion: reduce)` — disables spin

---

### `ExperienceDraggableStack.tsx` — drag physics

**Per-card motion values:**

- `x`, `y` — drag offset (spring back to 0 on release)
- `mouseX`, `mouseY` — drive `rotateX` / `rotateY` tilt via `useSpring` + `useTransform`

**Drag config:**

```tsx
drag
dragConstraints={containerRef}
dragElastic={0.42}
dragMomentum={false}
onDragStart={() => setIsDragging(true)}
onDragEnd={() => { setIsDragging(false); snapToHome(); }}
```

**Snap-back:**

```tsx
animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
animate(y, 0, { type: 'spring', stiffness: 420, damping: 32 });
```

**10 scatter layouts** in `CARD_LAYOUTS` — absolute positions with rotation and z-index 1–10.

**Interaction:** `onTap` on card opens `ExperienceDetailModal` (distinguishes tap from drag via Framer Motion).

**Canvas:** `min-h-[700px] sm:min-h-[820px]`, `rounded-[2rem]`, glass background, centered watermark subtitle.

---

### `NavigationHeader.tsx` — code-level fix (detailed)

#### New prop

```tsx
variant?: 'default' | 'hero';  // default: 'default'
```

#### Scroll progress logic

| Variant | `scrollProgress` behavior |
|---------|---------------------------|
| `hero` | Continuous 0→1 over scroll range `SCROLL_START=0` to `SCROLL_END=80`, eased with `easeOutCubic` |
| `default` | Binary: `0` when `scrollY ≤ 10`, else `1` (used only for shadow on scroll) |

#### Style object split

**Hero (`headerStyle` when `isHeroVariant`):**

- `position`: `fixed left-0 right-0` (via className)
- Animated: `width`, `maxWidth`, `top`, `left: 50%`, `transform: translateX(-50%)`, `borderRadius`, rgba background, blur, shadow, border

**Default (`headerStyle` when not hero):**

```tsx
{
  width: '100%',
  maxWidth: '100%',
  top: 0,
  left: 0,
  transform: 'none',
  borderRadius: 0,
  background: 'rgba(255, 255, 255, 0.98)',
  backdropFilter: 'blur(20px)',
  boxShadow: scrollProgress >= 1 ? '0 4px 24px rgba(45, 45, 45, 0.08)' : 'none',
  borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
}
```

**Position class:**

```tsx
const headerPositionClass = isHeroVariant ? 'fixed left-0 right-0' : 'sticky top-0';
```

#### JSX structure (default variant)

```
<header sticky, full-width background>
  <div className="w-full">
    <div md:hidden>  … mobile row …  </div>
    <div hidden md:block>
      <div className="max-w-[1400px] mx-auto w-full">
        <div flex row minHeight 64px>  … logo, location, track, search, bell, account …  </div>
      </div>
    </div>
    {showCategoryTabs && !isFloating && <CategoryTabs />}
  </div>
</header>
```

**Key structural fix:** Background on outer `<header>` spans 100%; content constrained inside `max-w-[1400px] mx-auto`. Previously max-width was on the header element itself, causing the narrow white block.

#### Removed / simplified

- Duplicate mobile/desktop `CategoryTabs` wrappers with invalid `bg-white/98`
- Fixed `height: 64px` on `<header>` (replaced with `minHeight` on inner row only)
- Hero `isFloating` behavior on non-hero pages

#### Scale gating (final)

```tsx
const scaleFactor = isHeroVariant ? 1 + easedProgress * 0.1 : 1;
const logoScale = isHeroVariant ? 1.15 - easedProgress * 0.05 : 1;
const textScale = isHeroVariant ? 1.1 - easedProgress * 0.05 : 1;
const navHeight = isHeroVariant ? 64 + easedProgress * 8 : 64;
const isFloating = isHeroVariant && scrollProgress > 0.1;
```

---

### Auth pages — exact header usage

All three auth components updated in **both** loading and main render branches:

| File | Change |
|------|--------|
| `LoginForm.tsx` | `<NavigationHeader showSearch={false} showCategoryTabs={false} />` |
| `CustomerRegistration.tsx` | Same |
| `ProviderRegistration.tsx` | Same |

---

### HomePage section order (after hero)

1. Ongoing Bookings (authenticated)
2. Category pills
3. **Popular Services** (3D carousel)
4. Category Cards
5. **Curated Experiences** (`OfferBanner`)
6. **Beauty Studio** (`CategorySpotlight limit={10}`)
7. Recommended Pros (authenticated)
8. Recommended Services (authenticated)
9. **The NILIN Experience** (`ExperienceSection`)
10. Footer

**Header on HomePage only:**

```tsx
<NavigationHeader variant="hero" showSearch={false} showCategoryTabs={false} />
```

Hero section: `pt-24 md:pt-28` to clear fixed overlay header.

---

### Pages affected by header fix (no per-file edits required)

Any route using default `<NavigationHeader />` automatically received the fix, including but not limited to:

- **Customer:** `/customer/dashboard`, bookings, profile, messages, book-services, reviews, notification settings
- **Provider:** dashboard, analytics, calendar, earnings, managed services, bookings, settings, reviews
- **Booking:** book service, package booking, provider bookings, booking detail
- **Discovery:** `/search`, service detail, subcategory pages
- **Static:** About, Privacy, Help, Unsubscribe (About/Privacy already used `showSearch={false} showCategoryTabs={false}`)

**Customer dashboard note:** Dark welcome strip (`bg-gradient-to-r from-[#2a2826] via-nilin-charcoal…`) is intentional page content in `<main>`, not part of the nav. With sticky header it flows below the full-width nav instead of bleeding through a gap.

---

### Commands run

```bash
cd frontend
npx shadcn init                    # components.json + Aceternity registry
npm install @aceternity/3d-card @aceternity/3d-card-demo @aceternity/draggable-card
npm run type-check                 # tsc --noEmit — passes
```

---

### Complete file inventory (created + modified)

**Created:**

- `frontend/components.json`
- `frontend/src/components/ui/3d-card.tsx`
- `frontend/src/components/ui/draggable-card.tsx` (registry install + import fix)
- `frontend/src/components/home/PopularServiceCard.tsx`
- `frontend/src/components/experience/ExperienceDraggableStack.tsx`

**Modified:**

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/components/home/OfferBanner.tsx`
- `frontend/src/components/home/CategorySpotlight.tsx`
- `frontend/src/components/experience/ExperienceSection.tsx`
- `frontend/src/components/layout/NavigationHeader.tsx`
- `frontend/src/index.css`
- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/CustomerRegistration.tsx`
- `frontend/src/components/auth/ProviderRegistration.tsx`

**Not changed:** Backend, database, API routes, Sanity (experiences/offers use existing REST APIs).

---

### Manual QA priority list

**P0 — Header regression**

1. `/customer/dashboard` — full-width header, tabs aligned, no dark bleed-through in nav row
2. `/login` — compact header
3. `/` — hero morph animation intact

**P1 — Homepage interactions**

4. Popular Services — hover tilt, click navigates
5. Curated Experiences — claim flow, dark text readable
6. Beauty Studio — 10 cards, orbit border, arrows when overflow
7. NILIN Experience — drag bounded, snap back, tap opens modal

**P2 — Regression**

8. Mobile menu + search overlay
9. Notification bell + account dropdown
10. `prefers-reduced-motion` on orbit border

---

*Supplement appended — June 13, 2026*
