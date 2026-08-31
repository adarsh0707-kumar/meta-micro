/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#FAF3E0",
        surface: "#FFFFFF",
        ink: "#333333",
        primary: {
          DEFAULT: "#FF6F61",
          dark: "#E85A4D",
        },
        accent: "#FFD700",
        muted: "#E0E0E0",
      },
      fontFamily: {
        heading: ["Sora", "sans-serif"],
        body: ["Outfit", "sans-serif"],
      },
      fontSize: {
        h1: ["48px", { lineHeight: "1.1", fontWeight: "700" }],
        h2: ["34px", { lineHeight: "1.15", fontWeight: "700" }],
        h3: ["24px", { lineHeight: "1.2", fontWeight: "700" }],
        h4: ["18px", { lineHeight: "1.3", fontWeight: "600" }],
        base: ["16px", { lineHeight: "1.6" }],
      },
      borderRadius: {
        chunky: "1.5rem",
      },
      boxShadow: {
        card: "0 4px 0 0 rgba(51,51,51,0.08)",
        pop: "0 6px 0 0 rgba(51,51,51,0.12)",
      },
    },
  },
  plugins: [],
};
