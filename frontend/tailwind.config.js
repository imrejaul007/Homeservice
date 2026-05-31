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
      },
      boxShadow: {
        'nilin': '0 4px 20px rgba(45, 45, 45, 0.08)',
        'nilin-lg': '0 8px 30px rgba(45, 45, 45, 0.12)',
        'nilin-sm': '0 2px 10px rgba(45, 45, 45, 0.06)',
        'nilin-warm': '0 4px 20px rgba(212, 168, 154, 0.15)',
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
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
