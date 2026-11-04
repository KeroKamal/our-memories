module.exports = {
  content: ['../index.html', '../bible.js', '../effects.js'],
  theme: {
    extend: {
      colors: {
        rose: {
          50: 'rgb(var(--c50-rgb) / <alpha-value>)',
          100: 'rgb(var(--c100-rgb) / <alpha-value>)',
          200: 'rgb(var(--c200-rgb) / <alpha-value>)',
          300: 'rgb(var(--c300-rgb) / <alpha-value>)',
          400: 'rgb(var(--c400-rgb) / <alpha-value>)',
          500: 'rgb(var(--c500-rgb) / <alpha-value>)',
          600: 'rgb(var(--c600-rgb) / <alpha-value>)',
          700: 'rgb(var(--c700-rgb) / <alpha-value>)',
        }
      },
      fontFamily: {
        cursive: ['"Dancing Script"', 'cursive'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      }
    }
  }
};
