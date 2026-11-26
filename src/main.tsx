import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h1 className="text-lg font-bold text-rose-400">
              Erro ao inicializar o DriveSync Turbo
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed break-words">
              {this.state.error.message || 'Ocorreu uma falha inesperada na inicialização.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
