// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {ROOT,PUBLIC_FILES} from './files.mjs';
import {serviceWorker} from './build.mjs';
let pinnedFiles=0;
for(const manifest of ['vendor/PROVENANCE.json','vendor/OUTRUIN.json','vendor/QUICKSCOPER.json']){
  const provenance=JSON.parse(fs.readFileSync(path.join(ROOT,manifest)));
  assert.match(provenance.commit,/^[a-f0-9]{40}$/);
  for(const file of provenance.files){const bytes=fs.readFileSync(path.join(ROOT,file.path));const blob=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(blob,file.gitBlob,'upstream bytes changed: '+file.path);pinnedFiles++;}
}
for(const file of PUBLIC_FILES){
  assert(!file.includes('node_modules')&&!file.includes('tests/')&&!file.includes('scripts/'));
  if(!file.endsWith('.js'))continue;
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');
  for(const m of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
    assert(m[1].startsWith('.'),'external runtime import: '+m[1]);const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),m[1]));assert(PUBLIC_FILES.includes(resolved),`unpackaged import ${file}: ${resolved}`);
  }
}
assert.equal(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),serviceWorker(),'service worker is stale: run node scripts/build.mjs');
for(const file of ['js/sim.js','js/content.js','js/physics.js','js/world.js','js/sniper.js']){const src=fs.readFileSync(path.join(ROOT,file),'utf8');assert(!/Math\.random|Date\.|performance\.|AudioContext|document\.|window\./.test(src),'ambient dependency in pure game core');}
console.log(`PASS: ${pinnedFiles} pinned upstream files, ${PUBLIC_FILES.length} public files, local imports and current offline manifest.`);
