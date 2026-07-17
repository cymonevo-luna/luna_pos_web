import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminStaffPage from "./page";
import { staffAdminApi } from "@/lib/api/staff";
import type { Staff } from "@/lib/api/types";
import { formatRupiah } from "@/lib/utils";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/staff"),
}));

vi.mock("@/lib/api/staff", () => ({
  staffAdminApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  staffFormToPayload: vi.fn((values) => ({
    name: values.name.trim(),
    nik: values.nik.trim(),
    address: values.address,
    job_title: values.job_title,
    salary_amount:
      values.salary_amount === undefined || Number.isNaN(values.salary_amount)
        ? 0
        : values.salary_amount,
    ...(values.ktp_photo_url?.trim()
      ? { ktp_photo_url: values.ktp_photo_url.trim() }
      : {}),
    ...(values.benefits?.trim() ? { benefits: values.benefits.trim() } : {}),
  })),
}));

vi.mock("@/lib/api/uploads", () => ({
  uploadStaffKtpPhoto: vi.fn(),
  validateMenuPhotoFile: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const staffMember: Staff = {
  id: "staff-1",
  name: "Budi Santoso",
  nik: "3201010101010001",
  address: "Jl. Merdeka No. 1",
  job_title: "Cashier",
  salary_amount: 5_000_000,
  ktp_photo_url: null,
  benefits: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminStaffPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(staffAdminApi.list).mockResolvedValue({
      data: [staffMember],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders staff from the API with formatted salary", async () => {
    render(<AdminStaffPage />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("3201010101010001")).toBeInTheDocument();
    expect(screen.getByText("Cashier")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(5_000_000))).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Staff" })).toBeInTheDocument();
  });

  it("shows Not set for zero salary", async () => {
    vi.mocked(staffAdminApi.list).mockResolvedValue({
      data: [{ ...staffMember, salary_amount: 0 }],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminStaffPage />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByText(formatRupiah(0))).not.toBeInTheDocument();
    expect(screen.getByTestId("staff-recurring-payout-none")).toHaveTextContent(
      "—",
    );
  });

  it("shows Active recurring payout when staff is linked", async () => {
    vi.mocked(staffAdminApi.list).mockResolvedValue({
      data: [
        {
          ...staffMember,
          salary_amount: 5_000_000,
          recurring_expense_id: "recurring-expense-1",
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminStaffPage />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByTestId("staff-recurring-payout-active")).toHaveTextContent(
      "Active",
    );
  });

  it("shows dash for recurring payout when staff has no salary link", async () => {
    vi.mocked(staffAdminApi.list).mockResolvedValue({
      data: [
        {
          ...staffMember,
          salary_amount: 0,
          recurring_expense_id: null,
        },
      ],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminStaffPage />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByTestId("staff-recurring-payout-none")).toHaveTextContent(
      "—",
    );
  });

  it("shows recurring payout Active after creating staff with salary", async () => {
    const user = userEvent.setup();
    const createdStaff: Staff = {
      ...staffMember,
      id: "staff-new",
      salary_amount: 5_000_000,
      recurring_expense_id: "recurring-expense-new",
    };

    vi.mocked(staffAdminApi.create).mockResolvedValue({ data: createdStaff });
    vi.mocked(staffAdminApi.list)
      .mockResolvedValueOnce({
        data: [],
        meta: { page: 1, per_page: 10, total: 0 },
      })
      .mockResolvedValueOnce({
        data: [createdStaff],
        meta: { page: 1, per_page: 10, total: 1 },
      });

    render(<AdminStaffPage />);
    await screen.findByText("No staff found.");

    await user.click(screen.getByRole("button", { name: /Add staff/i }));
    await user.type(within(screen.getByRole("dialog")).getByLabelText("Name"), "New Staff");
    await user.type(
      within(screen.getByRole("dialog")).getByLabelText("NIK"),
      "3201010101010099",
    );
    await user.type(
      within(screen.getByRole("dialog")).getByLabelText("Address"),
      "Jl. Baru No. 1",
    );
    await user.type(
      within(screen.getByRole("dialog")).getByLabelText("Job title"),
      "Barista",
    );
    await user.clear(within(screen.getByRole("dialog")).getByLabelText(/Salary/));
    await user.type(
      within(screen.getByRole("dialog")).getByLabelText(/Salary/),
      "5000000",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Add staff" }),
    );

    await waitFor(() => {
      expect(staffAdminApi.create).toHaveBeenCalled();
    });
    expect(await screen.findByTestId("staff-recurring-payout-active")).toHaveTextContent(
      "Active",
    );
  });

  it("opens edit dialog when Add staff is clicked", async () => {
    const user = userEvent.setup();

    render(<AdminStaffPage />);
    await screen.findByText("Budi Santoso");

    await user.click(screen.getByRole("button", { name: /Add staff/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add staff", { selector: "h3" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByLabelText("Name")).toBeInTheDocument();
  });

  it("shows delete confirmation overlay", async () => {
    const user = userEvent.setup();

    render(<AdminStaffPage />);
    await screen.findByText("Budi Santoso");

    await user.click(screen.getByLabelText("Delete staff"));

    expect(screen.getByText("Delete staff", { selector: "h3" })).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminStaffPage />);
    await screen.findByText("Budi Santoso");

    await user.type(
      screen.getByPlaceholderText("Search by name, NIK, or job title"),
      "budi",
    );
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(staffAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "budi",
      });
    });

    vi.useRealTimers();
  });
});
