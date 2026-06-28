import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityList } from "./activity-list";

describe("ActivityList", () => {
  it("renders each activity item with its time", () => {
    render(
      <ActivityList
        items={[
          { id: "1", title: "Design Review", time: "2h ago" },
          { id: "2", title: "Project Meeting", time: "4h ago", color: "green" },
        ]}
      />,
    );
    expect(screen.getByText("Design Review")).toBeInTheDocument();
    expect(screen.getByText("4h ago")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
