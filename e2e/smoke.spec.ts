import { test, expect } from '@playwright/test';

async function skipOnboarding(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('live-agents-onboarding-done', 'true');
  });
}

test('loads command center and shows overview', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/Live Agents/i);
  await expect(page.getByRole('heading', { name: /Your Agent Workspace/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Go Live/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Explore demo/i })).toBeVisible();
});

test('settings dropdowns open and select options', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');

  await page.getByTitle('Settings & API').click();
  await expect(page.getByRole('dialog', { name: /Settings/i })).toBeVisible();

  const providerSelect = page.getByRole('button', { name: 'AI Provider' });
  await providerSelect.click();
  await page.getByRole('option', { name: 'OpenAI' }).click();
  await expect(providerSelect).toContainText('OpenAI');

  const modelSelect = page.getByRole('button', { name: 'Default Agent Model' });
  await modelSelect.click();
  await expect(page.getByRole('listbox')).toBeVisible();
});
