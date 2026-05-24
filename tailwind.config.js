/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./local/**/*.html",
    "./scripts/content_automation/**/*.py",
  ],
  theme: {
    extend: {
      colors: {
        gold: "#D4AF37",
        "gold-primary": "#D4AF37",
      },
      fontFamily: {
        cinzel: ["Cinzel", "serif"],
        "serif-tc": ["Noto Serif TC", "serif"],
      },
    },
  },
  plugins: [],
};
