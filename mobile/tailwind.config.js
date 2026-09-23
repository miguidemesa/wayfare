/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./shared/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sand: {
          DEFAULT: "#FAF8F5",
          50: "#FAF8F5",
          100: "#F4F0E8",
          200: "#EAE4D9",
          300: "#DDD5C7",
          400: "#C8BEAD",
        },
        paper: "#FFFFFF",
        ink: {
          DEFAULT: "#1C1917",
          primary: "#1C1917",
          secondary: "#57534E",
          muted: "#78716C",
          dim: "#A8A29E",
          border: "#E7E2D8",
        },
        terracotta: {
          DEFAULT: "#C2593F",
          dark: "#A5442C",
          light: "#F7ECE8",
        },
        forest: {
          DEFAULT: "#2D5A4C",
          dark: "#1F4237",
          light: "#EAF1ED",
        },
        ocean: {
          DEFAULT: "#2B4C6F",
          dark: "#1D3752",
          light: "#EBF1F8",
        },
        amber: {
          DEFAULT: "#D9822B",
          dark: "#B86A1D",
          light: "#FCF3E8",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          card: "#FFFFFF",
          muted: "#F4F0E8",
          warm: "#EAE4D9",
          border: "#E7E2D8",
        },
        accent: "#C2593F",
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};