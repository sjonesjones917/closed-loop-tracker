import fs from 'node:fs';
const path='verify-ingestion.mjs';
let text=fs.readFileSync(path,'utf8');
const from="INPUT_SET_CONTENTS:'Human request and invention-packet.zip'";
const to="INPUT_SET_CONTENTS:JSON.stringify(completeIntakeCapture(p))";
if(!text.includes(from))throw new Error('Smart-quote Stage 01 fixture anchor missing.');
text=text.replace(from,to);
fs.writeFileSync(path,text);
