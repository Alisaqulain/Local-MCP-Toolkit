export const APP_NAME = 'Local MCP Toolkit';
export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3847;
export const DEFAULT_MAX_FILE_READ_BYTES = 1_048_576;
export const DEFAULT_MAX_SEARCH_RESULTS = 100;
export const DEFAULT_MAX_QUERY_ROWS = 500;
export const DEFAULT_REQUEST_BODY_LIMIT = 1_048_576;
export const DEFAULT_TOOL_TIMEOUT_MS = 30_000;
export const DEFAULT_LOG_RETENTION_DAYS = 30;

export const DEFAULT_ALLOWED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.jsonc',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.env.example',
  '.csv',
  '.tsv',
  '.sql',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.sh',
  '.ps1',
  '.bat',
  '.log',
];

export const DEFAULT_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
];

export const TOOL_CATEGORIES = [
  'filesystem',
  'notes',
  'database',
  'utility',
  'search',
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
