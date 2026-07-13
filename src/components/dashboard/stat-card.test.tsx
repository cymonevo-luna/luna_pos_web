import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListTodo } from "lucide-react";
import { StatCard } from "./stat-card";

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(<StatCard label="Total Tasks" value={24} icon={ListTodo} />);
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("renders a subtitle when provided", () => {
    render(
      <StatCard
        label="Today's Inflow"
        value="Rp 100.000"
        icon={ListTodo}
        subtitle="12 transactions"
      />,
    );
    expect(screen.getByText("12 transactions")).toBeInTheDocument();
  });

  it("renders a trend when provided", () => {
    render(
      <StatCard label="Completed" value={16} icon={ListTodo} trend="+8%" />,
    );
    expect(screen.getByText("+8%")).toBeInTheDocument();
  });

  it("omits the trend when not provided", () => {
    render(<StatCard label="In Progress" value={8} icon={ListTodo} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
