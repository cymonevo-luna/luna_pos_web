import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable, type Column } from "./data-table";

interface Row {
  id: string;
  name: string;
}

const columns: Column<Row>[] = [{ header: "Name", cell: (r) => r.name }];

describe("DataTable", () => {
  it("renders rows", () => {
    render(
      <DataTable
        columns={columns}
        rows={[{ id: "1", name: "Alice" }]}
        getRowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("shows the error state", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        error="Boom"
      />,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
