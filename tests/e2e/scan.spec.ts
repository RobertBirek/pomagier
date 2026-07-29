import { test, expect } from "@playwright/test";

test("scan page loads and can type a code", async ({ page }) => {
  await page.goto("/mobile/scan");
  const input = page.locator('input[placeholder*="skanuj"], input[placeholder*="kod"]');
  await expect(input).toBeVisible();
  await input.fill("5901234567890");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
});
