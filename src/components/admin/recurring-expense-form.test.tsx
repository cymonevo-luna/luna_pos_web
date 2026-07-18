import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurringExpenseForm } from "./recurring-expense-form";

describe("RecurringExpenseForm", () => {
  it("hides value field for DAILY interval", async () => {
    const user = userEvent.setup();

    render(<RecurringExpenseForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(
      screen.getByTestId("recurring-expense-value-field"),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Schedule interval"),
      "DAILY",
    );

    expect(
      screen.queryByTestId("recurring-expense-value-field"),
    ).not.toBeInTheDocument();
  });

  it("shows weekday field for DAY interval", async () => {
    const user = userEvent.setup();

    render(<RecurringExpenseForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Weekday")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Schedule interval"),
      "DATE",
    );

    expect(screen.getByLabelText("Day of month")).toBeInTheDocument();
    expect(screen.queryByLabelText("Weekday")).not.toBeInTheDocument();
  });

  it("blocks submit when title is too short", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <RecurringExpenseForm onSubmit={onSubmit} onCancel={() => {}} />,
    );

    await user.type(screen.getByLabelText("Title"), "A");
    await user.type(screen.getByLabelText("Amount (Rp)"), "50000");
    await user.selectOptions(screen.getByLabelText("Weekday"), "1");
    await user.type(screen.getByLabelText("Hour"), "9");
    await user.type(screen.getByLabelText("Minute"), "0");
    await user.type(screen.getByLabelText("Second"), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/Title must be at least/),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid DAILY schedule without value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <RecurringExpenseForm onSubmit={onSubmit} onCancel={() => {}} />,
    );

    await user.type(screen.getByLabelText("Title"), "Utilities");
    await user.type(screen.getByLabelText("Amount (Rp)"), "50000");
    await user.selectOptions(
      screen.getByLabelText("Schedule interval"),
      "DAILY",
    );
    await user.clear(screen.getByLabelText("Hour"));
    await user.type(screen.getByLabelText("Hour"), "8");
    await user.clear(screen.getByLabelText("Minute"));
    await user.type(screen.getByLabelText("Minute"), "30");
    await user.clear(screen.getByLabelText("Second"));
    await user.type(screen.getByLabelText("Second"), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      title: "Utilities",
      amount: 50_000,
      is_active: true,
      recurring: {
        interval: "DAILY",
        time: { hour: 8, minute: 30, second: 0 },
      },
    });
  });

  it("shows is_active toggle only when showIsActive is true", () => {
    const { rerender } = render(
      <RecurringExpenseForm onSubmit={() => {}} onCancel={() => {}} />,
    );

    expect(screen.queryByLabelText("Active")).not.toBeInTheDocument();

    rerender(
      <RecurringExpenseForm
        onSubmit={() => {}}
        onCancel={() => {}}
        showIsActive
      />,
    );

    expect(screen.getByLabelText("Active")).toBeInTheDocument();
  });

  it("renders read-only state without submit button when readOnly is true", () => {
    render(
      <RecurringExpenseForm
        onSubmit={() => {}}
        onCancel={() => {}}
        readOnly
        defaultValues={{
          title: "Alice salary",
          amount: 5_000_000,
          is_active: true,
          recurring: {
            interval: "DATE",
            value: 1,
            time: { hour: 9, minute: 0, second: 0 },
          },
        }}
      />,
    );

    expect(
      screen.getByTestId("recurring-expense-readonly-notice"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("title-cases the title on blur", async () => {
    const user = userEvent.setup();

    render(<RecurringExpenseForm onSubmit={() => {}} onCancel={() => {}} />);

    const titleInput = screen.getByLabelText("Title");
    await user.type(titleInput, "monthly rent");
    await user.tab();

    expect(titleInput).toHaveValue("Monthly Rent");
  });
});
