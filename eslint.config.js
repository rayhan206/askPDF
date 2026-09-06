import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "coverage/**",
      ".qa/**",
      "docs/**",
      "*.config.ts",
      "vitest.workspace.ts",
      "eslint.config.js",
      "prettier.config.js",
      "scripts/docker/*.js",
      "scripts/migrations/*.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ["*.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "no-control-regex": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { ...globals.node, db: "readonly" } },
  },
);
