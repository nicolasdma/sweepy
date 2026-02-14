/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: { primary: '#0f0f23', secondary: '#64648a', tertiary: '#9898b0', bg: '#fafaf8' },
      },
    },
  },
  plugins: [],
}
