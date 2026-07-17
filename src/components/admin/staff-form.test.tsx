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
});

describe("StaffForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all fields", () => {
    render(<StaffForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("NIK")).toBeInTheDocument();
    expect(screen.getByLabelText("KTP photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Job title")).toBeInTheDocument();
    expect(screen.getByLabelText(/Salary/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Benefits/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose image" })).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Save staff" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...validStaff,
      ktp_photo_url: "",
      benefits: "",
    });
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
    });
  });

  it("staffToFormValues maps staff entity to form values", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: "http://example.com/ktp.jpg",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      benefits: "Health insurance",
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
