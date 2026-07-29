/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MapControls } from "../../../src/components/admin/MapControls";

describe("MapControls", () => {
  const defaultProps = {
    areas: ["A", "B", "C"],
    area: "A",
    search: "",
    verifyPending: false,
    onAreaChange: vi.fn(),
    onSearchChange: vi.fn(),
    onVerify: vi.fn(),
  };

  it("renders area tabs for each area", () => {
    render(<MapControls {...defaultProps} />);
    expect(screen.getByText("Obszar A")).toBeInTheDocument();
    expect(screen.getByText("Obszar B")).toBeInTheDocument();
    expect(screen.getByText("Obszar C")).toBeInTheDocument();
  });

  it("renders the verify button", () => {
    render(<MapControls {...defaultProps} />);
    expect(screen.getByText("Weryfikuj")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<MapControls {...defaultProps} />);
    expect(screen.getByPlaceholderText("Szukaj towaru...")).toBeInTheDocument();
  });
});
