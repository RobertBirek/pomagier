/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortraitOverlay } from "../../../src/components/pomagier/PortraitOverlay";

describe("PortraitOverlay", () => {
  it("renders default message", () => {
    render(<PortraitOverlay />);
    expect(screen.getByText("Obróć urządzenie")).toBeInTheDocument();
    expect(screen.getByText("Aplikacja działa tylko w orientacji pionowej")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<PortraitOverlay message="Obróć telefon" />);
    expect(screen.getByText("Obróć telefon")).toBeInTheDocument();
  });
});
