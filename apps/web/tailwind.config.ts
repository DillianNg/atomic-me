import type { Config } from 'tailwindcss';

// Cau hinh Tailwind v3. shadcn/ui dung CSS variables; mo rong them o Phase sau.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
