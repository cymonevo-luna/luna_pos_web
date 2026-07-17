import { describe, it, expect, vi } from "vitest";
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
      title: "Office supplies",
      description: "Printer paper",
      amount: 150_000,
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
});
