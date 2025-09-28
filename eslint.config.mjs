// eslint.config.mjs
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      env: { node: true },
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  {
    files: ["**/*.{js,cjs,mjs}"],
    rules: {
      "no-undef": "error",
    },
  },
  { ignores: ["node_modules/", "dist/", "build/"] },
];
