/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d332e",
        forest: "#315b4a",
        leaf: "#dce9dc",
        paper: "#f6f7f4",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 35px rgba(32, 54, 45, 0.06)",
      },
    },
  },
  plugins: [],
};
