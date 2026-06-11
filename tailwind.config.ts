import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Innago brand colors
        innago: {
          blue: '#1B4DFF',
          'blue-dark': '#1339CC',
          'blue-light': '#EEF2FF',
          green: '#00A86B',
          'green-light': '#E6F7F1',
          red: '#E53935',
          'red-light': '#FEECEB',
          yellow: '#F59E0B',
          'yellow-light': '#FEF3C7',
          dark: '#1A1D2E',
          gray: '#6B7280',
          'gray-light': '#F3F4F6',
          'gray-border': '#E5E7EB',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
