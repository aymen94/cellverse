import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// The installed WAMR3D version, shown in the in-app credits. Its package.json is not in
// the package's "exports", so it is read from disk here.
const wamr3dVersion: string = JSON.parse(
  readFileSync(
    new URL("./node_modules/wamr3d/package.json", import.meta.url),
    "utf8",
  ),
).version;

export default defineConfig({
  plugins: [react()],
  define: { __WAMR3D_VERSION__: JSON.stringify(wamr3dVersion) },
    base: '/cellverse/',
  // Keep WAMR3D's compat entry and its add-ons in one module graph. Prebundling them
  // separately can create two WASM instances: init() would set up one while the
  // add-ons (OrbitControls) call into the other.
  optimizeDeps: { exclude: ["wamr3d"] },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
