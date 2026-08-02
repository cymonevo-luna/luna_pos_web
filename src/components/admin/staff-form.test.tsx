import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import {
  StaffForm,
  type StaffFormHandle,
  buildDefaultStaffValues,
  staffToFormValues,
} from "./staff-form";
import { uploadStaffKtpPhoto } from "@/lib/api/uploads";
import type { Staff } from "@/lib/api/types";

vi.mock("@/lib/api/uploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/uploads")>();
  return {
    ...actual,
    uploadStaffKtpPhoto: vi.fn(),
  };
});

const validStaff = buildDefaultStaffValues({
  name: "Budi Santoso",
  nik: "3201010101010001",
  address: "Jl. Merdeka No. 10",
  job_title: "Cashier",
  salary_amount: 5000000,
  join_date: "2026-06-01",
  payout_day_of_month: 26,
  bank_name: "",
  bank_account_holder_name: "",
  bank_account_number: "",
});

async function fillSalarySchedule(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Join date"), "2026-06-01");
  await user.clear(screen.getByLabelText("Payout day of month"));
  await user.type(screen.getByLabelText("Payout day of month"), "26");
}

describe("StaffForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all fields including banking", () => {
    render(<StaffForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("NIK")).toBeInTheDocument();
    expect(screen.getByLabelText("KTP photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Job title")).toBeInTheDocument();
    expect(screen.getByLabelText(/Salary/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Benefits/)).toBeInTheDocument();
    expect(screen.getByLabelText("Bank Name")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Bank Account Holder Name/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Account Number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose image" })).toBeInTheDocument();
    expect(screen.getByTestId("staff-banking-section")).toBeInTheDocument();
  });

  it("submits without nik, address, or banking when only required fields are filled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <StaffForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save staff"
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Budi Santoso");
    await user.type(screen.getByLabelText("Job title"), "Cashier");
    await user.clear(screen.getByLabelText(/Salary/));
    await user.type(screen.getByLabelText(/Salary/), "5000000");
    await fillSalarySchedule(user);
    await user.click(screen.getByRole("button", { name: "Save staff" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      name: "Budi Santoso",
      nik: "",
      address: "",
      job_title: "Cashier",
      salary_amount: 5000000,
      bank_name: "",
      bank_account_holder_name: "",
      bank_account_number: "",
    });
  });

  it("rejects bank name without account number", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StaffForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.type(screen.getByLabelText("Bank Name"), "BCA");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Account number is required when bank name is provided",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts bank name and account number without holder name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StaffForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.type(screen.getByLabelText("Bank Name"), "BCA");
    await user.type(screen.getByLabelText("Account Number"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      bank_name: "BCA",
      bank_account_holder_name: "",
      bank_account_number: "1234567890",
    });
  });

  it("rejects 15-digit NIK and accepts valid 16-digit NIK", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StaffForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.type(screen.getByLabelText("NIK"), "123456789012345");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("NIK must be exactly 16 digits"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("NIK"));
    await user.type(screen.getByLabelText("NIK"), "3201010101010001");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it("submits valid data via onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <StaffForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save staff"
      />,
    );

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("NIK"), validStaff.nik);
    await user.type(screen.getByLabelText("Address"), validStaff.address);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.clear(screen.getByLabelText(/Salary/));
    await user.type(
      screen.getByLabelText(/Salary/),
      String(validStaff.salary_amount),
    );
    await fillSalarySchedule(user);
    await user.click(screen.getByRole("button", { name: "Save staff" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...validStaff,
      ktp_photo_url: "",
      benefits: "",
      bank_name: "",
      bank_account_holder_name: "",
      bank_account_number: "",
    });
  });

  it("shows salary schedule fields when salary is entered", async () => {
    const user = userEvent.setup();

    render(<StaffForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(
      screen.queryByTestId("staff-salary-schedule-section"),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Salary/), "5000000");

    expect(
      screen.getByTestId("staff-salary-schedule-section"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Join date")).toBeInTheDocument();
    expect(screen.getByLabelText("Payout day of month")).toBeInTheDocument();
  });

  it("blocks submit when salary is set but payout day is missing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StaffForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.type(screen.getByLabelText(/Salary/), "5000000");
    await user.type(screen.getByLabelText("Join date"), "2026-06-01");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Payout day of month is required"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pre-fills schedule fields when editing staff with salary", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: null,
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
      benefits: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(
      <StaffForm
        defaultValues={staffToFormValues(staff)}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("Join date")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("Payout day of month")).toHaveValue(26);
  });

  it("applies server field errors for schedule fields via ref", async () => {
    const user = userEvent.setup();
    const ref = createRef<StaffFormHandle>();

    render(
      <StaffForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    await user.type(screen.getByLabelText(/Salary/), "5000000");

    ref.current?.applyServerErrors({
      join_date: "invalid join date",
      payout_day_of_month: "invalid payout day",
    });

    expect(await screen.findByText("invalid join date")).toBeInTheDocument();
    expect(await screen.findByText("invalid payout day")).toBeInTheDocument();
  });

  it("submits without salary when salary field is left blank", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <StaffForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save staff"
      />,
    );

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("NIK"), validStaff.nik);
    await user.type(screen.getByLabelText("Address"), validStaff.address);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.click(screen.getByRole("button", { name: "Save staff" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      name: validStaff.name,
      nik: validStaff.nik,
      address: validStaff.address,
      job_title: validStaff.job_title,
      salary_amount: undefined,
      bank_name: "",
      bank_account_holder_name: "",
      bank_account_number: "",
    });
  });

  it("shows validation error for negative salary and blocks submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StaffForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("NIK"), validStaff.nik);
    await user.type(screen.getByLabelText("Address"), validStaff.address);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.clear(screen.getByLabelText(/Salary/));
    await user.type(screen.getByLabelText(/Salary/), "-1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Salary cannot be negative"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows auto-managed recurring expense notice when editing linked staff", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: null,
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      recurring_expense_id: "recurring-expense-1",
      benefits: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(
      <StaffForm
        defaultValues={staffToFormValues(staff)}
        recurringExpenseId={staff.recurring_expense_id}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(
      screen.getByTestId("staff-recurring-expense-notice"),
    ).toHaveTextContent(
      "A recurring expense is automatically managed for this salary.",
    );
  });

  it("shows empty salary input when editing staff with zero salary", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: null,
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 0,
      benefits: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(
      <StaffForm
        defaultValues={staffToFormValues(staff)}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText(/Salary/)).toHaveValue(null);
  });

  it("shows validation error for invalid NIK and blocks submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StaffForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("NIK"), "123");
    await user.type(screen.getByLabelText("Address"), validStaff.address);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.clear(screen.getByLabelText(/Salary/));
    await user.type(
      screen.getByLabelText(/Salary/),
      String(validStaff.salary_amount),
    );
    await fillSalarySchedule(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("NIK must be exactly 16 digits"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("applies server field errors via ref", async () => {
    const ref = createRef<StaffFormHandle>();

    render(
      <StaffForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    ref.current?.applyServerErrors({ nik: "already exists" });

    expect(await screen.findByText("already exists")).toBeInTheDocument();
  });

  it("uploads KTP photo and sets ktp_photo_url form value", async () => {
    const uploadedUrl = "http://test/ktp.jpg";
    vi.mocked(uploadStaffKtpPhoto).mockResolvedValue({
      url: uploadedUrl,
      filename: "ktp.jpg",
      size_bytes: 1024,
    });

    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StaffForm onSubmit={onSubmit} onCancel={() => {}} />);

    const file = new File([new Uint8Array(1024)], "ktp.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("KTP photo"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadStaffKtpPhoto).toHaveBeenCalledWith(file);
    });

    expect(screen.getByAltText("KTP photo preview")).toHaveAttribute(
      "src",
      uploadedUrl,
    );

    await user.type(screen.getByLabelText("Name"), validStaff.name);
    await user.type(screen.getByLabelText("NIK"), validStaff.nik);
    await user.type(screen.getByLabelText("Address"), validStaff.address);
    await user.type(screen.getByLabelText("Job title"), validStaff.job_title);
    await user.clear(screen.getByLabelText(/Salary/));
    await user.type(
      screen.getByLabelText(/Salary/),
      String(validStaff.salary_amount),
    );
    await fillSalarySchedule(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0].ktp_photo_url).toBe(uploadedUrl);
  });
});

