import { test, expect } from '@playwright/test';
import { gotoPath } from './helpers';

test.describe('Login page', () => {
  test('loads and shows form fields', async ({ page }) => {
    await gotoPath(page, '/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create a new account/i })).toBeVisible();
  });

  test('redirects unauthenticated users from dashboard to login', async ({ page }) => {
    await gotoPath(page, '/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
