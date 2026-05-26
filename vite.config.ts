import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      output: {
        // Opaque chunk/asset filenames so the main bundle doesn't reveal
        // source-module names (e.g. "ProtectedAppRoutes-<hash>.js").
        chunkFileNames: "assets/c-[hash].js",
        entryFileNames: "assets/e-[hash].js",
        assetFileNames: "assets/a-[hash][extname]",
      },
    },
  },
}));
