// eslint.config.js
import js from "@eslint/js";

export default [
  js.configs.recommended,

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },

    rules: {
      // Common JS style rules
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-console": "off",
      "eqeqeq": "error",
      "curly": "error"
    }
  }
];
