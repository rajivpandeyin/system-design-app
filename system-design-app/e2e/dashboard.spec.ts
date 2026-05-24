import { test, expect } from '@playwright/test';
import { loginAsTestUser, mockAuthEndpoints } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthEndpoints(page);
    await loginAsTestUser(page);
  });

  test('shows sidebar navigation items', async ({ page }) => {
    await expect(page.getByRole('link', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /url shortener/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /google docs/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^profile$/i })).toHaveCount(0);
  });

  test('navigates to URL Shortener page', async ({ page }) => {
    await page.getByRole('link', { name: /url shortener/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/url-shortener/);
    await expect(page.getByRole('heading', { name: /url shortener/i })).toBeVisible();
  });

  test('navigates to Google Docs page', async ({ page }) => {
    await page.getByRole('link', { name: /google docs/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/google-docs/);
    await expect(page.getByRole('heading', { name: /google docs style workspace/i })).toBeVisible();
  });

  test('opens profile from app bar avatar', async ({ page }) => {
    await page.getByRole('button', { name: /open profile/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/profile/);
    await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();
  });

  test('mobile menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: /toggle navigation menu/i }).click();
    await page.getByRole('link', { name: /url shortener/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/url-shortener/);
    await expect(page.getByRole('heading', { name: /url shortener/i })).toBeVisible();
  });
});
