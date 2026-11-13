/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { 300: '#FFE57F', 400: '#FFD700', 500: '#D4AF37', 600: '#AA7C11', 700: '#855A00' },
        darkbg: '#0A0A0C',
        cardbg: '#141419',
      },
      fontFamily: {
        sans: ['"Noto Sans Ethiopic"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
