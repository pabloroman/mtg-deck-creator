/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MTG mana colors (approximate, for chips/borders)
        mtg: {
          w: '#f8f6d8',
          u: '#0e68ab',
          b: '#150b00',
          r: '#d3202a',
          g: '#00733e',
          c: '#9e9aa0',
        },
      },
    },
  },
  plugins: [],
};
