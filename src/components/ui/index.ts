/**
 * The shared UI primitives (AGENTS.md → Shared UI primitives).
 *
 * Each composite exists because it encodes a convention from `UX.md` that
 * would otherwise be re-implemented — and drift — in every phase. All are
 * generic and domain-blind; anything domain-carrying belongs to its feature.
 *
 * Use Mantine **directly** for everything else. Wrapping `Button`, `Table`,
 * `Select`, `Tabs`, or the notification system one-to-one adds nothing.
 *
 * Curated barrel: explicit named exports, never `export *`.
 */
export { PageHeader, type PageHeaderProps, type PageHeaderAction } from "./page-header";
export { EmptyState, type EmptyStateProps, type EmptyStateAction } from "./empty-state";
export { DataState, type DataStateProps } from "./data-state";
export { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";
export { FormDialog, type FormDialogProps } from "./form-dialog";
export { DetailDrawer, type DetailDrawerProps } from "./detail-drawer";
export { StatusBadge, type StatusBadgeProps } from "./status-badge";
export { Can, useCan, type CanProps } from "./can";
export { ForbiddenState, type ForbiddenStateProps } from "./forbidden-state";
export { RevealOnce, type RevealOnceProps } from "./reveal-once";
