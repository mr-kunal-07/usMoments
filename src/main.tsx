import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";
import { initializeDefaultMetaTags } from "./lib/metaTags";
import { initializePWAInstall } from "./hooks/usePWAInstall";

// Initialize default meta tags for social sharing
initializeDefaultMetaTags();
initializePWAInstall();

createRoot(document.getElementById("root")!).render(<App />);
