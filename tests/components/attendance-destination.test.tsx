import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { AttendancePageContent, MarkAttendanceDialog } from "@/features/attendance";
import type { Attendance, RecordAttendanceResult } from "@/types/contracts/attendance";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: vi.fn(), delete: vi.fn() },
}));

function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: "att-1",
    organization_id: "org-1",
    user_id: "user-physio",
    clinic_id: "clinic-north",
    attendance_date: "2026-09-01",
    check_in_time: "2026-09-01T09:00:00Z",
    check_out_time: null,
    status: "present",
    notes: null,
    unavailable_from: null,
    unavailable_to: null,
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-01T09:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function emptyResult(overrides: Partial<RecordAttendanceResult> = {}): RecordAttendanceResult {
  return {
    attendance: makeAttendance(),
    cancelledAppointmentIds: [],
    skippedCheckedInAppointmentIds: [],
    failedCancellationIds: [],
    failedNotificationAppointmentIds: [],
    ...overrides,
  };
}

function mockList(items: Attendance[]) {
  get.mockImplementation((path: string) => {
    if (path.startsWith("/api/attendance")) {
      return Promise.resolve({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });
    }
    return Promise.resolve([
      { id: "user-physio", full_name: "Dr Menon", role: { name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist" } },
    ]);
  });
}

describe("AttendancePageContent", () => {
  it("is reachable by every org role", async () => {
    for (const fixture of [
      currentUserFixtures.owner(),
      currentUserFixtures.admin(),
      currentUserFixtures.physiotherapist(),
      currentUserFixtures.receptionist(),
    ]) {
      mockList([makeAttendance()]);
      const { unmount } = renderWithProviders(<AttendancePageContent />, { currentUser: fixture });
      await waitFor(() => expect(screen.getAllByText("Attendance").length).toBeGreaterThan(0));
      unmount();
    }
  });

  it("shows the org-wide framing only to an overseer", async () => {
    mockList([makeAttendance()]);
    const { unmount } = renderWithProviders(<AttendancePageContent />, {
      currentUser: currentUserFixtures.owner(),
    });
    await waitFor(() => expect(screen.getAllByLabelText("Clinic").length).toBeGreaterThan(0));
    unmount();

    mockList([makeAttendance()]);
    renderWithProviders(<AttendancePageContent />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });
    await waitFor(() => expect(screen.getAllByText("2026-09-01").length).toBeGreaterThan(0));
    expect(screen.queryAllByLabelText("Clinic")).toHaveLength(0);
  });

  it("offers correction only to a caller who may manage others' attendance", async () => {
    mockList([makeAttendance()]);
    const { unmount } = renderWithProviders(<AttendancePageContent />, {
      currentUser: currentUserFixtures.receptionist(),
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Correct" })).toBeInTheDocument());
    unmount();

    mockList([makeAttendance()]);
    renderWithProviders(<AttendancePageContent />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });
    await waitFor(() => expect(screen.getAllByText("2026-09-01").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Correct" })).toBeNull();
  });
});

/**
 * The two capabilities **cross rather than nest** (D11), so the dialog gates
 * them independently and never derives one from the other.
 */
describe("MarkAttendanceDialog capability crossing", () => {
  it("gives a physiotherapist the self path and no staff picker", async () => {
    mockList([]);
    renderWithProviders(
      <MarkAttendanceDialog opened onClose={vi.fn()} canRecordOwn canManageOthers={false} />,
      { currentUser: currentUserFixtures.physiotherapist() }
    );

    expect(await screen.findByText("Mark attendance")).toBeInTheDocument();
    expect(screen.queryAllByLabelText("Staff member")).toHaveLength(0);
  });

  it("gives a receptionist the staff picker and never an implicit self default", async () => {
    mockList([]);
    renderWithProviders(
      <MarkAttendanceDialog opened onClose={vi.fn()} canRecordOwn={false} canManageOthers />,
      { currentUser: currentUserFixtures.receptionist() }
    );

    // A receptionist may not record their own attendance, so the picker must
    // not suggest that leaving it blank does so.
    const picker = (await screen.findAllByLabelText("Staff member"))[0];
    expect(picker).toHaveAttribute("placeholder", "Choose a staff member");
    expect(screen.queryByPlaceholderText("Myself")).toBeNull();
  });

  it("offers exactly the two pinned half-day windows, not free time inputs", async () => {
    mockList([]);
    renderWithProviders(
      <MarkAttendanceDialog opened onClose={vi.fn()} canRecordOwn canManageOthers={false} />,
      { currentUser: currentUserFixtures.physiotherapist() }
    );

    await userEvent.click((await screen.findAllByLabelText("Status"))[0]);
    await userEvent.click(await screen.findByRole("option", { name: "Half day" }));

    await userEvent.click((await screen.findAllByLabelText("Unavailable window"))[0]);
    expect(await screen.findByRole("option", { name: "Morning (09:00–14:00)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Afternoon (14:00–19:00)" })).toBeInTheDocument();
    // Two choices only: this is what designs out the silent window-discard the
    // server accepts, since a window can never be sent without half_day.
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("shows a stored window matching neither choice rather than snapping it", async () => {
    mockList([]);
    renderWithProviders(
      <MarkAttendanceDialog
        opened
        onClose={vi.fn()}
        canRecordOwn
        canManageOthers={false}
        correcting={{
          id: "att-1",
          status: "half_day",
          notes: null,
          // The availability migration's backfill value: a real row can carry
          // it, and it is neither pinned choice.
          unavailable_from: "09:00:00",
          unavailable_to: "13:00:00",
        }}
      />,
      { currentUser: currentUserFixtures.owner() }
    );

    const picker = (await screen.findAllByLabelText("Unavailable window"))[0];
    expect(picker).toHaveAttribute("placeholder", expect.stringContaining("09:00–13:00"));
  });

  it("reports every effect of a marking, not a bare success", async () => {
    mockList([]);
    post.mockResolvedValue(
      emptyResult({
        cancelledAppointmentIds: ["a1", "a2"],
        skippedCheckedInAppointmentIds: ["a3"],
        failedNotificationAppointmentIds: ["a4"],
      })
    );

    renderWithProviders(
      <MarkAttendanceDialog opened onClose={vi.fn()} canRecordOwn canManageOthers={false} />,
      { currentUser: currentUserFixtures.physiotherapist() }
    );

    await userEvent.click((await screen.findAllByLabelText("Status"))[0]);
    await userEvent.click(await screen.findByRole("option", { name: "Absent" }));
    await userEvent.click(screen.getByRole("button", { name: "Record" }));

    await waitFor(() => expect(screen.getByText(/2 appointment\(s\) cancelled/i)).toBeInTheDocument());
    expect(screen.getByText(/1 already checked in and left alone/i)).toBeInTheDocument();
    expect(screen.getByText(/1 patient\(s\) were not notified/i)).toBeInTheDocument();
  });
});
