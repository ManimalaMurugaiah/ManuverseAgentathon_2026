import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import { DashboardPage } from "./DashboardPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardPage", () => {
  it("asks for a business first and omits the removed business badge", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    });

    render(
      <MemoryRouter initialEntries={["/?business=Northstar%20Steel%20Works"]}>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Project Overview" })).toBeTruthy();
    expect(screen.getAllByText("Rolling mill vibration trending upward").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Priority actions" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "AI Insights" })).toBeNull();
  });
});
