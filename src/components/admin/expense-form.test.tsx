import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseForm } from "./expense-form";
import { uploadExpenseReceipt } from "@/lib/api/uploads";

vi.mock("@/lib/api/uploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/uploads")>();
  return {
    ...actual,
    uploadExpenseReceipt: vi.fn(),
  };
});

vi.mock("@/lib/hooks/use-cashier-balance", () => ({
  useCashierBalance: () => ({
    balance: { balance: 500_000 },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

function createImageFile(name = "receipt.jpg"): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, {
    type: "image/jpeg",
  });
}

describe("ExpenseForm", () => {
  it("blocks submit when title is too short", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ExpenseForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/^Title/), "A");
    await user.type(screen.getByLabelText(/^Amount/), "50000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/Title must be at least/),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit when amount is below minimum", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ExpenseForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/^Title/), "Office supplies");
    await user.type(screen.getByLabelText(/^Amount/), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/Amount must be at least/),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid values without receipt", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ExpenseForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/^Title/), "Office supplies");
    await user.type(screen.getByLabelText(/^Description/), "Printer paper");
    await user.type(screen.getByLabelText(/^Amount/), "150000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      title: "Office Supplies",
      description: "Printer paper",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
      receipt_url: "",
    });
  });

  it("uploads receipt on file select and includes receipt_url on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.mocked(uploadExpenseReceipt).mockResolvedValue({
      url: "https://cdn.example.com/receipt.jpg",
      filename: "receipt.jpg",
      size_bytes: 1024,
    });

    render(<ExpenseForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/^Title/), "Office supplies");
    await user.type(screen.getByLabelText(/^Amount/), "150000");

    const fileInput = screen.getByTestId("expense-receipt-file-input");
    await user.upload(fileInput, createImageFile());

    await waitFor(() => {
      expect(uploadExpenseReceipt).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      receipt_url: "https://cdn.example.com/receipt.jpg",
    });
  });

  it("clears receipt when remove is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadExpenseReceipt).mockResolvedValue({
      url: "https://cdn.example.com/receipt.jpg",
      filename: "receipt.jpg",
      size_bytes: 1024,
    });

    render(
      <ExpenseForm
        onSubmit={() => {}}
        onCancel={() => {}}
        defaultValues={{ receipt_url: "https://cdn.example.com/receipt.jpg" }}
      />,
    );

    expect(screen.getByTestId("expense-receipt-remove-button")).toBeInTheDocument();

    await user.click(screen.getByTestId("expense-receipt-remove-button"));

    expect(screen.queryByTestId("expense-receipt-remove-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("expense-receipt-choose-button")).toHaveTextContent(
      "Choose image",
    );
  });

  it("prefills edit values from defaultValues", () => {
    render(
      <ExpenseForm
        onSubmit={() => {}}
        onCancel={() => {}}
        defaultValues={{
          title: "Utilities",
          description: "Electric bill",
          amount: 250_000,
          receipt_url: "https://cdn.example.com/receipt.jpg",
        }}
      />,
    );

    expect(screen.getByLabelText(/^Title/)).toHaveValue("Utilities");
    expect(screen.getByLabelText(/^Description/)).toHaveValue("Electric bill");
    expect(screen.getByLabelText(/^Amount/)).toHaveValue(250_000);
    expect(screen.getByTestId("expense-receipt-remove-button")).toBeInTheDocument();
  });

  it("shows Source of Fund dropdown defaulting to Personal Money", () => {
    render(<ExpenseForm onSubmit={() => {}} onCancel={() => {}} />);

    const select = screen.getByTestId("expense-source-of-fund-select");
    expect(screen.getByLabelText("Source of Fund")).toBe(select);
    expect(select).toHaveValue("PERSONAL_MONEY");
    expect(screen.getByRole("option", { name: "Cashier" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Personal Money" }),
    ).toBeInTheDocument();
  });

  it("submits with Cashier source of fund when selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ExpenseForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText(/^Title/), "Petty cash");
    await user.type(screen.getByLabelText(/^Amount/), "50000");
    await user.selectOptions(
      screen.getByTestId("expense-source-of-fund-select"),
      "CASHIER",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      source_of_fund: "CASHIER",
    });
    expect(
      screen.getByTestId("expense-cashier-balance-hint"),
    ).toHaveTextContent("Current cashier balance:");
  });

  it("applies server errors for source_of_fund", async () => {
    const ref = React.createRef<import("./expense-form").ExpenseFormHandle>();

    render(
      <ExpenseForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    ref.current?.applyServerErrors({
      source_of_fund: "Insufficient cashier balance",
    });

    expect(
      await screen.findByTestId("expense-source-of-fund-error"),
    ).toHaveTextContent("Insufficient cashier balance");
  });

  it("title-cases the title on blur", async () => {
    const user = userEvent.setup();

    render(<ExpenseForm onSubmit={() => {}} onCancel={() => {}} />);

    const titleInput = screen.getByLabelText(/^Title/);
    await user.type(titleInput, "office supplies");
    await user.tab();

    expect(titleInput).toHaveValue("Office Supplies");
  });

  it("shows reporting date field when showRecordDate is true", () => {
    render(
      <ExpenseForm
        onSubmit={() => {}}
        onCancel={() => {}}
        showRecordDate
        defaultValues={{
          recordDate: new Date("2026-01-15T10:30:00"),
        }}
      />,
    );

    expect(screen.getByTestId("expense-record-date-section")).toBeInTheDocument();
    expect(screen.getByTestId("expense-record-date-input")).toBeInTheDocument();
    expect(
      screen.getByText("Reporting date used for cash-flow calculations."),
    ).toBeInTheDocument();
  });

  it("hides reporting date field by default", () => {
    render(<ExpenseForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(
      screen.queryByTestId("expense-record-date-section"),
    ).not.toBeInTheDocument();
  });

  it("blocks submit when reporting date is in the future", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);

    render(
      <ExpenseForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        showRecordDate
        defaultValues={{
          title: "Office supplies",
          amount: 150_000,
          recordDate: tomorrow,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByTestId("expense-record-date-error"),
    ).toHaveTextContent(/cannot be in the future/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("applies server errors for record_date", async () => {
    const ref = React.createRef<import("./expense-form").ExpenseFormHandle>();

    render(
      <ExpenseForm
        ref={ref}
        onSubmit={() => {}}
        onCancel={() => {}}
        showRecordDate
        defaultValues={{ recordDate: new Date("2026-01-01T00:00:00Z") }}
      />,
    );

    ref.current?.applyServerErrors({
      record_date: "Invalid reporting date",
    });

    expect(
      await screen.findByTestId("expense-record-date-error"),
    ).toHaveTextContent("Invalid reporting date");
  });
});
