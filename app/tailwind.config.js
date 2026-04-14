/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Daraja brand colors - warm, trustworthy, humanitarian
        daraja: {
          50: '#FEF9F3',
          100: '#FEF3E2',
          200: '#FDE4C4',
          300: '#FBCE99',
          400: '#F8A94D',
          500: '#F59E0B', // Primary amber
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        // Semantic colors
        trust: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        caution: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
        alert: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
        },
        // Bridge/connection metaphor
        bridge: {
          light: '#FEF3C7',
          DEFAULT: '#B45309',
          dark: '#78350F',
        },
      },
      fontFamily: {
        // Distinctive typography
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        display: ['Libre Franklin', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Larger base for accessibility
        'xs': ['0.8125rem', { lineHeight: '1.25rem' }],
        'sm': ['0.9375rem', { lineHeight: '1.5rem' }],
        'base': ['1.0625rem', { lineHeight: '1.75rem' }],
        'lg': ['1.1875rem', { lineHeight: '1.875rem' }],
        'xl': ['1.375rem', { lineHeight: '2rem' }],
        '2xl': ['1.625rem', { lineHeight: '2.25rem' }],
        '3xl': ['2rem', { lineHeight: '2.5rem' }],
        '4xl': ['2.5rem', { lineHeight: '3rem' }],
      },
      spacing: {
        // Touch-friendly spacing
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'warm': '0 4px 14px 0 rgba(180, 83, 9, 0.15)',
        'warm-lg': '0 10px 40px 0 rgba(180, 83, 9, 0.2)',
        'inner-warm': 'inset 0 2px 4px 0 rgba(180, 83, 9, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'recording': 'recording 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        recording: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
      },
      // Accessibility-first minimum touch targets
      minHeight: {
        'touch': '44px',
        'touch-lg': '56px',
      },
      minWidth: {
        'touch': '44px',
        'touch-lg': '56px',
      },
    },
  },
  plugins: [],
}
