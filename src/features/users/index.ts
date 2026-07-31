/**
 * Public surface of the `users` feature (F3). Cross-feature imports go
 * through this barrel, never deep paths (AGENTS.md → Project Structure).
 * Explicit named exports only -- never `export *`.
 */
export {
  usersQueryKeys,
  usersListQueryOptions,
  userDetailQueryOptions,
  userCompensationQueryOptions,
} from "./queries";
export type { UserListFilters } from "./api";
export { UsersPageContent } from "./components/users-page-content";
export { UsersCollection } from "./components/users-collection";
export { CreateUserDialog, type CreateUserDialogProps } from "./components/create-user-dialog";
export { EditUserDialog, type EditUserDialogProps } from "./components/edit-user-dialog";
export { ChangeRoleDialog, type ChangeRoleDialogProps } from "./components/change-role-dialog";
export {
  ResetPasswordDialog,
  type ResetPasswordDialogProps,
} from "./components/reset-password-dialog";
export { CompensationSection } from "./components/compensation-section";
export { UserDetailDrawer, type UserDetailDrawerProps } from "./components/user-detail-drawer";
