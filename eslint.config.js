// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  { ignores: ["backend/src/public/docs/**"] },
  js.configs.recommended,

  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },

    rules: {
      // Keep existing unused bindings visible without blocking lint.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      curly: "error",
    },
  },
  {
    files: ["backend/**/*.{js,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettierRecommended,
];
