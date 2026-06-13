import { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../api/index.js';
import styles from './ChatPanel.module.css';

function renderMarkdown(text) {
  return text
    .split('\n')
    .map((line, i) => {
      // Headings
      if (/^### /.test(line)) return <h4 key={i} style={{ margin: '10px 0 4px', fontSize: '13px', fontWeight: 700 }}>{line.slice(4)}</h4>;
      if (/^## /.test(line))  return <h3 key={i} style={{ margin: '12px 0 4px', fontSize: '14px', fontWeight: 700 }}>{line.slice(3)}</h3>;
      if (/^# /.test(line))   return <h2 key={i} style={{ margin: '14px 0 6px', fontSize: '15px', fontWeight: 700 }}>{line.slice(2)}</h2>;
      // Horizontal rule
      if (/^---+$/.test(line.trim())) return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />;
      // Empty line → spacing
      if (line.trim() === '') return <div key={i} style={{ height: '6px' }} />;
      // Inline bold + rest
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        /^\*\*[^*]+\*\*$/.test(part)
          ? <strong key={j}>{part.slice(2, -2)}</strong>
          : part
      );
      return <p key={i} style={{ margin: '2px 0', lineHeight: 1.6 }}>{parts}</p>;
    });
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`${styles.msg} ${isUser ? styles.msgUser : styles.msgAI}`}>
      <span className={styles.msgWho}>{isUser ? 'You' : 'AI'}</span>
      <div className={styles.msgText}>
        {isUser ? msg.content : renderMarkdown(msg.content)}
      </div>
    </div>
  );
}

export default function ChatPanel({ session, onHistoryUpdate }) {
  const [history, setHistory]   = useState(session.chatHistory ?? []);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const bottomRef               = useRef(null);

  // Sync if parent updates the session (e.g. after navigating between sessions)
  useEffect(() => {
    setHistory(session.chatHistory ?? []);
  }, [session.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);
    setLoading(true);

    // Optimistically add the user message
    const optimistic = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setHistory(h => [...h, optimistic]);

    try {
      const { chatHistory } = await sendChatMessage(session.id, text);
      setHistory(chatHistory);
      onHistoryUpdate?.(chatHistory);
    } catch (err) {
      setError(err.message);
      // Remove optimistic message on failure
      setHistory(h => h.filter(m => m !== optimistic));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Ask about this chart</span>
        <span className={styles.headerHint}>
          {session.ticker} · {history.length === 0 ? 'Chart image is included automatically' : `${history.length / 2} exchange${history.length / 2 === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className={styles.messages}>
        {history.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Ask anything about this analysis — why a particular level was chosen, what a pattern means, how an indicator was read, or anything that seems off.
            </p>
            <div className={styles.suggestions}>
              {[
                'Why did you pick that resistance level?',
                'Is this pattern strong enough to act on?',
                'What would change your view on the trend?',
              ].map(s => (
                <button key={s} className={styles.suggestion} onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, i) => <Message key={i} msg={msg} />)}

        {loading && (
          <div className={`${styles.msg} ${styles.msgAI}`}>
            <span className={styles.msgWho}>AI</span>
            <span className={styles.typing}>
              <span /><span /><span />
            </span>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a follow-up question… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={loading}
        />
        <button
          className={`btn btn-primary ${styles.sendBtn}`}
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? <span className="spinner" /> : '↑'}
        </button>
      </div>
    </div>
  );
}
