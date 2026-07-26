import { describe, expect, it } from "vitest";
import { theme, SEMANTIC_ROLES } from "@/lib/theme";

/**
 * The theme is the single token source every later F-phase consumes
 * (AGENTS.md → Design System). These assertions guard the token contract
 * defined in UX.md → Visual Foundation, so a later edit that drops a
 * semantic role or changes the type scale fails here rather than silently
 * changing every screen.
 */
describe("theme", () => {
  it("uses the calm-clinical teal as the primary color", () => {
    expect(theme.primaryColor).toBe("teal");
    expect(theme.colors?.teal).toHaveLength(10);
    // Shade 6 is the brand base defined by the Visual Foundation.
    expect(theme.colors?.teal?.[6]).toBe("#158B81");
  });

  it("renders filled primary controls on a shade that meets AA for body text", () => {
    // Shade 6 (#158B81) carries white text at 4.17:1 — short of the 4.5:1
    // normal-text threshold that a filled button label must meet. Shade 7
    // (#0F7168) measures 5.86:1. Locking this in: a change back to 6 would
    // silently drop every primary button below AA.
    expect(theme.primaryShade).toBe(7);
    expect(theme.colors?.teal?.[7]).toBe("#0F7168");
  });

  it("defines the cool-gray neutrals as page, border, and text tokens", () => {
    expect(theme.colors?.gray?.[0]).toBe("#F7F9F9"); // page
    expect(theme.colors?.gray?.[2]).toBe("#DCE3E3"); // border
    expect(theme.colors?.gray?.[6]).toBe("#5F6C6C"); // secondary text
    expect(theme.colors?.gray?.[9]).toBe("#2A3333"); // primary text
  });

  it("defines every semantic role with a full scale for tints", () => {
    const expected = {
      success: "#1F7A4D",
      warning: "#B26A00",
      danger: "#B3261E",
      info: "#1F6FA8",
    };

    for (const [role, base] of Object.entries(expected)) {
      expect(theme.colors?.[role]).toHaveLength(10);
      expect(theme.colors?.[role]?.[6]).toBe(base);
    }

    // StatusBadge (Increment 3) maps domain statuses onto exactly these roles.
    expect(SEMANTIC_ROLES).toEqual([
      "success",
      "warning",
      "danger",
      "info",
      "neutral",
    ]);
  });

  it("applies the type scale: body 14, section 18, page title 24, caption 12", () => {
    expect(theme.fontSizes?.xs).toBe("0.75rem"); // 12 — caption
    expect(theme.fontSizes?.md).toBe("0.875rem"); // 14 — body default
    expect(theme.fontSizes?.lg).toBe("1.125rem"); // 18 — section
    expect(theme.fontSizes?.xl).toBe("1.5rem"); // 24 — page title
    expect(theme.headings?.sizes?.h1?.fontSize).toBe("1.5rem");
    expect(theme.headings?.sizes?.h2?.fontSize).toBe("1.125rem");
  });

  it("uses only regular and medium weights", () => {
    expect(theme.headings?.fontWeight).toBe("500");
    expect(theme.fontWeights?.regular).toBe("400");
    expect(theme.fontWeights?.medium).toBe("500");
  });

  it("applies the 4 / 8 / 12 radius scale and a 4px spacing base", () => {
    expect(theme.radius?.sm).toBe("0.25rem"); // 4 — inputs
    expect(theme.radius?.md).toBe("0.5rem"); // 8 — cards
    expect(theme.radius?.lg).toBe("0.75rem"); // 12 — dialogs
    expect(theme.defaultRadius).toBe("sm");

    // Every spacing step is a multiple of the 4px base.
    for (const value of Object.values(theme.spacing ?? {})) {
      const px = Number.parseFloat(value as string) * 16;
      expect(px % 4).toBe(0);
    }
  });

  it("encodes the accessibility foundations", () => {
    expect(theme.respectReducedMotion).toBe(true);
    expect(theme.focusRing).toBe("auto");
    expect(theme.cursorType).toBe("pointer");
  });
});
