import { test, expect } from "@playwright/test";

test("ERP config page loads with form", async ({ page }) => {
  await page.goto("/admin/erp");
  await expect(page.locator("input")).toBeVisible();
});
