/**
 * Mantine's PostCSS setup. `postcss-preset-mantine` provides the mixins
 * (light-dark, rem conversion, breakpoint helpers) that Mantine CSS modules
 * rely on; `postcss-simple-vars` exposes the breakpoints so component styles
 * reference the same values as the theme.
 */
const config = {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
  },
};

export default config;
