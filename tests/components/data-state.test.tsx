import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Skeleton } from "@mantine/core";
import { DataState, EmptyState } from "@/components/ui";
import { ApiError } from "@/lib/api/api-error";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * Every data-driven surface moves through the same states with the same
 * treatment (UX.md → State model), so the triad lives here rather than being
 * re-implemented per destination.
 */
describe("DataState", () => {
  const skeleton = <Skeleton data-testid="skeleton" height={40} />;
  const empty = <EmptyState title="No patients yet" />;

  it("shows the layout-matched skeleton while loading", () => {
    renderWithProviders(
      <DataState isLoading skeleton={skeleton}>
        <p>content</p>
      </DataState>
    );

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText("content")).toBeNull();
  });

  it("shows the empty state when there is nothing to show", () => {
    renderWithProviders(
      <DataState isLoading={false} isEmpty empty={empty} skeleton={skeleton}>
        <p>content</p>
      </DataState>
    );

    expect(screen.getByText("No patients yet")).toBeInTheDocument();
    expect(screen.queryByText("content")).toBeNull();
  });

  it("shows the content once loaded and non-empty", () => {
    renderWithProviders(
      <DataState isLoading={false} skeleton={skeleton}>
        <p>content</p>
      </DataState>
    );

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });

  it("renders a scoped error with the shared human message", () => {
    renderWithProviders(
      <DataState
        isLoading={false}
        isError
        error={new ApiError("nope", 404, "NOT_FOUND")}
        skeleton={skeleton}
      >
        <p>content</p>
      </DataState>
    );

    const alert = screen.getByRole("alert");
    // Copy comes from the single code→behavior map, not from this component.
    expect(alert).toHaveTextContent("We couldn't find what you were looking for.");
    expect(screen.queryByText("content")).toBeNull();
  });

  it("falls back to generic copy for a non-ApiError failure", () => {
    renderWithProviders(
      <DataState isLoading={false} isError error={new Error("boom")} skeleton={skeleton}>
        <p>content</p>
      </DataState>
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again."
    );
  });

  it("offers a scoped retry only when the caller can refetch", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    const { unmount } = renderWithProviders(
      <DataState isLoading={false} isError error={new Error("boom")} onRetry={onRetry} skeleton={skeleton}>
        <p>content</p>
      </DataState>
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    unmount();

    renderWithProviders(
      <DataState isLoading={false} isError error={new Error("boom")} skeleton={skeleton}>
        <p>content</p>
      </DataState>
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("prefers the error over a stale loading flag", () => {
    // A failed refetch must not leave the user watching an endless skeleton.
    renderWithProviders(
      <DataState isLoading isError error={new Error("boom")} skeleton={skeleton}>
        <p>content</p>
      </DataState>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });
});
