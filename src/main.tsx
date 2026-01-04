import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n"; // Initialize i18n (custom module)
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
