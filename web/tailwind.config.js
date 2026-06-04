/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { cyberblack: "#050505", cyberemerald: "#10b981", cyberwhite: "#EBEBEB" },
      fontFamily: {
        serif: ["Newsreader", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["Space Grotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
};
