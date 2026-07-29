import { test, expect } from "@playwright/test";

test("admin map page loads", async ({ page }) => {
  await page.goto("/admin/map");
  await expect(page.locator("text=Mapa||text=mapa||text=ład")).toBeVisible({ timeout: 10000 });
});
