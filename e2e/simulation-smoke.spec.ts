import { test, expect } from '@playwright/test';

async function skipOnboarding(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('live-agents-onboarding-done', 'true');
  });
}

test.describe('3D office finished-product smoke', () => {
  test('Explore demo enters simulation shell and loads assets', async ({ page }) => {
    await skipOnboarding(page);

    const assetHits: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('character.glb') || url.includes('office.glb')) {
        assetHits.push(`${res.status()} ${url}`);
      }
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.getByRole('button', { name: /Explore demo/i })).toBeVisible();
    await page.getByRole('button', { name: /Explore demo/i }).click();

    // Simulation chrome should appear (team badge / fullscreen / canvas host).
    await expect(page.getByTitle('View Team Flow')).toBeVisible({ timeout: 30_000 });

    // Wait until loading overlay clears OR WebGPU fallback appears (CI Chromium may lack WebGPU).
    const loading = page.getByLabel('Loading 3D workspace');
    const webgpuFallback = page.getByText(/WebGPU is required/i);
    await expect
      .poll(
        async () => {
          const loadingVisible = await loading.isVisible().catch(() => false);
          const fallbackVisible = await webgpuFallback.isVisible().catch(() => false);
          return !loadingVisible || fallbackVisible;
        },
        { timeout: 60_000 },
      )
      .toBe(true);

    const fallbackVisible = await webgpuFallback.isVisible().catch(() => false);
    if (!fallbackVisible) {
      // Scene initialized — assets must have been requested successfully.
      expect(assetHits.some((h) => h.startsWith('200') && h.includes('character.glb'))).toBe(true);
      expect(assetHits.some((h) => h.startsWith('200') && h.includes('office.glb'))).toBe(true);
    }

    // No hard runtime crashes from our polish code.
    const critical = pageErrors.filter(
      (m) => !/WebGPU|adapter|GPU|Not supported/i.test(m),
    );
    expect(critical).toEqual([]);
  });

  test('finished GLB assets are served with expected cache bumps', async ({ request }) => {
    const character = await request.get('/models/character.glb?v=252');
    const office = await request.get('/models/office.glb?v=161');
    expect(character.status()).toBe(200);
    expect(office.status()).toBe(200);
    expect(Number(character.headers()['content-length'] || 0)).toBeGreaterThan(100_000);
    expect(Number(office.headers()['content-length'] || 0)).toBeGreaterThan(500_000);
  });
});
