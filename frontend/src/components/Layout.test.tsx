import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import { Layout } from "./Layout";

function CurrentLocation(): JSX.Element {
  const location = useLocation();
  return <p>{location.pathname}{location.search}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Layout business controls", () => {
  it("keeps the business selection in navigation and opens matching risk notifications", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      removeItem,
      setItem: () => undefined,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<CurrentLocation />} />
              <Route path="/risks" element={<CurrentLocation />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(navigation.querySelector('a[href="/milestones"]')?.textContent).toContain("Milestones");
    expect(navigation.querySelector('a[href="/dependencies"]')?.textContent).toContain("Dependencies");
    expect(navigation.querySelector('a[href="/settings"]')).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Select business" }), {
      target: { value: "Northstar Steel Works" },
    });
    expect(screen.getByText("/?business=Northstar+Steel+Works")).toBeTruthy();
    expect(screen.getByLabelText("Selected business").textContent).toBe("Northstar Steel Works");
    expect(screen.queryByRole("combobox", { name: "Select business" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Notifications, 2 active" }));
    expect(screen.getByText("Rolling mill vibration trending upward")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Notifications, 2 active" }));
    fireEvent.click(screen.getByRole("button", { name: /Rolling mill vibration trending upward/ }));
    expect(screen.getByText("/risks?business=Northstar+Steel+Works")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(removeItem).toHaveBeenCalledWith("access_token");
  });
});
