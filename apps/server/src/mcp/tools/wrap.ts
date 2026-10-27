import { isToolEnabled } from '../tool-registry.js';
import {
  recordExecution,
  redactInput,
  summarizeResult,
} from '../../modules/statistics/service.js';
import { logger } from '../../logging/logger.js';

export type McpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

export function wrapTool<T>(
  name: string,
  category: string,
  handler: (args: T) => Promise<unknown> | unknown,
) {
  return async (args: T): Promise<McpToolResult> => {
    if (!isToolEnabled(name)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${name}' is disabled` }) }],
        isError: true,
      };
    }

    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    try {
      const result = await handler(args);
      const durationMs = Date.now() - t0;
      try {
        recordExecution({
          toolName: name,
          category,
          inputSummary: redactInput(args),
          status: 'success',
          startedAt,
          durationMs,
          resultSummary: summarizeResult(result),
        });
      } catch (e) {
        logger.warn({ err: e }, 'Failed to record execution');
      }
      const text = JSON.stringify(result, null, 2);
      // MCP structuredContent must be a JSON object (not array/primitive)
      const structuredContent =
        typeof result === 'object' && result !== null && !Array.isArray(result)
          ? (result as Record<string, unknown>)
          : { result };
      return {
        content: [{ type: 'text', text }],
        structuredContent,
      };
    } catch (err) {
      const durationMs = Date.now() - t0;
      const message = err instanceof Error ? err.message : 'Unknown error';
      const category_ = err instanceof Error ? err.name : 'Error';
      try {
        recordExecution({
          toolName: name,
          category,
          inputSummary: redactInput(args),
          status: 'error',
          startedAt,
          durationMs,
          errorCategory: category_,
          errorMessage: message.slice(0, 500),
        });
      } catch (e) {
        logger.warn({ err: e }, 'Failed to record failed execution');
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  };
}
