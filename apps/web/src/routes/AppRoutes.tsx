import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { OverviewPage } from '@/features/dashboard/OverviewPage';
import { ToolsPage } from '@/features/tools/ToolsPage';
import { FilesPage } from '@/features/files/FilesPage';
import { NotesPage } from '@/features/notes/NotesPage';
import { DatabasePage } from '@/features/database/DatabasePage';
import { LogsPage } from '@/features/logs/LogsPage';
import { StatusPage } from '@/features/dashboard/StatusPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { DocsPage } from '@/features/dashboard/DocsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="database" element={<DatabasePage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="status" element={<StatusPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="docs" element={<DocsPage />} />
      </Route>
    </Routes>
  );
}
