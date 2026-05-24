import { test, expect } from '@playwright/test';
import { confirmLogout, gotoPath, mockAuthEndpoints } from './helpers';

test.describe('Auth flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthEndpoints(page);
  });

  test('signup navigates to dashboard', async ({ page }) => {
    await gotoPath(page, '/signup');
    await page.getByLabel('Name').fill('E2E User');
    await page.getByLabel('Email').fill('e2e@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /signup/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test('login navigates to dashboard', async ({ page }) => {
    await gotoPath(page, '/login');
    await page.getByLabel('Email').fill('e2e@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test('signup -> logout -> login flow', async ({ page }) => {
    await gotoPath(page, '/signup');
    await page.getByLabel('Name').fill('E2E User');
    await page.getByLabel('Email').fill('e2e@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /signup/i }).click();
    await expect(page.getByText(/welcome back/i)).toBeVisible();

    await confirmLogout(page);
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill('e2e@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });
});
