import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApiExplorer } from "@/features/platform-api";
import type { OpenApiDocument } from "@/features/platform-api";
import { renderWithProviders, screen, waitFor, within } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

const fixtureDoc: OpenApiDocument = {
  openapi: "3.1.0",
  info: { title: "Fixture API", version: "1.0.0", description: "d" },
  paths: {
    "/api/patients": {
      get: {
        summary: "List patients",
        tags: ["Patients"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "search", in: "query", required: false, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create a patient",
        tags: ["Patients"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { fullName: { type: "string" } }, required: ["fullName"] } } },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/user-clinics": {
      delete: {
        summary: "Remove a clinic assignment",
        tags: ["User Clinics"],
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "userId", in: "query", required: true, schema: { type: "string" } },
          { name: "clinicId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "Sign out",
        tags: ["Auth"],
        security: [],
        responses: { "204": { description: "Signed out" } },
        "x-warning": "Running this operation replaces or ends your own Super Admin session immediately.",
      },
    },
    "/api/reports/billing/export": {
      get: {
        summary: "Export the billing report",
        tags: ["Reports"],
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "File" } },
      },
    },
    "/api/patients/{id}/records": {
      post: {
        summary: "Upload a patient record",
        tags: ["Patients"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  file: { type: "string", format: "binary", description: "The record file." },
                },
                required: ["title", "file"],
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
  },
  components: { schemas: {}, securitySchemes: {} },
};

function mockFetchOnce(response: { status: number; headers?: Record<string, string>; body?: unknown }) {
  const headers = new Headers(response.headers ?? { "content-type": "application/json" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status: response.status,
      statusText: "",
      headers,
      text: async () => (response.body === undefined ? "" : JSON.stringify(response.body)),
      blob: async () => new Blob(["binary"]),
    }))
  );
}

async function renderExplorer() {
  get.mockResolvedValue(fixtureDoc);
  renderWithProviders(<ApiExplorer />);
  await screen.findByText("Patients");
}

describe("ApiExplorer", () => {
  it("groups operations by tag and lets the filter narrow them", async () => {
    await renderExplorer();

    expect(screen.getByText("Patients")).toBeInTheDocument();
    expect(screen.getByText("Auth")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Filter operations"), "logout");

    expect(screen.queryByText("/api/patients")).toBeNull();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("shows method, path, and summary on selection, and marks it aria-current", async () => {
    await renderExplorer();
    const user = userEvent.setup();

    const item = screen.getByRole("button", { name: /GET.*\/api\/patients/ });
    await user.click(item);

    expect(item).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("heading", { name: "GET /api/patients" })).toBeInTheDocument();
    expect(screen.getAllByText("List patients").length).toBeGreaterThan(0);
  });

  it("moves focus to the detail heading on selection", async () => {
    await renderExplorer();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^GET \/api\/patients List patients$/ }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "GET /api/patients" })).toHaveFocus();
    });
  });

  it("submits try-it-out with credentials: include and renders a 200 JSON response", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^GET \/api\/patients List patients$/ }));

    mockFetchOnce({ status: 200, body: { items: [], total: 0 } });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/patients"),
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(await screen.findByText("200")).toBeInTheDocument();
    expect(screen.getByText(/"total": 0/)).toBeInTheDocument();
  });

  it("renders a 409-shaped error envelope with message, code, and issues", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^POST \/api\/patients Create a patient$/ }));

    mockFetchOnce({
      status: 409,
      body: { error: "Already exists", code: "EMAIL_ALREADY_EXISTS", details: [{ path: ["email"], message: "taken" }] },
    });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Already exists")).toBeInTheDocument();
    expect(screen.getByText(/EMAIL_ALREADY_EXISTS/)).toBeInTheDocument();
    expect(screen.getByText(/taken/)).toBeInTheDocument();
  });

  it("renders a 400 with no code without crashing (FL5)", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /DELETE/ }));

    await user.type(screen.getByLabelText(/^userId/), "u1");
    await user.type(screen.getByLabelText(/^clinicId/), "c1");

    mockFetchOnce({ status: 400, body: { error: "Missing userId or clinicId parameter" } });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Missing userId or clinicId parameter")).toBeInTheDocument();
  });

  it("renders a 204 as no content", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Sign out/ }));

    mockFetchOnce({ status: 204, headers: {} });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText(/No content/)).toBeInTheDocument();
  });

  it("offers a download for a binary export response instead of parsing JSON", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Export the billing report/ }));

    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock") });
    mockFetchOnce({
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="billing-report.pdf"',
      },
    });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    const link = await screen.findByRole("link", { name: /Download billing-report\.pdf/ });
    expect(link).toHaveAttribute("href", "blob:mock");
  });

  it("renders a file input for a multipart upload and sends FormData with no explicit Content-Type", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Upload a patient record/ }));

    const file = new File(["hello"], "scan.pdf", { type: "application/pdf" });
    // Mantine's FileInput associates its label with a button-styled trigger,
    // not the underlying <input type="file"> user-event needs -- query the
    // real input directly.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.type(screen.getByLabelText(/^title/), "Scan");

    mockFetchOnce({ status: 201, body: { id: "rec-1" } });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers.get("Content-Type")).toBeNull();
  });

  it("shows the session-replacement warning on an /api/auth/* operation", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Sign out/ }));

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/replaces or ends your own Super Admin session/)).toBeInTheDocument();
  });

  it("announces the response region as a live region", async () => {
    await renderExplorer();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^GET \/api\/patients List patients$/ }));

    mockFetchOnce({ status: 200, body: {} });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      const live = document.querySelector('[aria-live="polite"]');
      expect(live).not.toBeNull();
      expect(live?.textContent).toContain("200");
    });
  });
});
