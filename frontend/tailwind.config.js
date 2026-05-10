/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg0:     '#0d0f14',
        bg1:     '#141720',
        bg2:     '#1c2030',
        bg3:     '#242840',
        accent:  '#4f7cff',
        accent2: '#7b5fff',
        green:   '#22c986',
        red:     '#ff5f72',
        amber:   '#ffb344',
        teal:    '#2dd4bf',
        text1:   '#eef0f6',
        text2:   '#8a8fa8',
        text3:   '#545870',
      },
    },
  },
  plugins: [],
};
