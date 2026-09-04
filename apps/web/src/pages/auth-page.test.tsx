import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { AuthPage } from "./auth-page";

describe("AuthPage", () => {
  it("offers both supported identifiers", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthPage />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Email" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Phone" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
