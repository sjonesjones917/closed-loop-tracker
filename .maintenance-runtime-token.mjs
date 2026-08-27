import fs from 'node:fs';
const path='index.html';
const oldToken='runtime-human-chat-v13';
const newToken='runtime-6e61c99da4e764b5';
let text=fs.readFileSync(path,'utf8');
if(!text.includes(oldToken))throw new Error('Expected stale runtime token was not found.');
text=text.split(oldToken).join(newToken);
fs.writeFileSync(path,text);
