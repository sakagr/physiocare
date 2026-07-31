import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { TextInput } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { ApiError } from "@/lib/api/api-error";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * Proves `renderWithProviders`' F3 extension (real cache-level error
 * dispatch + mounted `<Notifications />`): a failing mutation surfaces the
 * same toast production does, through the same `MutationCache.onError` path,
 * with no per-screen error handling. This is also D8's dedicated test —
 * subscription/limit enforcement (402/403) is deliberately generic in F3
 * (F4 owns the dedicated state), and a create dialog needs no bespoke
 * handling for it: `FormDialog` only closes from `onSuccess`, so the dialog
 * stays open with the user's input intact by construction.
 */
function CreateThingHarness({ failWith }: { failWith?: ApiError }) {
  const {
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm({ defaultValues: { name: "" } });

  const mutation = useMutation({
    mutationFn: async (values: { name: string }) => {
      if (failWith) {
        throw failWith;
      }
      return values;
    },
  });

  return (
    <FormDialog
      opened
      onClose={() => {}}
      title="Create thing"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <TextInput label="Name" {...register("name")} />
    </FormDialog>
  );
}

describe("renderWithProviders error dispatch (D8)", () => {
  it("toasts a 402 SUBSCRIPTION_REQUIRED and keeps the dialog open with input intact", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateThingHarness
        failWith={new ApiError("Organization does not have an active subscription", 402, "SUBSCRIPTION_REQUIRED")}
      />
    );

    await user.type(screen.getByLabelText("Name"), "New Clinic");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("An active subscription is required to do that.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Create thing" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("New Clinic");
  });

  it("toasts a 403 ORGANIZATION_LIMIT_EXCEEDED and keeps the dialog open with input intact", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateThingHarness
        failWith={new ApiError("Organization has reached its subscription plan's user limit", 403, "ORGANIZATION_LIMIT_EXCEEDED")}
      />
    );

    await user.type(screen.getByLabelText("Name"), "Ada Admin");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("You've reached your plan's limit.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Create thing" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Admin");
  });
});
