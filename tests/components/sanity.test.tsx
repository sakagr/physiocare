import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Proves the component testing lane is wired: jsdom environment, React
 * Testing Library render, and jest-dom matchers. Real component tests land
 * with the shell and primitives in later F0 increments.
 */
function Hello({ name }: { name: string }) {
  return <p>Hello, {name}</p>;
}

describe("component testing lane", () => {
  it("renders a component and asserts with jest-dom matchers", () => {
    render(<Hello name="PhysioCare" />);
    expect(screen.getByText("Hello, PhysioCare")).toBeInTheDocument();
  });
});
