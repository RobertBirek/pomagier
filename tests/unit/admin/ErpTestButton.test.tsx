/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErpTestButton } from "../../../src/components/admin/ErpTestButton";

describe("ErpTestButton", () => {
  const defaultProps = {
    onTest: vi.fn(),
    testing: false,
    testResult: null,
  };

  it("renders the test button", () => {
    render(<ErpTestButton {...defaultProps} />);
    expect(screen.getByText("Testuj połączenie")).toBeInTheDocument();
  });

  it("shows loading state when testing", () => {
    render(<ErpTestButton {...defaultProps} testing />);
    expect(screen.getByText("Testuję…")).toBeInTheDocument();
  });

  it("disables button when testing", () => {
    render(<ErpTestButton {...defaultProps} testing />);
    expect(screen.getByRole("button", { name: /testuję/i })).toBeDisabled();
  });

  it("displays success result", () => {
    render(<ErpTestButton {...defaultProps} testResult={{ ok: true, latencyMs: 42 }} />);
    expect(screen.getByText(/42 ms/)).toBeInTheDocument();
  });

  it("displays error result", () => {
    render(<ErpTestButton {...defaultProps} testResult={{ ok: false, error: "Odmowa dostępu" }} />);
    expect(screen.getByText(/odmowa dostępu/i)).toBeInTheDocument();
  });
});
