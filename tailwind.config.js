/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // pixel-RPG palette derived from the Theos logo
        bg: '#160C2A',          // deep cosmic purple canvas
        bgDeep: '#0E0720',      // darkest (behind frames)
        surface: '#241640',     // raised panels
        surface2: '#2E1C52',    // inputs / hover
        line: '#4A3578',        // purple-gold hairline
        line2: '#6A4FA0',       // stronger border
        gold: '#E8B547',        // primary accent (frame gold)
        goldDim: '#9A7A2E',     // darker gold (stud shadow)
        crystal: '#5AB8D6',     // logo crystal cyan
        crystalDeep: '#6E9BFF', // crystal blue
        ink: '#F2EAD3',         // warm off-white text
        muted: '#B7A6D6',       // secondary text
        faint: '#7C6BA6',       // micro labels
        ok: '#7BD389',          // success / enabled
        warn: '#FFA94D',        // warning
        danger: '#E25C5C',      // destructive
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        label: '0.18em',
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
}
