import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminRecurringExpensesPage from "./page";
import {
  recurringExpensesAdminApi,
  STAFF_MANAGED_RECURRING_EXPENSE_MESSAGE,
} from "@/lib/api/recurring-expenses";
import { ApiError } from "@/lib/api/client";
import type { RecurringExpense } from "@/lib/api/types";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/recurring-expenses"),
}));

vi.mock("@/lib/api/recurring-expenses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/recurring-expenses")>();
  return {
    ...actual,
    recurringExpensesAdminApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    recurringExpenseFormToPayload: vi.fn((values) => ({
      title: values.title.trim(),
      amount: values.amount,
      is_active: values.is_active,
      recurring: {
        interval: values.recurring.interval,
        time: values.recurring.time,
        ...(values.recurring.interval !== "DAILY" &&
        values.recurring.value != null
          ? { value: values.recurring.value }
          : {}),
      },
      ...(values.description?.trim()
        ? { description: values.description.trim() }
        : {}),
    })),
    formatRecurringScheduleSummary: vi.fn((recurring) => {
      const time = [
        recurring.time.hour,
        recurring.time.minute,
        recurring.time.second,
      ]
        .map((part: number) => String(part).padStart(2, "0"))
        .join(":");
      if (recurring.interval === "DAILY") return `Every day at ${time}`;
      if (recurring.interval === "DAY") return `Every Mon at ${time}`;
      return `Day ${recurring.value} of month at ${time}`;
    }),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const expense: RecurringExpense = {
  id: "re-1",
  title: "Office rent",
  description: "Monthly rent",
  amount: 5_000_000,
  is_active: true,
  recurring: {
    interval: "DAY",
    value: 1,
    time: { hour: 9, minute: 0, second: 0 },
  },
  next_run_at: "2026-07-21T09:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const staffManagedExpense: RecurringExpense = {
  ...expense,
  id: "re-staff-1",
  title: "Alice salary",
  staff_id: "staff-1",
};

describe("AdminRecurringExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recurringExpensesAdminApi.list).mockResolvedValue({
      data: [expense],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders list skeleton then data with page test id", async () => {
    render(<AdminRecurringExpensesPage />);

    expect(screen.getByTestId("recurring-expenses-page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create/i })).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();

    expect(await screen.findByText("Office rent")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(5_000_000))).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
  });

  it("opens create dialog when Create is clicked", async () => {
    const user = userEvent.setup();

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.click(screen.getByRole("button", { name: /Create/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add recurring expense")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.type(screen.getByPlaceholderText("Search by title"), "office");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(recurringExpensesAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "office",
      });
    });

    vi.useRealTimers();
  });

  it("creates a recurring expense from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(recurringExpensesAdminApi.create).mockResolvedValue({
      data: {
        ...expense,
        id: "re-2",
        title: "Utilities",
        amount: 50_000,
      },
    });

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.click(screen.getByRole("button", { name: /Create/i }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Utilities");
    await user.clear(within(dialog).getByLabelText("Amount (Rp)"));
    await user.type(within(dialog).getByLabelText("Amount (Rp)"), "50000");
    await user.selectOptions(within(dialog).getByLabelText("Weekday"), "1");
    await user.clear(within(dialog).getByLabelText("Hour"));
    await user.type(within(dialog).getByLabelText("Hour"), "9");
    await user.clear(within(dialog).getByLabelText("Minute"));
    await user.type(within(dialog).getByLabelText("Minute"), "0");
    await user.clear(within(dialog).getByLabelText("Second"));
    await user.type(within(dialog).getByLabelText("Second"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(recurringExpensesAdminApi.create).toHaveBeenCalledWith({
        title: "Utilities",
        amount: 50_000,
        is_active: true,
        recurring: {
          interval: "DAY",
          value: 1,
          time: { hour: 9, minute: 0, second: 0 },
        },
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Recurring expense created");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits DAILY schedule without value field", async () => {
    const user = userEvent.setup();
    vi.mocked(recurringExpensesAdminApi.create).mockResolvedValue({
      data: {
        ...expense,
        id: "re-3",
        title: "Daily fee",
        recurring: {
          interval: "DAILY",
          time: { hour: 8, minute: 30, second: 0 },
        },
      },
    });

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.click(screen.getByRole("button", { name: /Create/i }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Daily fee");
    await user.clear(within(dialog).getByLabelText("Amount (Rp)"));
    await user.type(within(dialog).getByLabelText("Amount (Rp)"), "10000");
    await user.selectOptions(
      within(dialog).getByLabelText("Schedule interval"),
      "DAILY",
    );
    expect(
      within(dialog).queryByTestId("recurring-expense-value-field"),
    ).not.toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Hour"));
    await user.type(within(dialog).getByLabelText("Hour"), "8");
    await user.clear(within(dialog).getByLabelText("Minute"));
    await user.type(within(dialog).getByLabelText("Minute"), "30");
    await user.clear(within(dialog).getByLabelText("Second"));
    await user.type(within(dialog).getByLabelText("Second"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(recurringExpensesAdminApi.create).toHaveBeenCalledWith({
        title: "Daily Fee",
        amount: 10_000,
        is_active: true,
        recurring: {
          interval: "DAILY",
          time: { hour: 8, minute: 30, second: 0 },
        },
      });
    });
  });

  it("edits a recurring expense from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(recurringExpensesAdminApi.update).mockResolvedValue({
      data: {
        ...expense,
        title: "Updated rent",
        amount: 6_000_000,
      },
    });

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.click(screen.getByLabelText("Edit recurring expense"));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Updated rent");
    await user.clear(screen.getByLabelText("Amount (Rp)"));
    await user.type(screen.getByLabelText("Amount (Rp)"), "6000000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(recurringExpensesAdminApi.update).toHaveBeenCalledWith("re-1", {
        title: "Updated Rent",
        description: "Monthly rent",
        amount: 6_000_000,
        is_active: true,
        recurring: {
          interval: "DAY",
          value: 1,
          time: { hour: 9, minute: 0, second: 0 },
        },
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Recurring expense updated");
  });

  it("deletes a recurring expense after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(recurringExpensesAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.click(screen.getByLabelText("Delete recurring expense"));
    expect(screen.getByText("Delete recurring expense")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(recurringExpensesAdminApi.delete).toHaveBeenCalledWith("re-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Recurring expense deleted");
  });

  it("maps server validation errors onto form fields", async () => {
    const user = userEvent.setup();
    vi.mocked(recurringExpensesAdminApi.create).mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        amount: "Amount must be positive",
      }),
    );

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.click(screen.getByRole("button", { name: /Create/i }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Title"), "Utilities");
    await user.clear(within(dialog).getByLabelText("Amount (Rp)"));
    await user.type(within(dialog).getByLabelText("Amount (Rp)"), "50000");
    await user.selectOptions(within(dialog).getByLabelText("Weekday"), "1");
    await user.clear(within(dialog).getByLabelText("Hour"));
    await user.type(within(dialog).getByLabelText("Hour"), "9");
    await user.clear(within(dialog).getByLabelText("Minute"));
    await user.type(within(dialog).getByLabelText("Minute"), "0");
    await user.clear(within(dialog).getByLabelText("Second"));
    await user.type(within(dialog).getByLabelText("Second"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText("Amount must be positive"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows Staff salary badge for staff-managed recurring expense", async () => {
    vi.mocked(recurringExpensesAdminApi.list).mockResolvedValue({
      data: [staffManagedExpense],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminRecurringExpensesPage />);

    expect(await screen.findByText("Alice salary")).toBeInTheDocument();
    expect(screen.getByTestId("staff-salary-badge")).toHaveTextContent(
      "Staff salary",
    );
  });

  it("hides edit and delete actions for staff-managed recurring expense", async () => {
    vi.mocked(recurringExpensesAdminApi.list).mockResolvedValue({
      data: [staffManagedExpense],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminRecurringExpensesPage />);

    await screen.findByText("Alice salary");

    expect(
      screen.queryByLabelText("Edit recurring expense"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Delete recurring expense"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("View only")).toBeInTheDocument();
  });

  it("keeps edit and delete actions for manual recurring expense", async () => {
    render(<AdminRecurringExpensesPage />);

    await screen.findByText("Office rent");

    expect(
      screen.getByLabelText("Edit recurring expense"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Delete recurring expense"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("staff-salary-badge")).not.toBeInTheDocument();
  });

  it("shows user-friendly toast when edit returns 409 for staff-managed expense", async () => {
    const user = userEvent.setup();
    vi.mocked(recurringExpensesAdminApi.list).mockResolvedValue({
      data: [expense, staffManagedExpense],
      meta: { page: 1, per_page: 10, total: 2 },
    });
    vi.mocked(recurringExpensesAdminApi.update).mockRejectedValue(
      new ApiError(
        409,
        "conflict",
        "Recurring expense is managed via staff salary",
      ),
    );

    render(<AdminRecurringExpensesPage />);
    await screen.findByText("Office rent");

    await user.click(screen.getByLabelText("Edit recurring expense"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        STAFF_MANAGED_RECURRING_EXPENSE_MESSAGE,
      );
    });
  });
});
