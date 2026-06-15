// Loads Patterson's denigma WASM glue at runtime from the served root, then
// converts a .musx buffer to MNX JSON. The malloc/HEAPU8/call/read/free dance
// is taken from his own example so it is faithful to his memory handling.

const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const sampleBtn = document.getElementById('sample');
const fileInput = document.getElementById('file');

let Module = null;

const POINTER_SIZE = 4;
const SIZE_T_TYPE = 'i32';
const readPointer = (ptr) => Module.getValue(ptr, '*');
const readSize = (ptr) => Module.getValue(ptr, SIZE_T_TYPE);

async function load() {
  try {
    // Runtime import, NOT a bundled import: the glue resolves
    // denigma_wasm_mnx.wasm relative to its own served URL, so both files
    // must sit together in the served root (they do, from public/).
    const { default: createModule } = await import(/* @vite-ignore */ '/denigma_wasm_mnx.js');
    Module = await createModule({
      print: (t) => console.log(t),
      printErr: (t) => console.error(t),
    });
    statusEl.textContent = 'Score reader ready. Convert the sample, or pick a .musx file.';
    sampleBtn.disabled = false;
    fileInput.disabled = false;
  } catch (err) {
    statusEl.textContent = 'The score reader did not finish loading: ' + (err?.message || err);
  }
}

function convert(bytes) {
  const inputPtr = Module._denigma_malloc(bytes.byteLength);
  Module.HEAPU8.set(bytes, inputPtr);

  const outputPtrPtr = Module._denigma_malloc(POINTER_SIZE);
  const outputSizePtr = Module._denigma_malloc(POINTER_SIZE);
  const errorPtrPtr = Module._denigma_malloc(POINTER_SIZE);
  Module.setValue(outputPtrPtr, 0, '*');
  Module.setValue(outputSizePtr, 0, SIZE_T_TYPE);
  Module.setValue(errorPtrPtr, 0, '*');

  try {
    const rc = Module._denigma_musx_to_mnx_json(inputPtr, bytes.byteLength, outputPtrPtr, outputSizePtr, errorPtrPtr);
    if (rc !== 0) {
      const errorPtr = readPointer(errorPtrPtr);
      const message = errorPtr ? Module.UTF8ToString(errorPtr) : 'conversion failed';
      if (errorPtr) Module._denigma_free(errorPtr);
      throw new Error(message);
    }
    const outputPtr = readPointer(outputPtrPtr);
    const outputSize = readSize(outputSizePtr);
    const json = new TextDecoder().decode(Module.HEAPU8.subarray(outputPtr, outputPtr + outputSize));
    Module._denigma_free(outputPtr);
    return json;
  } finally {
    Module._denigma_free(inputPtr);
    Module._denigma_free(outputPtrPtr);
    Module._denigma_free(outputSizePtr);
    Module._denigma_free(errorPtrPtr);
  }
}

async function run(bytes, label) {
  statusEl.textContent = `Reading ${label}...`;
  outputEl.textContent = '';
  try {
    const json = convert(bytes);
    JSON.parse(json); // prove the output is valid MNX JSON
    statusEl.textContent = `Converted ${label}: ${bytes.byteLength} MUSX bytes to ${json.length} MNX JSON characters.`;
    outputEl.textContent = json.slice(0, 2000) + (json.length > 2000 ? '\n\n...truncated.' : '');
  } catch (err) {
    statusEl.textContent = `Conversion failed: ${err?.message || err}`;
  }
}

sampleBtn.addEventListener('click', async () => {
  const res = await fetch('/sample.musx');
  const bytes = new Uint8Array(await res.arrayBuffer());
  run(bytes, 'sample.musx');
});

fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  const bytes = new Uint8Array(await f.arrayBuffer());
  run(bytes, f.name);
});

load();
