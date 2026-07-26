import { Badge, type BadgeProps } from "@mantine/core";
import type { SemanticRole } from "@/lib/theme";

/**
 * A status rendered as a semantic role, carrying both color and text.
 *
 * `label` is required: that is the whole point of the primitive. A status
 * shown as a bare colored dot fails `UX.md` → Accessibility ("color is never
 * the only cue for meaning"), and making the text non-optional means it
 * cannot be omitted by accident.
 *
 * The primitive is domain-blind. Mapping an appointment, payment, or package
 * status onto one of these roles belongs to the feature that owns that domain
 * (AGENTS.md → Shared UI primitives); `StatusBadge` never learns those names.
 *
 * Renders Mantine's `light` variant — shade 9 text on a shade 1 surface —
 * which `tests/unit/semantic-contrast.test.ts` measures against WCAG AA.
 */

/** `neutral` has no scale of its own; it renders through the gray neutrals. */
const ROLE_COLOR: Record<SemanticRole, string> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "gray",
};

export interface StatusBadgeProps
  extends Omit<BadgeProps, "color" | "variant" | "children" | "leftSection"> {
  /** The semantic role the status carries. */
  role: SemanticRole;
  /** The status in words. Required — the text half of the cue. */
  label: string;
  /** Optional supporting icon; never a replacement for the label. */
  icon?: React.ReactNode;
}

export function StatusBadge({
  role,
  label,
  icon,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      color={ROLE_COLOR[role]}
      variant="light"
      leftSection={icon}
      {...props}
    >
      {label}
    </Badge>
  );
}
