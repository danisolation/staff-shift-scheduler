import react from '@scheduler/config/eslint-react';

export default [
  ...react,
  {
    // shadcn/ui primitives export their cva variants (buttonVariants,
    // badgeVariants) next to the component — the standard, accepted
    // exception to the fast-refresh rule (same override shadcn's own
    // templates use for generated ui folders).
    files: ['src/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
];
