/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'loading-scan': 'loadingScan 1.5s linear infinite',
      },
      keyframes: {
        loadingScan: {
          '0%': { transform: 'translateX(-100px)' },
          '100%': { transform: 'translateX(800px)' },
        }
      }
    },
  },
  plugins: [],
}
