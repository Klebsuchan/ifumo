import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E7E0D6] rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-[#B91C1C]">
              Alerta de Segurança ou Conexão
            </h2>
            <p className="text-sm text-[#57534E] break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-5 py-2.5 bg-[#F59E0B] text-white font-bold text-sm rounded-full hover:bg-[#EA580C] transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
