import { test, expect } from '@playwright/test';

test('dashboard loads and tools page discovers MCP tools', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 60_000 });

  await page.getByRole('link', { name: 'MCP Tools' }).click();
  await expect(page.getByRole('heading', { name: 'MCP Tools' })).toBeVisible();
  await expect(page.getByText('get_workspace_info')).toBeVisible({ timeout: 30_000 });

  await page.getByText('get_workspace_info').click();
  await page.getByRole('button', { name: /Execute via MCP/i }).click();
  await expect(page.getByText(/workspacePath/i)).toBeVisible({ timeout: 30_000 });
});

test('notes create flow', async ({ page }) => {
  await page.goto('/notes');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
});
