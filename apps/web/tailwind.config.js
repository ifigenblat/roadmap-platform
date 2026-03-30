/** @type {import('tailwindcss').Config} */
const path = require("path");

const root = __dirname;
/** POSIX-style path for fast-glob (reliable with absolute paths on Windows/macOS/Linux). */
function posix(p) {
  return p.split(path.sep).join("/");
}

// One explicit pattern per ext — avoids `**/*.{a,b,c}` brace quirks in some runners.
const exts = ["js", "ts", "jsx", "tsx", "mdx"];
const dirs = ["app", "components", "lib"];
const content = dirs.flatMap((dir) =>
  exts.map((ext) => posix(path.join(root, dir, "**", `*.${ext}`))),
);

module.exports = {
  content,
  theme: {
    extend: {},
  },
  plugins: [],
};
