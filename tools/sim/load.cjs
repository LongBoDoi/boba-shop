/* Shared loader: transpile the game's TypeScript from the repo in place, in memory, writing nothing. */
const fs = require('node:fs');
const path = require('node:path');
// The repo root, found from this file so the harness travels between machines.
const ROOT = path.resolve(__dirname, '..', '..');
const ts = require(path.join(ROOT, 'node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(out.outputText, filename);
};
// A sprite is its own URL: in Node a stub string is all the layout needs.
for (const ext of ['.png', '.jpg', '.wav', '.mp3', '.webp']) {
  require.extensions[ext] = (module, filename) => { module.exports = { default: filename }; };
}
module.exports = { ROOT, src: (p) => require(path.join(ROOT, 'src', p)) };
