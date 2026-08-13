import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Labels rendered from sanitized i18n HTML carry their accessible text via
    // dangerouslySetInnerHTML; association with a control is still enforced (htmlFor/nesting).
    files: ['**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/label-has-associated-control': [
        'error',
        { labelAttributes: ['dangerouslySetInnerHTML'] },
      ],
    },
  },
])
