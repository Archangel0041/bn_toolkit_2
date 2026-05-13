import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAssetServiceWorker } from "./lib/assetCache";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the asset cache SW after the app mounts so it doesn't block first paint.
registerAssetServiceWorker();
