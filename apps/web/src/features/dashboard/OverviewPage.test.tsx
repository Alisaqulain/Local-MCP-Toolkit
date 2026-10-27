import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OverviewPage } from './OverviewPage';

vi.mock('@/lib/api', () => ({
  api: vi.fn(async () => ({
    health: {
      status: 'ok',
      uptimeMs: 1000,
      startedAt: new Date().toISOString(),
      mcpConnected: true,
      toolCount: 18,
      databaseHealthy: true,
      workspacePath: './data/workspace',
      workspaceAccessible: true,
      version: '1.0.0',
    },
    successfulExecutions: 0,
    failedExecutions: 0,
    recentExecutions: [],
    recentNotes: [],
    workspaceStats: {
      fileCount: 1,
      directoryCount: 1,
      totalBytes: 10,
      extensionCounts: {},
      truncated: false,
    },
    toolUsageByCategory: {},
  })),
}));

describe('OverviewPage', () => {
  it('renders overview metrics', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <OverviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(await screen.findByText('18')).toBeTruthy();
  });
});
