/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pe: {
          bg: "var(--pe-bg)",
          surface: "var(--pe-surface)",
          "surface-secondary": "var(--pe-surface-secondary)",
          text: "var(--pe-text)",
          "text-secondary": "var(--pe-text-secondary)",
          border: "var(--pe-border)",
          "border-subtle": "var(--pe-border-subtle)",
          accent: "var(--pe-accent)",
          "accent-hover": "var(--pe-accent-hover)",
          "accent-pressed": "var(--pe-accent-pressed)",
          focus: "var(--pe-focus)",
          success: "var(--pe-success)",
          "success-surface": "var(--pe-success-surface)",
          warning: "var(--pe-warning)",
          "warning-surface": "var(--pe-warning-surface)",
          danger: "var(--pe-danger)",
          "danger-surface": "var(--pe-danger-surface)",
        },
      },
      boxShadow: {
        "pe-card": "var(--pe-shadow-card)",
        "pe-popover": "var(--pe-shadow-popover)",
      },
      borderRadius: {
        "pe-xs": "6px",
        "pe-sm": "10px",
        "pe-md": "14px",
        "pe-lg": "20px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          "Inter",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
