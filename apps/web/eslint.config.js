import { react } from '@atomic-me/eslint-config';

export default [
  ...react,
  {
    ignores: ['dist/**', 'vite.config.ts', 'tailwind.config.ts', 'postcss.config.js'],
  },
];
