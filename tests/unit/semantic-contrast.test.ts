import { describe, expect, it } from "vitest";
import type { MantineColorsTuple } from "@mantine/core";
import { SEMANTIC_ROLES, theme, type SemanticRole } from "@/lib/theme";

/**
 * The semantic-role contrast audit, kept as an executable guard.
 *
 * `UX.md` → Accessibility targets WCAG 2.2 AA, and `StatusBadge` is where the
 * semantic roles first carry text. Rather than measuring once and writing the
 * numbers in a document nobody re-runs, the measurement lives here: a palette
 * edit, a new role, or a change to `theme.primaryShade` fails the build
 * instead of silently dropping a status below AA.
 *
 * Two renderings are audited, because those are the two Mantine actually
 * produces (verified against `get-css-color-variables.mjs` in the installed
 * package — Mantine 9 changed this from the v7/v8 alpha-tint model):
 *
 *   variant="light"  → `--mantine-color-{role}-9` text on `-1` background
 *   variant="filled" → white text on `-{theme.primaryShade}` background
 *
 * `filled` is the reason `primaryShade` appears here at all: it is a *global*
 * setting, so the shade chosen for the primary teal also decides every
 * semantic role's filled background. That coupling is exactly what this test
 * pins down.
 */

/** WCAG 2.1 relative luminance for an 8-bit sRGB channel. */
function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16)
  );
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** WCAG contrast ratio between two opaque colors. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.2 AA, normal-size text. A badge label is normal-size text. */
const AA_NORMAL_TEXT = 4.5;

const WHITE = "#FFFFFF";

/** `neutral` has no scale of its own — it renders through Mantine's gray. */
const ROLE_COLOR: Record<SemanticRole, string> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "gray",
};

function scaleFor(role: SemanticRole): MantineColorsTuple {
  const scale = theme.colors?.[ROLE_COLOR[role]];
  if (!scale) {
    throw new Error(`Theme has no scale for semantic role "${role}"`);
  }
  return scale as MantineColorsTuple;
}

describe("semantic role contrast", () => {
  it("covers every role the design system exposes", () => {
    // Guards the audit itself: a role added to SEMANTIC_ROLES without a scale
    // fails here rather than shipping unmeasured.
    for (const role of SEMANTIC_ROLES) {
      expect(scaleFor(role)).toHaveLength(10);
    }
  });

  describe.each(SEMANTIC_ROLES)("%s", (role) => {
    it("meets AA for normal text in the light variant (StatusBadge)", () => {
      const scale = scaleFor(role);
      // Mantine 9: light variant is shade 9 text on a solid shade 1 surface.
      const ratio = contrastRatio(scale[9], scale[1]);
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it("meets AA for white text on the filled background", () => {
      const scale = scaleFor(role);
      const primaryShade = theme.primaryShade as number;
      // Reverting `primaryShade` to 6 drops warning to 4.24:1 and fails here.
      const ratio = contrastRatio(WHITE, scale[primaryShade]);
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });

  it("records the measured ratios so a palette edit shows up as a diff", () => {
    const measured = Object.fromEntries(
      SEMANTIC_ROLES.map((role) => {
        const scale = scaleFor(role);
        return [
          role,
          {
            light: Number(contrastRatio(scale[9], scale[1]).toFixed(2)),
            filled: Number(
              contrastRatio(WHITE, scale[theme.primaryShade as number]).toFixed(2)
            ),
          },
        ];
      })
    );

    expect(measured).toEqual({
      success: { light: 10.44, filled: 7.25 },
      warning: { light: 9.53, filled: 5.86 },
      danger: { light: 10.74, filled: 8.54 },
      info: { light: 10.23, filled: 7.23 },
      neutral: { light: 11.6, filled: 7.84 },
    });
  });

  it("documents the shade-6 exposure that made the primaryShade decision matter", () => {
    // Historical record: white on `warning` shade 6 is below AA. Nothing
    // renders it today (filled resolves through primaryShade = 7), but if a
    // caller ever passes an explicit `color="warning.6"`, this is the number
    // they would be shipping.
    const warning = scaleFor("warning");
    expect(contrastRatio(WHITE, warning[6])).toBeLessThan(AA_NORMAL_TEXT);
    expect(Number(contrastRatio(WHITE, warning[6]).toFixed(2))).toBe(4.24);
  });
});
