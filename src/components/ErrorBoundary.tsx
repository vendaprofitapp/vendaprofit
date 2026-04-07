import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 space-y-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Oops! Ocorreu um erro inesperado.</h1>
                <p className="text-gray-500 mt-2">
                  O aplicativo encontrou um problema interno. Por favor, tire um print desta tela e envie para o suporte.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 font-mono text-sm overflow-auto text-left max-h-[300px]">
                <p className="font-bold text-red-800 break-words mb-2">
                  {this.state.error.toString()}
                </p>
                <div className="text-red-600 text-xs whitespace-pre-wrap leading-relaxed mt-2 p-2 bg-red-100/50 rounded">
                  {this.state.error.stack?.split('\n').filter((_, i) => i < 8).join('\n')}
                </div>
                {this.state.errorInfo && (
                  <div className="text-red-700 text-xs whitespace-pre-wrap leading-relaxed mt-4 pt-4 border-t border-red-200">
                    <p className="font-semibold mb-1">Component Stack:</p>
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                <RefreshCw className="h-4 w-4" /> Recarregar a Pgina
              </button>
              <button
                onClick={() => {
                  window.location.href = "/";
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2.5 rounded-md transition-colors font-medium"
              >
                <Home className="h-4 w-4" /> Ir para o Incio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
