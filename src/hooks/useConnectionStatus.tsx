import React from "react";

export interface ConnectionStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType?: "4g" | "3g" | "2g" | "slow-2g" | "unknown";
}

/**
 * Hook to monitor network connection status
 * Alerts user when offline or on slow connection
 */
export const useConnectionStatus = (): ConnectionStatus => {
  const [status, setStatus] = React.useState<ConnectionStatus>({
    isOnline: true,
    isSlowConnection: false,
    connectionType: "unknown",
  });

  React.useEffect(() => {
    // Check initial status
    const updateOnlineStatus = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
      }));
    };

    // Check connection type (if available)
    const checkConnectionType = () => {
      const connection =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

      if (connection) {
        const type = connection.effectiveType;
        const isSlowConnection = ["slow-2g", "2g", "3g"].includes(type);

        setStatus((prev) => ({
          ...prev,
          isSlowConnection,
          connectionType: type,
        }));
      }
    };

    // Event listeners
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener("change", checkConnectionType);
      checkConnectionType(); // Check initial
    }

    updateOnlineStatus();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      if (connection) {
        connection.removeEventListener("change", checkConnectionType);
      }
    };
  }, []);

  return status;
};

/**
 * Connection Status UI Component
 * Shows indicator when offline or on slow connection
 */
export const ConnectionStatusIndicator: React.FC = () => {
  const { isOnline, isSlowConnection } = useConnectionStatus();

  if (isOnline && !isSlowConnection) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium text-white transition-all ${
        !isOnline ? "bg-red-500" : "bg-yellow-500"
      }`}
    >
      {!isOnline ? (
        <span>⚠️ You are offline. Some features may be limited.</span>
      ) : (
        <span>📡 Slow connection detected. Loading may take longer.</span>
      )}
    </div>
  );
};
