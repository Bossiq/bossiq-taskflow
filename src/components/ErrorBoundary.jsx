import React from 'react';

/**
 * React Error Boundary — catches render errors in child components
 * and displays a fallback UI instead of crashing the entire app.
 *
 * Usage: <ErrorBoundary><App /></ErrorBoundary>
 *
 * In production, this would integrate with Sentry or LogRocket
 * to report errors to a monitoring service.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // In production, send to error monitoring service (Sentry, LogRocket, etc.)
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-content">
            <span className="error-boundary-icon">!</span>
            <h1>Something went wrong</h1>
            <p>The application encountered an unexpected error. This has been logged for investigation.</p>
            {!this.props.hideDetails && this.state.error && (
              <details className="error-boundary-details">
                <summary>Technical details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <button className="btn btn-primary" onClick={this.handleRetry}>
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
