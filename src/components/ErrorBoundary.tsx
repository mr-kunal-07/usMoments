import React, { ReactNode, ReactError, ReactErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: ReactError, errorInfo: ReactErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: ReactError | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: ReactError): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: ReactError, errorInfo: ReactErrorInfo) {
        // Call optional callback
        this.props.onError?.(error, errorInfo);

        // Log to console in development
        console.error("Error caught by ErrorBoundary:", error, errorInfo);
    }

    reset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-red-50 to-white p-4">
                        <div className="max-w-md text-center">
                            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
                            <p className="text-gray-600 mb-6">
                                We're sorry for the inconvenience. Please try again.
                            </p>
                            {process.env.NODE_ENV === "development" && (
                                <details className="mb-6 text-left bg-red-50 border border-red-200 rounded-lg p-4">
                                    <summary className="cursor-pointer font-mono text-sm text-red-700">
                                        Error Details
                                    </summary>
                                    <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                                        {this.state.error?.toString()}
                                    </pre>
                                </details>
                            )}
                            <Button onClick={this.reset} variant="default">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Again
                            </Button>
                        </div>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}
