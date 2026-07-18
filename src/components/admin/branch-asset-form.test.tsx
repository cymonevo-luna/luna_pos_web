import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchAssetForm } from "./branch-asset-form";

describe("BranchAssetForm", () => {
  it("title-cases the title on blur", async () => {
    const user = userEvent.setup();

    render(<BranchAssetForm onSubmit={() => {}} onCancel={() => {}} />);

    const titleInput = screen.getByLabelText("Title");
    await user.type(titleInput, "espresso machine");
    await user.tab();

    expect(titleInput).toHaveValue("Espresso Machine");
  });
});
