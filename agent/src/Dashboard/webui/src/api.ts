// Thin client for the .NET backend. Served same-origin, so cookies + the CSRF/Origin
// checks on /api/chat work without extra config.

export interface Me {
  email?: string | null;
  name?: string | null;
  login?: string;
}

export async function getMe(): Promise<Me | null> {
  try {
    const res = await fetch('/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as Me;
    return data;
  } catch {
    return null;
  }
}

export const isConnectedToAzure = (me: Me | null): boolean => !!me?.email;

export interface ChatHandlers {
  onDelta: (text: string) => void;
  onTool: (toolName: string) => void;
  onChart: (optionsJson: string) => void;
  onDone: (finalMessage: string) => void;
  onError: (message: string) => void;
}

/**
 * POSTs a prompt to /api/chat and parses the Server-Sent-Events stream:
 *   data: {"type":"delta","content":"..."}
 *   data: {"type":"tool_start","tool":"azure-cost-azure_query_costs", ...}
 *   data: {"type":"message","content":"<final>"}
 */
export async function streamChat(prompt: string, h: ChatHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    h.onError('No se pudo conectar con el agente.');
    return;
  }

  if (res.status === 401) {
    h.onError('Necesitas iniciar sesión para usar el agente.');
    return;
  }
  if (!res.ok || !res.body) {
    h.onError(`El agente respondió con un error (HTTP ${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalMessage = '';

  const handleEvent = (raw: string) => {
    const line = raw.trim();
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') return;
    let evt: { type?: string; content?: string; tool?: string; options?: string };
    try {
      evt = JSON.parse(payload);
    } catch {
      return;
    }
    if (evt.type === 'delta' && evt.content) h.onDelta(evt.content);
    else if (evt.type === 'tool_start' && evt.tool) h.onTool(evt.tool);
    else if (evt.type === 'chart' && evt.options) h.onChart(evt.options);
    else if (evt.type === 'message' && evt.content) finalMessage = evt.content;
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) handleEvent(part);
  }
  if (buffer) handleEvent(buffer);
  h.onDone(finalMessage);
}
