/* Verify the scoped UUID override stays compatible with Expo's Xcode tooling. */
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const expoRequire = createRequire(require.resolve('@expo/config-plugins'));
const xcodePath = expoRequire.resolve('xcode');
const xcodeRequire = createRequire(xcodePath);
const uuid = xcodeRequire('uuid');
const project = expoRequire('xcode').project('dependency-check.pbxproj');
project.hash = { project: { objects: {} } };

const ids = new Set();
for (let i = 0; i < 32; i++) {
  const id = project.generateUuid();
  assert.match(id, /^[A-F0-9]{24}$/, 'Xcode receives a valid project ID');
  assert.ok(!ids.has(id), 'Project IDs remain unique');
  ids.add(id);
}

assert.throws(
  () => uuid.v5('boba-shop', uuid.v5.DNS, new Uint8Array(1)),
  RangeError,
  'UUID rejects an undersized output buffer',
);
console.log('Passed: Xcode project IDs and patched UUID buffer bounds.');
