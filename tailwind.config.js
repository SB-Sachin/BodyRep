/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',        // app background
        surface: '#1e293b',    // raised cards
        surface2: '#27354a',   // nested / hover surfaces
        line: 'rgba(255,255,255,0.08)',
        accent: '#f97316',     // brand / primary CTA — energetic athletic orange
        accent2: '#fb923c',    // lighter accent for gradients/hover
        gold: '#fbbf24',
        success: '#34d399',
        danger: '#f87171',
        // per-tree semantic colors (kept distinct from brand)
        push: '#f87171',
        pull: '#22d3ee',
        legs: '#34d399',
        core: '#fbbf24',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 16px -4px rgba(0,0,0,0.4)',
        glow: '0 0 24px -6px rgba(249,115,22,0.5)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pop': { '0%': { transform: 'scale(0.9)' }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        'pop': 'pop 0.3s ease-out both',
      },
    },
  },
  plugins: [],
}
