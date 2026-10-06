import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { auditService } from '../../services';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorPayload = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      errorMessage: error.message,
      stack: error.stack?.substring(0, 500),
      componentStack: errorInfo.componentStack?.substring(0, 500),
    };
    console.error('[Application ErrorBoundary Caught Error]:', errorPayload);
    this.setState({ error, errorInfo });

    // Cố gắng ghi nhận sự cố UI vào auditlogs để đơn giản hóa vận hành & truy vết lỗi
    (async () => {
      try {
        await auditService.insertAuditLog({
          action: 'CLIENT_UI_CRASH',
          details: `Lỗi giao diện: ${error.message} tại ${window.location.pathname}. Stack: ${error.stack?.substring(0, 300)}`
        });
      } catch {
        // Bỏ qua nếu có lỗi mạng hoặc offline
      }
    })();
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm my-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900">
              {this.props.fallbackTitle || 'Đã xảy ra lỗi hiển thị'}
            </h3>
            
            <p className="text-sm text-gray-600">
              {this.props.fallbackMessage || 'Hệ thống đã tự động cô lập sự cố để bảo vệ dữ liệu. Vui lòng bấm thử lại hoặc tải lại trang.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left text-xs bg-gray-100 p-3 rounded-lg text-red-700 overflow-auto max-h-40">
                <summary className="font-semibold cursor-pointer">Chi tiết lỗi kỹ thuật</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.toString()}</pre>
              </details>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <RefreshCw size={15} /> Thử lại
              </button>
              
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-[#004182] text-white hover:bg-blue-800 rounded-xl text-sm font-semibold shadow transition flex items-center gap-1.5"
              >
                <Home size={15} /> Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
