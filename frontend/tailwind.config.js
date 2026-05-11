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
        // NILIN Brand Colors
        nilin: {
          // Soft pastels (backgrounds)
          pink: '#FFE5F0',
          lavender: '#E8E5FF',
          cream: '#F5F3E8',
          blue: '#E5F3FF',
          // Bold accents (CTAs, highlights)
          primary: '#6366F1',
          'primary-dark': '#4F46E5',
          secondary: '#8B5CF6',
          accent: '#EC4899',
          success: '#10B981',
          dark: '#1E1B4B',
        },
      },
      backgroundImage: {
        'gradient-nilin-primary': 'linear-gradient(135deg, #FFE5F0, #E8E5FF)',
        'gradient-nilin-secondary': 'linear-gradient(135deg, #E8E5FF, #E5F3FF)',
        'gradient-nilin-tertiary': 'linear-gradient(135deg, #F5F3E8, #E5F3FF)',
        'gradient-nilin-pink-lavender': 'linear-gradient(135deg, #FFE5F0, #E8E5FF)',
        'gradient-nilin-lavender-blue': 'linear-gradient(135deg, #E8E5FF, #E5F3FF)',
        'gradient-nilin-hero': 'linear-gradient(135deg, #FFE5F0 0%, #E8E5FF 50%, #E5F3FF 100%)',
        'gradient-nilin-cta': 'linear-gradient(135deg, #1E1B4B 0%, #4F46E5 100%)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}