import fs from 'node:fs';
const path='.apply-native-test-capability-truth.mjs';
let text=fs.readFileSync(path,'utf8');
const from="replaceText('index.html','runtime-50fa58ef3f827460','runtime-nativecap-b6bc-20260826');";
const to="{const path='index.html',oldToken='runtime-50fa58ef3f827460',newToken='runtime-nativecap-b6bc-20260826',source=fs.readFileSync(path,'utf8'),count=source.split(oldToken).length-1;if(count!==8)throw new Error(`index.html: expected shared build token exactly 8 times, found ${count}`);fs.writeFileSync(path,source.split(oldToken).join(newToken));}";
if(!text.includes(from)||text.indexOf(from)!==text.lastIndexOf(from))throw new Error('Unique index token transformer call not found.');
text=text.replace(from,to);
fs.writeFileSync(path,text);
