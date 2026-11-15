// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
export const ROOT=path.resolve(import.meta.dirname,'..');
const walk=dir=>fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir+'/'+entry.name):[dir+'/'+entry.name]);
export const PUBLIC_FILES=['index.html','style.css','assets/icon.svg','LICENSE','NOTICE',...walk('js'),...walk('vendor')].sort();
