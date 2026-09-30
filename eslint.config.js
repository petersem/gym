// eslint.config.js
import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,

  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },

    rules: {
      // Keep existing unused bindings visible without blocking lint.
      "no-unused-vars": "warn",
      "no-console": "off",
      "eqeqeq": ["error", "always", { "null": "ignore" }],
      "curly": "error"
    }
  },
  {
    files: ["backend/**/*.{js,mjs}"],
    languageOptions: {
      globals: globals.node
    }
  }
];
