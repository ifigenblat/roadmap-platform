const path = require("path");

module.exports = {
  plugins: {
    /** Pin config so PostCSS always loads apps/web tailwind.config.js (not cwd-dependent). */
    tailwindcss: {
      config: path.join(__dirname, "tailwind.config.js"),
    },
    autoprefixer: {},
  },
};
