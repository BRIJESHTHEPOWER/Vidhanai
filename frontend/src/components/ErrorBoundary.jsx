import React from 'react';

/**
 * Global React ErrorBoundary.
 * Catches render-phase errors in any child component tree.
 * Shows a friendly fallback UI instead of a blank screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (fallback) return fallback;

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%)',
          color: '#fff',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚖️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f87171' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: '400px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            An unexpected error occurred in this section. The rest of Vidhan.ai is still working.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.6rem 1.4rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              🔄 Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '0.6rem 1.4rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#cbd5e1',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              🏠 Go Home
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '600px', width: '100%' }}>
              <summary style={{ color: '#f59e0b', cursor: 'pointer', fontSize: '0.8rem' }}>
                Developer: Error details
              </summary>
              <pre style={{
                marginTop: '0.5rem',
                padding: '1rem',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: '8px',
                fontSize: '0.7rem',
                color: '#f87171',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
