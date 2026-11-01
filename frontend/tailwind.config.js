/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(-18px) rotate(6deg)' } },
        blob: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(40px,-30px) scale(1.12)' }, '66%': { transform: 'translate(-30px,30px) scale(0.92)' } },
        scan: { '0%': { top: '0%' }, '100%': { top: '100%' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(244,63,94,0.55)' }, '100%': { boxShadow: '0 0 0 10px rgba(244,63,94,0)' } },
        cellCycle: { '0%,100%': { backgroundColor: 'rgba(52,211,153,0.85)' }, '40%': { backgroundColor: 'rgba(251,191,36,0.85)' }, '70%': { backgroundColor: 'rgba(244,63,94,0.85)' } },
        gradientShift: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        blob: 'blob 18s ease-in-out infinite',
        scan: 'scan 1.6s ease-in-out infinite alternate',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        'cell-cycle': 'cellCycle 6s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },
    },
  },
  plugins: [],
};
