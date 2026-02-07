import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: '#0D1117',
          raised: '#161B22',
          overlay: '#1C2128',
          input: '#21262D',
        },
        border: {
          DEFAULT: '#30363D',
          muted: '#21262D',
          emphasis: '#8B949E',
        },
        accent: {
          DEFAULT: '#0FA97E',
          hover: '#0B8C68',
          muted: 'rgba(16,185,129,0.15)',
        },
        text: {
          primary: '#E6EDF3',
          secondary: '#9DA5AE',
          muted: '#6E7681',
        },
      },
      fontSize: {
        label: ['0.6875rem', { letterSpacing: '0.05em' }],
      },
    },
  },
  plugins: [],
};
export default config;
