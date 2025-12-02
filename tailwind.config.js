/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#3181FC",
        background: "#FFFFFF",
        card: "#F8FAFC",
        text: "#1E293B",
        muted: "#64748B",
        border: "#E2E8F0"
      },
      fontFamily: {
        display: ["\"Space Grotesk\"", "\"Noto Sans JP\"", "system-ui", "sans-serif"],
        body: ["\"Noto Sans JP\"", "\"Space Grotesk\"", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 4px 30px rgba(49, 129, 252, 0.12)"
      }
    }
  },
  plugins: []
};
