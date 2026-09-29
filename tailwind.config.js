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
        naksha: {
          darkest: '#0B0F19',
          dark: '#111827',
          panel: '#1E293B',
          border: '#334155',
          accent: '#2563EB',
          accentHover: '#1D4ED8',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
