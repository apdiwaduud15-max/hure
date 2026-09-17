
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
              ⚠️
            </div>
            <h2 className="text-xl font-black text-white">XAYSIMO ERP & POS</h2>
            <p className="text-sm text-slate-300">
              Nidaamku wuxuu la kulmay cillad yar oo dhanka furitaanka ah. Guji badhanka hoose si aad dib ugu furto xogtaada oo dhan.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400 font-mono bg-slate-950 p-3 rounded-xl break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg transition-all"
            >
              Dib u Furo Nidaamka (Reload)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
