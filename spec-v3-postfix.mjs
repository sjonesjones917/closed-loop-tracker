import fs from 'node:fs';
const file='verify-spec-v3.mjs';
let s=fs.readFileSync(file,'utf8');
s=s.replace("import {webcrypto} from 'node:crypto';\nglobalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);globalThis.crypto=globalThis.crypto||webcrypto;","globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);");
fs.writeFileSync(file,s);
