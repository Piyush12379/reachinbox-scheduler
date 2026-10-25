/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        reachdark: {
          bg: '#0F1117',
          surface: '#1A1D26',
          card: '#1F2330',
          border: '#2A2F40',
          textMuted: '#94A3B8'
        }
      }
    },
  },
  plugins: [],
}
