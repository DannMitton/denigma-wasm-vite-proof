import { defineConfig } from 'vite';

// Minimal static proof. The Emscripten glue (denigma_wasm_mnx.js) and the
// binary (denigma_wasm_mnx.wasm) live in public/ and are loaded at RUNTIME,
// so Vite does not bundle them; it copies them to the build as-is. This
// mirrors how the glue will run inside a Web Worker in Ilya later.
export default defineConfig({});
