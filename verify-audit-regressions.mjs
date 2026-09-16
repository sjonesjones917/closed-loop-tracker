import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source=fs.readFileSync('test-runtime.js','utf8');
const expose='\n;globalThis.__audit={validateRegex,parseJsonSelector,selectJsonPath,parseCsv,parseXml,selectXml,exactApproximate,validateDagSpec,unwrapValue};';
const context={console,TextEncoder,TextDecoder,URL,crypto:crypto.webcrypto,structuredClone,ArrayBuffer,Uint8Array,DataView,setTimeout,clearTimeout};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source.replace(/\}\)\(\);\s*$/,expose+'\n})();'),context,{filename:'test-runtime.js'});
const a=context.__audit;
const failures=[];
const check=(name,condition,detail='')=>{if(!condition)failures.push({name,detail});};
const throwsCode=(name,fn,code)=>{try{fn();failures.push({name,detail:'did not throw'});}catch(e){if(e?.code!==code)failures.push({name,detail:`threw ${e?.code||e}`});}};

// JSON selector: every nonnegative index is part of closed-loop-json-selector/1.
for(const [selector,expected] of [['$[0]',0],['$[1]',1],['$[10]',10]]){
  try{const parts=a.parseJsonSelector(selector);check('json-index-'+selector,parts.length===1&&parts[0].kind==='index'&&parts[0].value===expected,JSON.stringify(parts));}
  catch(e){failures.push({name:'json-index-'+selector,detail:String(e?.code||e)});}
}
try{check('json-escaped-apostrophe',a.selectJsonPath({"a'b":7},"$['a\\'b']")[0]===7);}catch(e){failures.push({name:'json-escaped-apostrophe',detail:String(e?.code||e)});}
try{check('json-escaped-backslash',a.selectJsonPath({'a\\b':9},"$['a\\\\b']")[0]===9);}catch(e){failures.push({name:'json-escaped-backslash',detail:String(e?.code||e)});}

// Regex registry forbids backreferences and Unicode property escapes.
check('regex-backreference-rejected',a.validateRegex('(a)\\1','').length>0);
check('regex-unicode-property-rejected',a.validateRegex('\\p{L}+','u').length>0);
check('regex-escaped-lookahead-literal-allowed',a.validateRegex('\\\\\\(?=a','').length===0,JSON.stringify(a.validateRegex('\\\\\\(?=a','')));

// CSV must preserve a quoted empty final record and reject garbage after a closing quote.
try{check('csv-empty-quoted-record',JSON.stringify(a.parseCsv('""',{delimiter:',',header:false,quote:'"',newline:'AUTO',encoding:'UTF-8'}))==='[[""]]');}catch(e){failures.push({name:'csv-empty-quoted-record',detail:String(e?.code||e)});}
throwsCode('csv-garbage-after-closing-quote',()=>a.parseCsv('"a"b,c',{delimiter:',',header:false,quote:'"',newline:'AUTO',encoding:'UTF-8'}),'MALFORMED_CSV');

// XML must preserve document text order, reject malformed documents, and never expose inherited attributes.
try{const root=a.parseXml('<r>A<x>B</x>C</r>');check('xml-mixed-text-order',a.selectXml(root,'/r/text()')[0]==='ABC',JSON.stringify(a.selectXml(root,'/r/text()')));}catch(e){failures.push({name:'xml-mixed-text-order',detail:String(e?.code||e)});}
for(const xml of ['junk<r/>','<r/>junk','<r>&raw</r>','<r a="<"/>','<r a="1"b="2"/>'])throwsCode('xml-reject-'+xml,()=>a.parseXml(xml),'MALFORMED_XML');
try{const root=a.parseXml('<r/>');throwsCode('xml-no-inherited-constructor',()=>a.selectXml(root,'/r/@constructor'),'XML_PATH_MISSING');}catch(e){failures.push({name:'xml-no-inherited-constructor',detail:String(e?.code||e)});}

// Comparison must not discard ordinary object fields merely because the object has a property named value.
const left={value:'same',status:'FAIL'},right={value:'same',status:'PASS'};
check('unwrap-preserves-user-object',JSON.stringify(a.unwrapValue(left))===JSON.stringify(left),JSON.stringify(a.unwrapValue(left)));
check('object-difference-not-equal',a.exactApproximate(a.unwrapValue(left),a.unwrapValue(right),{})===false);
check('negative-tolerance-rejected',(()=>{try{a.exactApproximate(1,2,{numericMode:'APPROXIMATE',absTol:'-10'});return false;}catch{return true;}})());

if(failures.length){console.error(JSON.stringify({auditRegressions:false,failures},null,2));process.exit(1);}
console.log(JSON.stringify({auditRegressions:true,cases:22}));
