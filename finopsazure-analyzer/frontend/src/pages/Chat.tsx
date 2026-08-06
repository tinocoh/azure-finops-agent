import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import type { ChatMessage, Connection } from '../types';

const SUGGESTIONS = [
  'How much did I spend this month by service?',
  'Which resources are missing tags?',
  'Where can I save money? Give me the quick wins.',
  'What is the cost variance compared to last month?',
];

export default function Chat() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const conns = await api.listConnections();
        setConnections(conns);
        if (conns.length > 0) setConnectionId(conns[0].id);
      } catch (e: any) {
        setError(e?.message || 'Error loading connections');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || !connectionId || sending) return;
    setError('');
    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    setSending(true);
    try {
      const res = await api.chat({ connectionId, message, history });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Error querying chat');
      setMessages((m) => [...m, { role: 'assistant', content: '⚠️ I could not respond. Check the connection and permissions.' }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading />;

  if (connections.length === 0) {
    return (
      <div>
        <h2>Chat FinOps</h2>
        <p className="muted">Register a connection in Azure configuration first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="row">
        <h2>Chat FinOps</h2>
        <div className="spacer" />
        <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
          <select value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setMessages([]); }}>
            {connections.map((c) => <option key={c.id} value={c.id}>{c.connectionName}</option>)}
          </select>
        </div>
      </div>
      <p className="muted">Ask natural-language questions about costs, inventory, and recommendations for the selected subscription.</p>
      <ErrorMessage message={error} />

      <div className="card" style={{ minHeight: 360, maxHeight: 520, overflowY: 'auto', marginBottom: 14 }}>
        {messages.length === 0 ? (
          <div>
            <p className="muted">Start with a question:</p>
            <div className="row">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn secondary" onClick={() => send(s)} style={{ marginBottom: 8 }}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <ChatBubble key={i} msg={m} />)
        )}
        {sending && <div className="muted" style={{ marginTop: 8 }}>Querying subscription data...</div>}
        <div ref={bottomRef} />
      </div>

      <form
        className="row"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
          style={{ flex: 1 }}
          disabled={sending}
        />
        <button type="submit" className="btn" disabled={sending || !input.trim()}>Send</button>
      </form>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
      <div
        style={{
          maxWidth: '78%',
          background: isUser ? 'var(--accent)' : 'var(--panel-2)',
          color: isUser ? '#fff' : 'var(--text)',
          padding: '10px 14px',
          borderRadius: 10,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}
