/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'reader': ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'reader': {
          'bg': 'var(--reader-bg)',
          'text': 'var(--reader-text)',
          'link': 'var(--reader-link)',
          'selection': 'var(--reader-selection)',
          'highlight': 'var(--reader-highlight)',
        },
      },
      animation: {
        'pace': 'pace 0.3s ease-out',
      },
      keyframes: {
        pace: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
