import { Page } from '@playwright/test';

export const authSuccessBody = {
  token: 'e2e-token',
  refreshToken: 'e2e-refresh-token',
  user: { name: 'E2E User', email: 'e2e@example.com' },
};

export async function gotoPath(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

export async function mockAuthEndpoints(page: Page) {
  const authBody = JSON.stringify(authSuccessBody);

  await page.route('**/auth/signup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: authBody,
    });
  });

  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: authBody,
    });
  });

  await page.route('**/auth/me', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: authSuccessBody.user }),
      });
      return;
    }
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: authSuccessBody.user }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/metrics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ requestsPerMin: 120, healthyHosts: 4 }),
    });
  });
}

export async function loginAsTestUser(page: Page) {
  await gotoPath(page, '/login');
  await page.getByLabel('Email').fill('e2e@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL(/\/dashboard/);
}

export async function confirmLogout(page: Page) {
  await page.getByRole('button', { name: /^logout$/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /^logout$/i }).click();
  await page.waitForURL(/\/login/);
}
