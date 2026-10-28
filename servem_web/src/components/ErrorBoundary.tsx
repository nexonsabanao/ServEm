import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * One failing screen must not blank the whole app. The boundary shows what
 * happened and offers a reload; the error is logged for the browser console.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[servem] screen crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="shell-width py-16">
        <h1 className="page-title">Something went wrong on this screen</h1>
        <p className="page-sub">
          The rest of ServEm is unaffected. Reload to try again, and tell support what you were doing if it repeats.
        </p>
        <button type="button" className="btn btn-primary mt-5" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    );
  }
}
