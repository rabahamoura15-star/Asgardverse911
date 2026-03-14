import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (event.reason instanceof Error) {
      try {
        const parsed = JSON.parse(event.reason.message);
        if (parsed.error && parsed.operationType) {
          this.setState({ hasError: true, error: event.reason });
        }
      } catch (e) {
        // Not a JSON error message, ignore or handle differently
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Access Denied: You do not have permission to ${parsed.operationType} this data.`;
          }
        }
      } catch (e) {
        // Not a JSON error message, use default or the raw message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white p-4">
          <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black uppercase tracking-widest mb-4 text-red-400">System Error</h1>
            <p className="text-white/70 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
