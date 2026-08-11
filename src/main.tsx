import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeDefaultMetaTags } from "./lib/metaTags";

// Initialize default meta tags for social sharing
initializeDefaultMetaTags();

createRoot(document.getElementById("root")!).render(<App />);
