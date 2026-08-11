import { useEffect, useState } from "react";

export interface ConnectionStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType?: "4g" | "3g" | "2g" | "slow-2g" | "unknown";
}

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
};

const CONNECTION_TYPES = ["4g", "3g", "2g", "slow-2g"] as const;

function getNetworkInformation(): NetworkInformation | undefined {
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

/**
 * Hook to monitor network connection status
 * Alerts user when offline or on slow connection
 */
export const useConnectionStatus = (): ConnectionStatus => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: true,
    isSlowConnection: false,
    connectionType: "unknown",
  });

  useEffect(() => {
    // Check initial status
    const updateOnlineStatus = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
      }));
    };

    // Check connection type (if available)
    const checkConnectionType = () => {
      const connection = getNetworkInformation();

      if (connection) {
        const rawType = connection.effectiveType;
        const type = CONNECTION_TYPES.find((candidate) => candidate === rawType) ?? "unknown";
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

    const connection = getNetworkInformation();

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
