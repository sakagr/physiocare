import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";

/**
 * The single Mantine theme — the one token source for the whole application
 * (AGENTS.md → Design System). It implements the design language defined in
 * UX.md → Visual Foundation: calm and clinical, a muted teal on cool
 * neutrals, generous whitespace, restrained accents.
 *
 * Components reference these tokens (`theme.colors.teal[6]`, `radius="md"`,
 * `c="dimmed"`), never literal hex values or pixel sizes. V1 ships a light
 * color scheme only; every surface, text, and border token is semantic, so a
 * dark scheme can be added later without reworking components.
 */

/** Primary — desaturated blue-green. Base (shade 6) is the Visual Foundation's `#158B81`. */
const teal: MantineColorsTuple = [
  "#E8F5F3",
  "#D3EBE8",
  "#A8D8D2",
  "#7BC4BB",
  "#55B1A6",
  "#319E92",
  "#158B81", // base
  "#0F7168",
  "#0A5850",
  "#063F39",
];

/**
 * Neutrals — cool gray, tuned to sit with the teal. This overrides Mantine's
 * default `gray` so every component that reaches for a neutral (borders,
 * dimmed text, placeholders) lands on the Visual Foundation's values.
 */
const gray: MantineColorsTuple = [
  "#F7F9F9", // page background
  "#EFF3F3",
  "#DCE3E3", // borders
  "#C4CFCF",
  "#A6B4B4",
  "#8A9898",
  "#5F6C6C", // secondary text
  "#495454",
  "#37403F",
  "#2A3333", // primary text
];

const success: MantineColorsTuple = [
  "#E7F4EC",
  "#CDE8D8",
  "#9CD0B2",
  "#6BB88C",
  "#45A26D",
  "#2C8C58",
  "#1F7A4D", // base
  "#186340",
  "#124C31",
  "#0B3521",
];

const warning: MantineColorsTuple = [
  "#FDF2E3",
  "#F9E3C4",
  "#F0C687",
  "#E5A94C",
  "#D68F20",
  "#C47A0B",
  "#B26A00", // base
  "#925700",
  "#714400",
  "#503000",
];

const danger: MantineColorsTuple = [
  "#FCEBEA",
  "#F8D5D3",
  "#EFA9A5",
  "#E57D77",
  "#D95950",
  "#C63F35",
  "#B3261E", // base
  "#941E18",
  "#731712",
  "#52100D",
];

const info: MantineColorsTuple = [
  "#E9F2F9",
  "#D0E3F1",
  "#A0C6E2",
  "#70A9D3",
  "#4A90C4",
  "#2C7DB5",
  "#1F6FA8", // base
  "#195B8A",
  "#13466B",
  "#0D314B",
];

/**
 * The semantic roles a status may carry. `StatusBadge` (Increment 3) maps a
 * domain status onto one of these; the domain → role mapping itself lives in
 * the owning feature, never here.
 */
export const SEMANTIC_ROLES = [
  "success",
  "warning",
  "danger",
  "info",
  "neutral",
] as const;

export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

/**
 * Inter is loaded by the root layout via `next/font/google` and exposed as
 * this CSS variable, so the theme references the font without importing it
 * (keeping the theme usable in tests and Server Components alike).
 */
const FONT_FAMILY =
  "var(--font-inter), -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

export const theme = createTheme({
  primaryColor: "teal",
  /**
   * Filled and active primary controls render on shade 7 (`#0F7168`), which
   * carries white text at 5.86:1 — AA for normal text, which is what a filled
   * button label is. The brand base at shade 6 (`#158B81`) measures 4.17:1:
   * enough for UI components and large text, short of the 4.5:1 body-text
   * threshold. Shade 6 remains the base the palette is built around and is
   * still what tints, accents, and borders derive from.
   */
  primaryShade: 7,
  colors: { teal, gray, success, warning, danger, info },
  white: "#FFFFFF",
  black: "#2A3333",

  fontFamily: FONT_FAMILY,
  fontFamilyMonospace:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSizes: {
    xs: "0.75rem", // 12 — caption
    sm: "0.8125rem", // 13
    md: "0.875rem", // 14 — body default: tables, forms, detail
    lg: "1.125rem", // 18 — section title
    xl: "1.5rem", // 24 — page title
  },
  lineHeights: {
    xs: "1.4",
    sm: "1.45",
    md: "1.55",
    lg: "1.5",
    xl: "1.35",
  },
  fontWeights: {
    regular: "400",
    medium: "500",
    bold: "500", // Only two weights ship; bold resolves to medium.
  },
  headings: {
    fontFamily: FONT_FAMILY,
    fontWeight: "500",
    textWrap: "pretty",
    sizes: {
      h1: { fontSize: "1.5rem", lineHeight: "1.35" }, // page title
      h2: { fontSize: "1.125rem", lineHeight: "1.4" }, // section
      h3: { fontSize: "1rem", lineHeight: "1.45" },
      h4: { fontSize: "0.875rem", lineHeight: "1.5" },
      h5: { fontSize: "0.8125rem", lineHeight: "1.5" },
      h6: { fontSize: "0.75rem", lineHeight: "1.5" },
    },
  },

  // Radii 4 / 8 / 12 — soft but not playful. Inputs take the default (4);
  // cards and dialogs opt up via the component defaults below.
  radius: {
    xs: "0.125rem", // 2
    sm: "0.25rem", // 4 — inputs
    md: "0.5rem", // 8 — cards, panels
    lg: "0.75rem", // 12 — dialogs, drawers
    xl: "1rem", // 16
  },
  defaultRadius: "sm",

  // Spacing on a 4px base, favouring whitespace over density.
  spacing: {
    xs: "0.25rem", // 4
    sm: "0.5rem", // 8
    md: "1rem", // 16
    lg: "1.5rem", // 24
    xl: "2rem", // 32
  },

  // Accessibility foundations (UX.md → Accessibility): keyboard-only focus
  // ring, honored reduced-motion preference, pointer affordance.
  respectReducedMotion: true,
  focusRing: "auto",
  cursorType: "pointer",

  components: {
    Card: { defaultProps: { radius: "md", withBorder: true } },
    Paper: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { radius: "lg", centered: true } },
    Drawer: { defaultProps: { position: "right" } },
    Tooltip: { defaultProps: { withArrow: true } },
  },

  other: {
    /** Page background behind the shell's content region. */
    pageBackground: gray[0],
  },
});

/**
 * Maps the neutral scale onto Mantine's surface variables so the page reads
 * cool-gray while cards and panels stay white, in one place rather than in
 * every component.
 */
export const cssVariablesResolver: CSSVariablesResolver = (t) => ({
  variables: {},
  light: {
    "--mantine-color-body": t.white,
    "--mantine-color-text": t.colors.gray[9],
    "--mantine-color-dimmed": t.colors.gray[6],
    "--mantine-color-page": t.colors.gray[0],
  },
  dark: {},
});
