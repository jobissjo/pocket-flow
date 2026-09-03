import { apiRequest } from './api';
import { processAIQuery } from './ai';

export interface ToolExecutionRecord {
  tool_name: string;
  arguments?: Record<string, any>;
  success: boolean;
  result?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolExecutions?: ToolExecutionRecord[];
  provider?: string;
  model?: string;
}

export interface AIChatPayload {
  message: string;
  history: {
    role: 'user' | 'assistant';
    content: string;
  }[];
}

export interface AIChatResponse {
  reply: string;
  tool_executions?: ToolExecutionRecord[];
  provider?: string;
  model?: string;
}

/**
 * Sends a message to the PocketFlow AI Chatbot endpoint (/api/ai/chat)
 * Falls back to local offline financial analyzer if server is unavailable.
 */
export async function sendAIChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<AIChatResponse> {
  const payload: AIChatPayload = {
    message,
    history: history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
  };

  try {
    const res = await apiRequest<AIChatResponse>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      reply: res.reply || 'No response received from AI.',
      tool_executions: res.tool_executions || [],
      provider: res.provider,
      model: res.model,
    };
  } catch (err: any) {
    console.warn('API AI Chat endpoint error, falling back to local engine:', err?.message || err);

    // If server failed or network unavailable, fall back to offline query parser
    try {
      const fallback = await processAIQuery(message);
      return {
        reply: fallback.content,
        provider: 'offline-vault',
        model: 'PocketFlow Local Engine',
        tool_executions: [
          {
            tool_name: 'local_sqlite_query',
            success: true,
            result: fallback.structured_data || 'Processed locally',
          },
        ],
      };
    } catch {
      throw err;
    }
  }
}
