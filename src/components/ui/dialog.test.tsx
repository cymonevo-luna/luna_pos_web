import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogTitle } from "./dialog";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}}>
        <DialogTitle>Hidden</DialogTitle>
      </Dialog>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("renders content when open", () => {
    render(
      <Dialog open onClose={() => {}}>
        <DialogTitle>Visible</DialogTitle>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Visible")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose}>
        <DialogTitle>X</DialogTitle>
      </Dialog>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
