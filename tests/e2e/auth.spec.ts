import { expect, test } from "@playwright/test";

test.describe("authentication entry", () => {
  test("supports email, phone, registration, and theme controls", async ({ page }, testInfo) => {
    await page.goto("/login");

    await expect(page).toHaveTitle("AskPDF");
    if (testInfo.project.name === "chromium")
      await expect(
        page.getByRole("heading", { name: "Ask a document. Check the page." }),
      ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByRole("button", { name: "Phone", exact: true }).click();
    await expect(page.getByLabel("Phone number")).toBeVisible();

    await page.getByRole("button", { name: "Create an account" }).click();
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();

    await page.getByRole("button", { name: "Use dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
