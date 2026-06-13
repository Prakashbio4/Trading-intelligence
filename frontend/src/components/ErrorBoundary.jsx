import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset() {
    this.setState({ error: null });
    this.props.onReset?.();
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          margin: '16px 0',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--danger)' }}>
            Rendering error
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
            Something went wrong displaying this section. The data was saved successfully — this is a display bug.
          </p>
          <pre style={{
            fontSize: 11,
            color: 'var(--muted)',
            background: 'var(--surface2)',
            padding: '10px 14px',
            borderRadius: 6,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {this.state.error.message}
          </pre>
          {this.props.onReset && (
            <button
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
              onClick={() => this.reset()}
            >
              {this.props.resetLabel ?? 'Start new session'}
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
