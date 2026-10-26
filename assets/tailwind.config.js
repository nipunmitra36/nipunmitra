// Tailwind theme, shared by the CDN (local preview) and the production build.
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        void: '#04050d',
        deep: '#0a0b1e',
        nebula: { violet: '#8b5cf6', cyan: '#22d3ee', pink: '#f472b6', amber: '#fbbf24' },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-18px)' } },
        pulseGlow: { '0%,100%': { opacity: .55 }, '50%': { opacity: 1 } },
        blink: { '50%': { opacity: 0 } },
      },
    },
  },
};
