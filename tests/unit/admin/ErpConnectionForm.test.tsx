/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErpConnectionForm } from "../../../src/components/admin/ErpConnectionForm";

describe("ErpConnectionForm", () => {
  const defaultForm = { host: "", port: 1433, database: "", user: "", password: "" };
  const defaultProps = {
    form: defaultForm,
    saving: false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  it("renders all form fields", () => {
    render(<ErpConnectionForm {...defaultProps} />);
    expect(screen.getByPlaceholderText(/10\.10\.254\.87/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("pomagier")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("sa")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pozostaw puste/i)).toBeInTheDocument();
  });

  it("renders the save button", () => {
    render(<ErpConnectionForm {...defaultProps} />);
    expect(screen.getByText("Zapisz")).toBeInTheDocument();
  });

  it("shows saving state on the button", () => {
    render(<ErpConnectionForm {...defaultProps} saving />);
    expect(screen.getByText("Zapisuję…")).toBeInTheDocument();
  });

  it("disables button when saving", () => {
    render(<ErpConnectionForm {...defaultProps} saving />);
    expect(screen.getByRole("button", { name: /zapisuję/i })).toBeDisabled();
  });
});
