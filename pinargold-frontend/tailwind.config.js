/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Plus Jakarta Sans','sans-serif'], outfit: ['Outfit','sans-serif'], mono: ['ui-monospace','SFMono-Regular','monospace'] },
      colors: { gold: {50:'#FFF9E8',100:'#FFF1C5',200:'#F6DE98',300:'#F0C875',400:'#E8B25A',500:'#D4AF37',600:'#BB9225',700:'#9A7B1C',800:'#705A18',900:'#4B3C16'} },
      keyframes: {
        flashUp: { '0%,100%': {backgroundColor:'transparent'}, '25%':{backgroundColor:'rgba(34,197,94,.24)'} },
        flashDown: { '0%,100%': {backgroundColor:'transparent'}, '25%':{backgroundColor:'rgba(239,68,68,.24)'} },
        pulseDot: { '0%,100%':{opacity:'1'}, '50%':{opacity:'.25'} }
      },
      animation: { flashUp:'flashUp 1.2s ease-out', flashDown:'flashDown 1.2s ease-out', pulseDot:'pulseDot 1.6s infinite' }
    }
  },
  plugins: []
};
