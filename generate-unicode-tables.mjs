import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('./specification/unicode-15.1.0/',import.meta.url);
export const sourceHashes=Object.freeze({
 'DerivedCoreProperties.txt':'f55d0db69123431a7317868725b1fcbf1eab6b265d756d1bd7f0f6d9f9ee108b',
 'UnicodeData.txt':'2fc713e6a31a87c4850a37fe2caffa4218180fadb5de86b43a143ddb4581fb86',
 'CompositionExclusions.txt':'59d2d9e3dfdf0a999cf9dae11d594f053631222679a2f5710315ea07f7fe82af',
 'CaseFolding.txt':'4e55acfdc32825a22e87670e9056a3bf94ad7c5400065778e9e10f8314372bcf',
 'confusables.txt':'8289f833e4cf78fde56b2080dc0e42934ef5182c9c3f4dd1fbdf2bced69fd5ed',
 'NormalizationTest.txt':'871238e37e3be0696ec2bd0891119a041b052da1a84485eda05a5438724b223e'
});
export function readUnicodeSource(name){const bytes=fs.readFileSync(new URL(name,root));if(crypto.createHash('sha256').update(bytes).digest('hex')!==sourceHashes[name])throw new Error('Pinned Unicode data mismatch: '+name);return bytes.toString('utf8');}
const dataRows=text=>text.split(/\r?\n/).map(line=>line.split('#')[0].trim()).filter(Boolean);
const sequence=text=>text.trim().split(/\s+/).filter(Boolean).map(cp=>parseInt(cp,16));
export function generateUnicodeTables(){
 const decomposition=[],combining=[],caseFolding=[],confusables=[];
 for(const line of dataRows(readUnicodeSource('UnicodeData.txt'))){const cells=line.split(';'),cp=parseInt(cells[0],16);if(Number(cells[3]))combining.push([cp,[Number(cells[3])]]);if(cells[5]&&!cells[5].startsWith('<'))decomposition.push([cp,sequence(cells[5])]);}
 for(const line of dataRows(readUnicodeSource('CaseFolding.txt'))){const [from,status,to]=line.split(';').map(s=>s.trim());if(status==='C'||status==='F')caseFolding.push([parseInt(from,16),sequence(to)]);}
 for(const line of dataRows(readUnicodeSource('confusables.txt'))){const [from,to]=line.split(';');const source=sequence(from);if(source.length!==1)throw new Error('Unsupported multi-scalar confusable source');confusables.push([source[0],sequence(to)]);}
 const encode=rows=>rows.sort((a,b)=>a[0]-b[0]).map(([from,to])=>from.toString(16)+'='+to.map(cp=>cp.toString(16)).join(',')).join(';');
 const exclusions=dataRows(readUnicodeSource('CompositionExclusions.txt')).map(line=>parseInt(line,16)).sort((a,b)=>a-b).map(cp=>cp.toString(16)).join(',');
 const defaultIgnorables=dataRows(readUnicodeSource('DerivedCoreProperties.txt')).filter(line=>line.split(';')[1]?.trim()==='Default_Ignorable_Code_Point').map(line=>line.split(';')[0].trim()).join(',');
 return {caseFolding:encode(caseFolding),combining:encode(combining),compositionExclusions:exclusions,confusables:encode(confusables),decomposition:encode(decomposition),defaultIgnorables};
}
export function generatedUnicodeBlock(){const data=generateUnicodeTables(),digest=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');return '// BEGIN PINNED UNICODE 15.1 TABLES — generated\n/*\n'+fs.readFileSync(new URL('LICENSE',root),'utf8')+'*/\nconst UNICODE_TABLE_DATA=Object.freeze('+JSON.stringify(data)+');\nconst UNICODE_TABLE_SHA256='+JSON.stringify(digest)+';\nconst UNICODE_SOURCE_DIGESTS=Object.freeze('+JSON.stringify(sourceHashes)+');\n// END PINNED UNICODE 15.1 TABLES';}
if(process.argv[1]===fileURLToPath(import.meta.url)&&process.argv.includes('--write')){const file=new URL('./hash.js',import.meta.url),source=fs.readFileSync(file,'utf8'),block=generatedUnicodeBlock(),pattern=/\/\/ BEGIN PINNED UNICODE 15\.1 TABLES[\s\S]*?\/\/ END PINNED UNICODE 15\.1 TABLES/;fs.writeFileSync(file,pattern.test(source)?source.replace(pattern,block):source.replace('const BASE32HEX_ALPHABET=',block+'\nconst BASE32HEX_ALPHABET='));}
