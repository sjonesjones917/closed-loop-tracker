import fs from 'node:fs';
import crypto from 'node:crypto';
await import('./hash.js');
const hash=globalThis.closedLoopHash,root='unicode-data/15.1.0/',manifest=JSON.parse(fs.readFileSync(root+'sources.json','utf8'));
if(manifest.version!=='15.1.0'||manifest.sourceCommit!=='9595f090650e99e3e752b37a7a3866ac8a91999b')throw new Error('Pinned Unicode source identity changed.');
const files={};for(const item of manifest.files){const bytes=fs.readFileSync(root+item.path);if(bytes.length!==item.byteLength||crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256||crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex')!==item.gitBlobSha1)throw new Error('Pinned Unicode source bytes changed: '+item.path);files[item.path]=bytes.toString('utf8');}
const combiningClasses={},canonicalDecompositions={},compositions={},caseFoldMappings={},confusableMappings={},excluded=new Set();
for(const raw of files['DerivedNormalizationProps.txt'].split('\n')){const [range,property]=raw.split('#')[0].split(';').map(x=>x.trim());if(property!=='Full_Composition_Exclusion')continue;const [start,end=start]=range.split('..').map(x=>parseInt(x,16));for(let cp=start;cp<=end;cp++)excluded.add(cp);}
for(const row of files['UnicodeData.txt'].split('\n')){if(!row)continue;const fields=row.split(';'),cp=parseInt(fields[0],16),ccc=Number(fields[3]);if(ccc)combiningClasses[cp]=ccc;if(fields[5]&&!fields[5].startsWith('<'))canonicalDecompositions[cp]=fields[5].split(' ').map(x=>parseInt(x,16));}
for(const [cp,parts] of Object.entries(canonicalDecompositions))if(parts.length===2&&!excluded.has(Number(cp)))compositions[parts.join(',')]=Number(cp);
for(const raw of files['CaseFolding.txt'].split('\n')){const [cp,status,mapping]=raw.split('#')[0].split(';').map(x=>x.trim());if(!['C','F'].includes(status))continue;caseFoldMappings[parseInt(cp,16)]=mapping.split(' ').map(x=>parseInt(x,16));}
for(const raw of files['confusables.txt'].split('\n')){const [source,target,status]=raw.split('#')[0].split(';').map(x=>x.trim());if(!source)continue;if(source.includes(' ')||status!=='MA')throw new Error('Unsupported pinned confusable row.');confusableMappings[parseInt(source,16)]=target.split(' ').map(x=>parseInt(x,16));}
const tables={combiningClasses,canonicalDecompositions,compositions,caseFoldMappings,confusableMappings},tableSha256=hash.sha256Value(tables),license=fs.readFileSync(root+'LICENSE.txt','utf8');
const generated='// BEGIN PINNED UNICODE 15.1 TABLES\n/* '+license.replaceAll('*/','* /')+' */\nconst PINNED_UNICODE_TABLES='+JSON.stringify(tables)+';\nconst PINNED_UNICODE_TABLE_SHA256='+JSON.stringify(tableSha256)+';\nconst PINNED_UNICODE_SOURCES='+JSON.stringify(manifest.files)+';\n// END PINNED UNICODE 15.1 TABLES';
const original=fs.readFileSync('hash.js','utf8'),pattern=/\/\/ BEGIN PINNED UNICODE 15\.1 TABLES[\s\S]*?\/\/ END PINNED UNICODE 15\.1 TABLES/;
const updated=pattern.test(original)?original.replace(pattern,()=>generated):original.replace("const BASE32HEX_ALPHABET='0123456789abcdefghijklmnopqrstuv';",match=>match+'\n'+generated);
if(process.argv.includes('--check')){if(updated!==original)throw new Error('Bundled Unicode tables do not reproduce from their pinned source bytes.');}else fs.writeFileSync('hash.js',updated);
console.log(JSON.stringify({sourceCommit:manifest.sourceCommit,tableSha256,rows:Object.fromEntries(Object.entries(tables).map(([key,value])=>[key,Object.keys(value).length])),byteReproduction:'PASS'},null,2));
