import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "prisma/migrations/**",
      "*.config.js",
      "jest*.config.ts",
      "scripts/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-param-reassign": "error",
      "no-constant-condition": "error",
      "prefer-const": "error",
    },
  },
);
