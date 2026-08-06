import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Spinner,
  Text,
  Title3,
  Textarea,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components';
import { Send24Filled, Sparkle24Filled, ArrowClockwise20Regular } from '@fluentui/react-icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMe, isConnectedToAzure, streamChat, type Me } from './api';
import { ChartView } from './ChartView';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  tool?: string;
  chart?: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  'How much did I spend on Azure this month by service?',
  'Chart this month\'s spend by service as a pie chart',
  'Compara en barras el precio/hora de las VMs D2s_v5, D4s_v5 y D8s_v5 en East US',
  'Where can I save money? Give me optimization recommendations.',
];

const friendlyTool = (t: string): string => {
  if (t.includes('query_costs')) return 'Querying Cost Management...';
  if (t.includes('search_prices') || t.includes('vm_prices') || t.includes('cheapest')) return 'Querying Azure prices...';
  if (t.includes('forecast')) return 'Calculating cost forecast...';
  if (t.includes('budget')) return 'Reviewing budgets...';
  if (t.includes('reservation') || t.includes('estimate')) return 'Estimating savings...';
  if (t.startsWith('azure-cost')) return 'Querying FinOps engine...';
  if (t === 'web_fetch') return 'Fetching public information...';
  return 'Processing...';
};

const useStyles = makeStyles({
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shorthands.padding('12px', '20px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    boxShadow: tokens.shadow4,
    zIndex: 1,
  },
  brand: { display: 'flex', alignItems: 'center', columnGap: '10px' },
  logo: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #0078D4, #50409A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  main: { flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' },
  thread: { width: '100%', maxWidth: '820px', ...shorthands.padding('24px', '16px', '8px') },
  empty: { textAlign: 'center', marginTop: '8vh', color: tokens.colorNeutralForeground2 },
  suggestGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '12px',
    rowGap: '12px',
    marginTop: '28px',
    maxWidth: '640px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  suggestCard: {
    ...shorthands.padding('14px', '16px'),
    textAlign: 'left',
    height: 'auto',
    justifyContent: 'flex-start',
    fontWeight: tokens.fontWeightRegular,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  row: { display: 'flex', columnGap: '12px', marginBottom: '20px', alignItems: 'flex-start' },
  rowUser: { flexDirection: 'row-reverse' },
  bubble: {
    ...shorthands.padding('12px', '16px'),
    borderRadius: '14px',
    maxWidth: '80%',
    lineHeight: '1.5',
    wordBreak: 'break-word',
  },
  bubbleAssistant: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
  },
  bubbleUser: { backgroundColor: tokens.colorBrandBackground2, color: tokens.colorNeutralForeground1 },
  toolChip: { display: 'flex', alignItems: 'center', columnGap: '8px', marginBottom: '8px' },
  composer: {
    display: 'flex',
    justifyContent: 'center',
    ...shorthands.padding('12px', '16px', '18px'),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  composerInner: {
    width: '100%',
    maxWidth: '820px',
    display: 'flex',
    columnGap: '8px',
    alignItems: 'flex-end',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    borderRadius: '12px',
    ...shorthands.padding('8px'),
    boxShadow: tokens.shadow2,
  },
  textarea: { flex: 1 },
  hint: { textAlign: 'center', marginTop: '6px', color: tokens.colorNeutralForeground3 },
});

export function App() {
  const s = useStyles();
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMe().then(setMe);
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const connected = isConnectedToAzure(me);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: prompt }, { role: 'assistant', content: '', streaming: true }]);

    const setLast = (fn: (m: Msg) => Msg) =>
      setMessages((arr) => arr.map((m, i) => (i === arr.length - 1 ? fn(m) : m)));

    await streamChat(prompt, {
      onDelta: (t) => setLast((m) => ({ ...m, content: m.content + t, tool: undefined })),
      onTool: (tool) => setLast((m) => ({ ...m, tool })),
      onChart: (opts) => setLast((m) => ({ ...m, chart: opts, tool: undefined })),
      onDone: (final) =>
        setLast((m) => ({ ...m, content: final || m.content || '…', streaming: false, tool: undefined })),
      onError: (msg) => setLast((m) => ({ ...m, content: `⚠️ ${msg}`, streaming: false, tool: undefined })),
    });
    setBusy(false);
  };

  return (
    <div className={s.app}>
      <header className={s.header}>
        <div className={s.brand}>
          <div className={s.logo}>
            <Sparkle24Filled />
          </div>
          <div>
            <Text weight="semibold" size={400}>
              Azure FinOps Agent
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Azure costs and operations in natural language
            </Text>
          </div>
        </div>
        {connected ? (
          <Badge appearance="tint" color="success" size="large">
            Connected · {me?.email}
          </Badge>
        ) : (
          <Button appearance="primary" onClick={() => (window.location.href = '/auth/microsoft')}>
            Connect Azure
          </Button>
        )}
      </header>

      <main className={s.main} ref={threadRef}>
        <div className={s.thread}>
          {messages.length === 0 ? (
            <div className={s.empty}>
              <Title3>How can I help today?</Title3>
              <br />
              <Text>
                Ask about spend, resources, pricing, or where to optimize.
                {!connected && ' Connect Azure to query your subscription data.'}
              </Text>
              <div className={s.suggestGrid}>
                {SUGGESTIONS.map((q) => (
                  <Button key={q} className={s.suggestCard} onClick={() => send(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`${s.row} ${m.role === 'user' ? s.rowUser : ''}`}>
                <Avatar
                  size={28}
                  color={m.role === 'user' ? 'brand' : 'colorful'}
                  name={m.role === 'user' ? me?.name ?? 'You' : 'FinOps'}
                  icon={m.role === 'assistant' ? <Sparkle24Filled /> : undefined}
                />
                <div className={`${s.bubble} ${m.role === 'user' ? s.bubbleUser : s.bubbleAssistant}`}>
                  {m.tool && (
                    <div className={s.toolChip}>
                      <Spinner size="extra-tiny" />
                      <Text size={200} italic>
                        {friendlyTool(m.tool)}
                      </Text>
                    </div>
                  )}
                  {m.content ? (
                    <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                  ) : m.streaming && !m.tool && !m.chart ? (
                    <Spinner size="tiny" label="Thinking..." labelPosition="after" />
                  ) : null}
                  {m.chart && <ChartView payload={m.chart} />}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <footer className={s.composer}>
        <div>
          <div className={s.composerInner}>
            <Textarea
              className={s.textarea}
              appearance="filled-lighter"
              resize="vertical"
              placeholder="Type your Azure question... (Enter to send)"
              value={input}
              onChange={(_, d) => setInput(d.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button
              appearance="primary"
              icon={busy ? <ArrowClockwise20Regular /> : <Send24Filled />}
              disabled={busy || !input.trim()}
              onClick={() => send(input)}
            >
              Send
            </Button>
          </div>
          <Text className={s.hint} size={100} block>
            Read-only mode · The agent does not modify your tenant.
          </Text>
        </div>
      </footer>
    </div>
  );
}
