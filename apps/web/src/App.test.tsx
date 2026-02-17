import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders header", () => {
    render(<App />);
    expect(screen.getByText(/Product Analyzer/i)).toBeInTheDocument();
  });
});
