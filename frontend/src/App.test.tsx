import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";

describe("App", () => {
  it("renders the login screen when there is no session", async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeTruthy();
  });
});
