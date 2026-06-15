/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // NILIN Brand Colors - Luxury Minimal Aesthetic
        nilin: {
          // Primary palette (from reference images)
          blush: '#F5E6E0',
          peach: '#FAE5E0',
          cream: '#FDFBF9',
          rose: '#D4A89A',
          coral: '#E8B4A8',
          // Text colors
          charcoal: '#2D2D2D',
          warmGray: '#6B6B6B',
          lightGray: '#9B9B9B',
          // Semantic colors
          primary: '#E8B4A8',
          'primary-dark': '#D4A89A',
          secondary: '#D4A89A',
          accent: '#2D2D2D',
          success: '#7BA889',
          warning: '#E8C4A8',
          error: '#C88B8B',
          // Backgrounds
          surface: '#FFFFFF',
          muted: '#F8F6F4',
          overlay: 'rgba(45, 45, 45, 0.05)',
        },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-nilin-primary': 'linear-gradient(135deg, #F5E6E0, #FAE5E0)',
        'gradient-nilin-hero': 'linear-gradient(135deg, #F5E6E0 0%, #FAE5E0 50%, #FDFBF9 100%)',
        'gradient-nilin-warm': 'linear-gradient(135deg, #F5E6E0 0%, #E8B4A8 100%)',
        'gradient-nilin-cta': 'linear-gradient(135deg, #D4A89A 0%, #E8B4A8 100%)',
        'gradient-nilin-surface': 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF9 100%)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
        '2xl': "20px",
        // NILIN custom border radius
        'nilin': '12px',
        'nilin-lg': '16px',
        'nilin-sm': '8px',
      },
      boxShadow: {
        'nilin': '0 4px 20px rgba(45, 45, 45, 0.08)',
        'nilin-lg': '0 8px 30px rgba(45, 45, 45, 0.12)',
        'nilin-sm': '0 2px 10px rgba(45, 45, 45, 0.06)',
        'nilin-warm': '0 4px 20px rgba(212, 168, 154, 0.15)',
        'nilin-warm-lg': '0 8px 30px rgba(212, 168, 154, 0.18)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "slide-up": {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        "toast-slide-in": {
          from: { opacity: 0, transform: 'translateX(100%)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        "toast-fade-out": {
          from: { opacity: 1, transform: 'translateX(0)' },
          to: { opacity: 0, transform: 'translateX(100%)' },
        },
        "slide-in-right": {
          from: { opacity: 0, transform: 'translateX(100%)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        "slide-out-right": {
          from: { opacity: 1, transform: 'translateX(0)' },
          to: { opacity: 0, transform: 'translateX(100%)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-33.333%)' },
        },
        // NILIN Bell Animations
        "nilin-bell-ring": {
          "0%": { transform: "rotate(0deg)" },
          "15%": { transform: "rotate(15deg)" },
          "30%": { transform: "rotate(-12deg)" },
          "45%": { transform: "rotate(10deg)" },
          "60%": { transform: "rotate(-6deg)" },
          "75%": { transform: "rotate(3deg)" },
          "85%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        "nilin-bell-button-pulse": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        "nilin-badge-pulse": {
          "0%": { transform: "scale(1)", boxShadow: "0 4px 20px rgba(232, 180, 168, 0.15)" },
          "50%": { transform: "scale(1.15)", boxShadow: "0 4px 25px rgba(232, 180, 168, 0.3)" },
          "100%": { transform: "scale(1)", boxShadow: "0 4px 20px rgba(232, 180, 168, 0.15)" },
        },
        "nilin-dropdown-in": {
          from: { opacity: 0, transform: "translateY(-10px) scale(0.95)" },
          to: { opacity: 1, transform: "translateY(0) scale(1)" },
        },
        "nilin-bell-glow": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(232, 180, 168, 0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(232, 180, 168, 0.4)" },
        },
        // Skeleton shimmer animation
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Fade in up for staggered card animations
        "fade-in-up": {
          from: { opacity: 0, transform: "translateY(20px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        // Modal scale animations
        "modal-scale-in": {
          from: { opacity: 0, transform: "translateX(-50%) translateY(-50%) scale(0.95)" },
          to: { opacity: 1, transform: "translateX(-50%) translateY(-50%) scale(1)" },
        },
        "modal-scale-out": {
          from: { opacity: 1, transform: "translateX(-50%) translateY(-50%) scale(1)" },
          to: { opacity: 0, transform: "translateX(-50%) translateY(-50%) scale(0.95)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "toast-slide-in": "toast-slide-in 0.3s ease-out",
        "toast-fade-out": "toast-fade-out 0.2s ease-in forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-out-right": "slide-out-right 0.2s ease-in forwards",
        marquee: "marquee 30s linear infinite",
        // NILIN Bell Animations
        "nilin-bell-ringing": "nilin-bell-ring 1.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite",
        "nilin-bell-button": "nilin-bell-button-pulse 0.4s ease-out",
        "nilin-badge-pulse": "nilin-badge-pulse 2s ease-in-out infinite",
        "nilin-dropdown-in": "nilin-dropdown-in 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        "nilin-bell-glow": "nilin-bell-glow 2s ease-in-out infinite",
        // Skeleton and card animations
        shimmer: "shimmer 2s linear infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        // Modal animations
        "modal-scale-in": "modal-scale-in 0.2s ease-out",
        "modal-scale-out": "modal-scale-out 0.15s ease-in",
      },
    },
  },
  // FIX: Safelist dynamic gradient classes used in BookServicesPage.tsx
  // These classes are constructed at runtime via string interpolation in the gradients map
  // Without this safelist, Tailwind's purge will not include them in production CSS
  safelist: [
    "from-amber-100", "to-orange-100",
    "from-pink-100", "to-rose-100",
    "from-purple-100", "to-indigo-100",
    "from-emerald-100", "to-teal-100",
    "from-blue-100", "to-cyan-100",
    "from-rose-100", "to-pink-100",
    "from-nilin-blush", "to-nilin-peach",
    "from-nilin-coral", "to-nilin-rose",
  ],
  plugins: [require("tailwindcss-animate")],
}
