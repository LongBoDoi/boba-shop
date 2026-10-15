'use strict';
/**
 * The three things react-native-svg draws in a browser and not on a phone.
 *
 * None of them is a type error, a lint warning or a difference you can see in the web build, and
 * there is no emulator in this repository — so they are checked by reading the source instead.
 * Each one has already cost something: a crash on the first scoop of ice, an animation that ran
 * everywhere but on the phone, and a cup whose drink stopped following the tea. See "Drawing on a
 * phone, not in a browser" in CLAUDE.md.
 */
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

function sources(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, found);
    else if (path.endsWith('.tsx') || path.endsWith('.ts')) found.push(path);
  }
  return found;
}

const failures = [];
function fail(file, what, why) {
  failures.push(`${file}: ${what}\n    ${why}`);
}

for (const file of sources('src')) {
  const whole = readFileSync(file, 'utf8');
  if (!/from 'react-native-svg'/.test(whole)) continue;
  // Comments in here name every one of these on purpose, so read the code without them.
  const source = whole.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const where = file.replace(/\\/g, '/');

  // 1. A ClipPath is built once and cached. Android never clears that cache, because the path
  //    inside one is never itself drawn and the renderer skips invalidation for anything undrawn.
  for (const [block] of source.matchAll(/<ClipPath[\s\S]*?<\/ClipPath>/g)) {
    if (/animatedProps/.test(block)) {
      const id = block.match(/id=(?:\{`([^`]*)`\}|"([^"]*)")/)?.slice(1).find(Boolean) ?? '?';
      fail(where, `<ClipPath ${id}> holds an animated child`,
        'A clip path is frozen at its first draw on Android. Use a <Mask> — its contents are drawn, so they update.');
    }
  }

  // 2. `transform` becomes the `matrix` a phone reads inside the element, in JavaScript, which an
  //    animated prop never passes through. The array form is read natively; a string is dropped.
  for (const [, quote] of source.matchAll(/\btransform:\s*(['"`])/g)) {
    fail(where, `an animated transform is written as a string (${quote}…${quote})`,
      'Write it as the array form: [{ translateX }, { translateY }, { rotate: `${a}deg` }].');
  }

  // 3. <Use> hands back nothing when it cannot resolve its template, which Android calls a method
  //    on and iOS passes to CFAutorelease.
  if (/<Use[\s/>]/.test(source)) {
    fail(where, '<Use> is rendered',
      'It returns a null path when its template is unresolved, which crashes both phones. Draw the shape where it is needed.');
  }
}

if (failures.length) {
  console.error('check-drawing: this does not draw on a phone\n');
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}
console.log('check-drawing: no animated clips, no string transforms, no <Use>');
