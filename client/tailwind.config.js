export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        monera: {
          navy: '#072146',
          deep: '#04142C',
          midnight: '#0A2B5C',
          sapphire: '#1464A5',
          electric: '#0284FE',
          cyan: '#2DCCCD',
          gold: '#D4AF37',
          champagne: '#F0D384',
          ice: '#F4F7FB',
          slate: '#5A6B82',
        },
      },
      boxShadow: {
        bbva: '0 14px 40px -10px rgba(7, 33, 70, 0.14)',
        card3d: '0 30px 70px -15px rgba(4, 20, 44, 0.65), 0 0 40px -10px rgba(45, 204, 205, 0.28)',
      },
    },
  },
  plugins: [],
};
