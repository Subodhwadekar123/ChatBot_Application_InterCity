import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '380px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px dashed var(--border-strong)',
            borderRadius: '14px',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px',
              fontSize: '30px',
            }}
          >
            ⚠️
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Something went wrong
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '22px', fontSize: '13.5px', lineHeight: 1.5 }}>
            An unexpected error occurred while rendering this page. You can try reloading, or go back to the dashboard.
          </p>
          {this.state.error && (
            <pre
              style={{
                backgroundColor: 'var(--bg-canvas)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                color: 'var(--color-danger, #ef4444)',
                maxWidth: '480px',
                overflow: 'auto',
                textAlign: 'left',
                marginBottom: '22px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-primary" onClick={this.handleReset}>
              Try Again
            </button>
            <a href="#/dashboard" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary">Go to Dashboard</button>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;