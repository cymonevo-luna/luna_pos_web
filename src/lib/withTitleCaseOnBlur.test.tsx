import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { withTitleCaseOnBlur } from "./withTitleCaseOnBlur";

function TitleInputFixture() {
  const { register, setValue, watch } = useForm({ defaultValues: { title: "" } });
  const title = watch("title");

  return (
    <>
      <input
        aria-label="Title"
        {...withTitleCaseOnBlur(register("title"), setValue, "title")}
      />
      <output data-testid="title-value">{title}</output>
    </>
  );
}

describe("withTitleCaseOnBlur", () => {
  it("normalizes title casing on blur", async () => {
    const user = userEvent.setup();

    render(<TitleInputFixture />);

    const input = screen.getByLabelText("Title");
    await user.type(input, "es teh manis");
    await user.tab();

    expect(input).toHaveValue("Es Teh Manis");
    expect(screen.getByTestId("title-value")).toHaveTextContent("Es Teh Manis");
  });

  it("leaves already normalized values unchanged", async () => {
    const user = userEvent.setup();

    render(<TitleInputFixture />);

    const input = screen.getByLabelText("Title");
    await user.type(input, "Es Teh Manis");
    const onBlur = vi.fn();
    input.addEventListener("blur", onBlur);
    await user.tab();

    expect(input).toHaveValue("Es Teh Manis");
    expect(onBlur).toHaveBeenCalled();
  });
});