describe("staff form helpers", () => {
  it("buildDefaultStaffValues returns empty defaults", () => {
    expect(buildDefaultStaffValues()).toEqual({
      name: "",
      nik: "",
      ktp_photo_url: "",
      address: "",
      job_title: "",
      salary_amount: undefined,
      benefits: "",
      bank_name: "",
      bank_account_holder_name: "",
      bank_account_number: "",
      join_date: "",
      payout_day_of_month: undefined,
    });
  });

  it("staffToFormValues maps staff entity to form values including banking", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: "http://example.com/ktp.jpg",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      benefits: "Health insurance",
      bank_name: "BCA",
      bank_account_holder_name: null,
      bank_account_number: "1234567890",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(staffToFormValues(staff)).toEqual({
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: "http://example.com/ktp.jpg",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      benefits: "Health insurance",
      bank_name: "BCA",
      bank_account_holder_name: "",
      bank_account_number: "1234567890",
      join_date: "",
      payout_day_of_month: undefined,
    });
  });

  it("staffToFormValues maps schedule fields from staff entity", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: null,
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
      benefits: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(staffToFormValues(staff)).toMatchObject({
      join_date: "2026-06-01",
      payout_day_of_month: 26,
    });
  });

  it("staffToFormValues maps zero salary to undefined", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: null,
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 0,
      benefits: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(staffToFormValues(staff).salary_amount).toBeUndefined();
  });
});
