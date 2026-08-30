(()=>{
'use strict';
const VERSION='closed-loop-test-runtime/2';
const SPEC_VERSION='closed-loop-test-spec/1';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const OPS=Object.freeze([
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',
  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE',
  'ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
]);
const LIMITS=Object.freeze({
  maxInputBytes:16*1024*1024,
  maxDecompressedBytes:32*1024*1024,
  maxSteps:64,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxCollectionItems:100000,
  maxRegexLength:2000,
  maxRegexInputLength:2*1024*1024,
  maxWorkerDurationMs:5000,
  maxArchiveExpansionBytes:32*1024*1024,
  maxCsvCells:250000
});
const FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script','import','url','network']);
const STEP_SCHEMAS=Object.freeze({
  LOAD_ARTIFACT:Object.freeze({required:['binding'],allowed:['op','binding']}),
  READ_BYTES:Object.freeze({required:[],allowed:['op']}),
  DECODE_UTF8:Object.freeze({required:[],allowed:['op','encoding']}),
  PARSE_JSON:Object.freeze({required:[],allowed:['op']}),
  PARSE_CSV:Object.freeze({required:['delimiter','header','quote','newline','encoding'],allowed:['op','delimiter','header','quote','newline','encoding']}),
  PARSE_XML:Object.freeze({required:[],allowed:['op']}),
  SELECT_JSON_PATH:Object.freeze({required:['path'],allowed:['op','path']}),
  SELECT_XML:Object.freeze({required:['path'],allowed:['op','path']}),
  COUNT:Object.freeze({required:[],allowed:['op']}),
  SUM:Object.freeze({required:[],allowed:['op']}),
  MIN:Object.freeze({required:[],allowed:['op']}),
  MAX:Object.freeze({required:[],allowed:['op']}),
  SORT:Object.freeze({required:[],allowed:['op']}),
  UNIQUE:Object.freeze({required:[],allowed:['op']}),
  HASH_SHA256:Object.freeze({required:[],allowed:['op']}),
  REGEX:Object.freeze({required:['pattern'],allowed:['op','pattern','flags']}),
  COMPARE:Object.freeze({required:[],allowed:['op','value','binding']}),
  ASSERT_EQ:Object.freeze({required:['value'],allowed:['op','value','message','absoluteTolerance','relativeTolerance','numericMode']}),
  ASSERT_GT:Object.freeze({required:['value'],allowed:['op','value','message']}),
  ASSERT_GTE:Object.freeze({required:['value'],allowed:['op','value','message']}),
  ASSERT_LT:Object.freeze({required:['value'],allowed:['op','value','message']}),
  ASSERT_LTE:Object.freeze({required:['value'],allowed:['op','value','message']}),
  ASSERT_MATCH:Object.freeze({required:['pattern'],allowed:['op','pattern','flags','message']}),
  ASSERT_CONTAINS:Object.freeze({required:['value'],allowed:['op','value','message']}),
  ASSERT_NOT_CONTAINS:Object.freeze({required:['value'],allowed:['op','value','message']}),
  ASSERT_SET_EQUAL:Object.freeze({required:['value'],allowed:['op','value','message']}),
  BYTE_COMPARE:Object.freeze({required:['binding'],allowed:['op','binding']})
});
const bytesOf=v=>v instanceof Uint8Array?v:v instanceof ArrayBuffer?new Uint8Array(v):ArrayBuffer.isView(v)?new Uint8Array(v.buffer,v.byteOffset,v.byteLength):null;
const field=(t,k)=>t?.fields?.[k]??t?.[k];
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
function parsedDepth(v,seen=new Set()){
  if(v===null||typeof v!=='object')return 0;
  if(seen.has(v))throw new Error('Parsed structure contains a cycle.');
  seen.add(v);let depth=1;
  const values=Array.isArray(v)?v:Object.values(v);
  for(const x of values)depth=Math.max(depth,1+parsedDepth(x,seen));
  seen.delete(v);return depth;
}
function boundCollection(v){if(!Array.isArray(v))throw new Error('Operation requires an array.');if(v.length>LIMITS.maxCollectionItems)throw new Error('Collection exceeds deterministic runtime limit.');return v;}
async function sha256(v){const b=bytesOf(v);if(!b)throw new Error('HASH_SHA256 requires bytes.');if(b.byteLength>LIMITS.maxInputBytes)throw new Error('Input exceeds deterministic runtime byte limit.');const d=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function parseCsv(text,cfg){
  if(cfg.encoding!=='UTF-8')throw new Error('PARSE_CSV version 1 supports only UTF-8.');
  if(typeof cfg.delimiter!=='string'||cfg.delimiter.length!==1)throw new Error('PARSE_CSV delimiter must be one character.');
  if(typeof cfg.quote!=='string'||cfg.quote.length!==1)throw new Error('PARSE_CSV quote must be one character.');
  if(typeof cfg.header!=='boolean')throw new Error('PARSE_CSV header must be boolean.');
  if(!['LF','CRLF','AUTO'].includes(cfg.newline))throw new Error('PARSE_CSV newline must be LF, CRLF, or AUTO.');
  if(cfg.newline==='LF'&&text.includes('\r'))throw new Error('CSV newline contract expected LF.');
  if(cfg.newline==='CRLF'&&/(^|[^\r])\n/.test(text))throw new Error('CSV newline contract expected CRLF.');
  const rows=[];let row=[],cell='',quoted=false,cells=0;const delimiter=cfg.delimiter,quote=cfg.quote;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch===quote&&text[i+1]===quote){cell+=quote;i++;}else if(ch===quote)quoted=false;else cell+=ch;continue;}
    if(ch===quote){if(cell.length)throw new Error('Malformed CSV quote placement.');quoted=true;continue;}
    if(ch===delimiter){row.push(cell);cell='';cells++;}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';cells++;}
    else if(ch==='\r'){if(text[i+1]==='\n')continue;row.push(cell);rows.push(row);row=[];cell='';cells++;}
    else cell+=ch;
    if(cells>LIMITS.maxCsvCells)throw new Error('CSV exceeds cell limit.');
  }
  if(quoted)throw new Error('Malformed CSV: unterminated quoted field.');
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  if(rows.length>LIMITS.maxCollectionItems)throw new Error('CSV exceeds row limit.');
  if(!cfg.header)return rows;
  if(!rows.length)return [];
  const headers=rows[0];if(new Set(headers).size!==headers.length)throw new Error('CSV header contains duplicate names.');
  return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
function parseXml(text){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('XML DTD/entity declarations are unsupported.');
  const root={name:'#document',attributes:{},children:[],text:''},stack=[root],tokens=String(text).match(/<[^>]+>|[^<]+/g)||[];
  for(const token of tokens){
    if(token.startsWith('<?')||token.startsWith('<!--'))continue;
    if(token.startsWith('</')){const name=token.slice(2,-1).trim(),node=stack.pop();if(!node||node.name!==name)throw new Error('Malformed XML closing tag.');continue;}
    if(token.startsWith('<')){
      const selfClose=/\/\s*>$/.test(token),inner=token.slice(1,selfClose?-2:-1).trim(),m=inner.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);
      if(!m)throw new Error('Unsupported XML tag.');
      const attrs={},rest=m[2],attrRe=/\s+([A-Za-z_][\w:.-]*)\s*=\s*(["'])(.*?)\2/g;let am;
      while((am=attrRe.exec(rest)))attrs[am[1]]=am[3];
      if(rest.replace(attrRe,'').trim())throw new Error('Unsupported XML attribute syntax.');
      const node={name:m[1],attributes:attrs,children:[],text:''};stack.at(-1).children.push(node);if(!selfClose)stack.push(node);
    }else stack.at(-1).text+=token;
  }
  if(stack.length!==1)throw new Error('Malformed XML: unclosed element.');
  if(root.children.length!==1)throw new Error('XML must contain exactly one root element.');
  if(parsedDepth(root)>LIMITS.maxParsedDepth)throw new Error('XML exceeds parsed-depth limit.');
  return root.children[0];
}
function selectJsonPath(v,path){
  const t=String(path||'').trim();if(t==='$')return v;if(!t.startsWith('$.'))throw new Error('SELECT_JSON_PATH requires $ or $.path.');
  const parts=t.slice(2).split('.');if(parts.length>LIMITS.maxSelectorDepth)throw new Error('JSON selector exceeds depth limit.');
  let out=v;for(const token of parts){const m=token.match(/^([^\[\]]+)(?:\[(\d+)\])?$/);if(!m)throw new Error('Unsupported JSON selector token.');out=out?.[m[1]];if(m[2]!==undefined)out=out?.[Number(m[2])];if(out===undefined)throw new Error('JSON selector does not resolve.');}return out;
}
function selectXml(root,path){
  const t=String(path||'').trim();if(!t.startsWith('/'))throw new Error('SELECT_XML requires an absolute restricted selector.');
  const parts=t.split('/').filter(Boolean);if(parts.length>LIMITS.maxSelectorDepth)throw new Error('XML selector exceeds depth limit.');
  let nodes=[root];
  for(let i=0;i<parts.length;i++){
    const part=parts[i];
    if(part==='text()'){if(i!==parts.length-1)throw new Error('text() must terminate SELECT_XML.');return nodes.map(n=>n.text).join('');}
    if(part.startsWith('@')){if(i!==parts.length-1||nodes.length!==1)throw new Error('Attribute selection must terminate a single-node SELECT_XML.');return nodes[0].attributes[part.slice(1)];}
    const m=part.match(/^([A-Za-z_][\w:.-]*)(?:\[(\d+)\])?$/);if(!m)throw new Error('Unsupported XML selector token.');
    if(i===0)nodes=nodes.filter(n=>n.name===m[1]);else nodes=nodes.flatMap(n=>n.children.filter(c=>c.name===m[1]));
    if(m[2])nodes=nodes[Number(m[2])-1]?[nodes[Number(m[2])-1]]:[];
    if(!nodes.length)throw new Error('XML selector does not resolve.');
  }
  return nodes.length===1?nodes[0]:nodes;
}
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};
  for(const [name,b] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid binding name ${name}.`);
    if(typeof b==='string'){if(!b.trim())issues.push(`Binding ${name} is empty.`);continue;}
    if(!b||typeof b!=='object'||Array.isArray(b)){issues.push(`Binding ${name} must be an artifact ID or closed object.`);continue;}
    const allowed=new Set(['artifactId','source','artifactRole','filename']);for(const k of Object.keys(b))if(!allowed.has(k))issues.push(`Binding ${name} contains unsupported key ${k}.`);
    if(b.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE'].includes(b.source))issues.push(`Binding ${name} has unsupported source.`);
    if(!b.artifactId&&!b.artifactRole&&!b.filename)issues.push(`Binding ${name} does not identify an artifact.`);
  }
  return {valid:!issues.length,issues};
}
function validateSpec(spec,bindings){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  for(const k of Object.keys(spec))if(!['version','steps'].includes(k))issues.push(`Unknown Test IR property ${k}.`);
  if(spec.version!==SPEC_VERSION)issues.push('Unsupported Test IR version.');
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires steps.');
  if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push('Test IR exceeds step limit.');
  for(const [i,step] of (spec.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${i} is not an object.`);continue;}
    if(!OPS.includes(step.op)){issues.push(`Step ${i} uses unsupported operation ${String(step.op)}.`);continue;}
    const def=STEP_SCHEMAS[step.op];for(const k of Object.keys(step))if(!def.allowed.includes(k))issues.push(`Step ${i} contains unknown property ${k}.`);
    for(const k of def.required)if(!Object.prototype.hasOwnProperty.call(step,k))issues.push(`Step ${i} is missing ${k}.`);
    for(const k of FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,k))issues.push(`Step ${i} contains forbidden executable property ${k}.`);
    if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&String(step.pattern||'').length>LIMITS.maxRegexLength)issues.push(`Step ${i} regex exceeds limit.`);
    if(step.op==='DECODE_UTF8'&&step.encoding&&step.encoding!=='UTF-8')issues.push(`Step ${i} uses unsupported encoding.`);
    if(step.op==='PARSE_CSV'){
      if(typeof step.delimiter!=='string'||step.delimiter.length!==1)issues.push(`Step ${i} delimiter invalid.`);
      if(typeof step.header!=='boolean')issues.push(`Step ${i} header invalid.`);
      if(typeof step.quote!=='string'||step.quote.length!==1)issues.push(`Step ${i} quote invalid.`);
      if(!['LF','CRLF','AUTO'].includes(step.newline))issues.push(`Step ${i} newline invalid.`);
      if(step.encoding!=='UTF-8')issues.push(`Step ${i} encoding invalid.`);
    }
  }
  if(bindings){const b=validateBindings(bindings);issues.push(...b.issues);}
  return {valid:!issues.length,issues};
}
function supports(test){
  if(String(field(test,'EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;
  if(String(field(test,'REQUIRED_CAPABILITY')||'').toUpperCase()!==CAPABILITY)return false;
  if(String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()!=='TEST_IR')return false;
  if(field(test,'EXECUTABLE_SPEC_VERSION')!==SPEC_VERSION)return false;
  return validateSpec(field(test,'EXECUTABLE_SPEC'),field(test,'EXECUTABLE_INPUT_BINDINGS')).valid;
}
function assertion(ok,expected,actual,message){return {determination:ok?'SATISFIED':'VIOLATED',expected,actual,message:message||null};}
function equals(actual,step){
  if(typeof actual==='number'&&typeof step.value==='number'&&(step.absoluteTolerance!==undefined||step.relativeTolerance!==undefined)){
    const abs=Number(step.absoluteTolerance??0),rel=Number(step.relativeTolerance??0),delta=Math.abs(actual-step.value),limit=Math.max(abs,rel*Math.max(Math.abs(actual),Math.abs(step.value)));return delta<=limit;
  }
  if(typeof actual==='number'&&typeof step.value==='number'&&(!Number.isSafeInteger(actual)||!Number.isSafeInteger(step.value))&&step.numericMode!=='BINARY_FLOAT_EXACT')throw new Error('Precision-sensitive numeric equality requires explicit tolerance or numericMode.');
  return stable(actual)===stable(step.value);
}
async function execute({spec,artifacts}){
  const check=validateSpec(spec);if(!check.valid)throw new Error(check.issues.join(' '));
  const src=artifacts&&typeof artifacts==='object'?artifacts:{};let value=null,currentArtifact=null,lastRegex=null,totalBytes=0;const observations=[];
  for(const [i,step] of spec.steps.entries()){
    switch(step.op){
      case'LOAD_ARTIFACT':{const a=src[step.binding];if(!a)throw new Error(`Artifact binding ${step.binding} is unavailable.`);currentArtifact=a;value=a;break;}
      case'READ_BYTES':{const b=bytesOf(currentArtifact?.bytes??value?.bytes??value);if(!b)throw new Error('READ_BYTES requires bytes.');totalBytes+=b.byteLength;if(totalBytes>LIMITS.maxInputBytes)throw new Error('Total input bytes exceed limit.');value=b;break;}
      case'DECODE_UTF8':{const b=bytesOf(value);if(!b)throw new Error('DECODE_UTF8 requires bytes.');value=new TextDecoder('utf-8',{fatal:true}).decode(b);break;}
      case'PARSE_JSON':value=JSON.parse(String(value));if(parsedDepth(value)>LIMITS.maxParsedDepth)throw new Error('JSON exceeds parsed-depth limit.');break;
      case'PARSE_CSV':value=parseCsv(String(value),step);break;
      case'PARSE_XML':value=parseXml(String(value));break;
      case'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;
      case'SELECT_XML':value=selectXml(value,step.path);break;
      case'COUNT':if(value==null||typeof value.length!=='number')throw new Error('COUNT requires array/string.');value=value.length;break;
      case'SUM':case'MIN':case'MAX':{const ns=boundCollection(value).map(Number);if(ns.some(n=>!Number.isFinite(n)))throw new Error(`${step.op} requires finite numbers.`);value=step.op==='SUM'?ns.reduce((a,b)=>a+b,0):step.op==='MIN'?Math.min(...ns):Math.max(...ns);break;}
      case'SORT':value=[...boundCollection(value)].sort((a,b)=>stable(a).localeCompare(stable(b)));break;
      case'UNIQUE':{const seen=new Set();value=boundCollection(value).filter(x=>{const k=stable(x);if(seen.has(k))return false;seen.add(k);return true;});break;}
      case'HASH_SHA256':value=await sha256(value);break;
      case'REGEX':if(String(value).length>LIMITS.maxRegexInputLength)throw new Error('Regex input exceeds limit.');lastRegex=new RegExp(step.pattern,step.flags||'');value=lastRegex.test(String(value));break;
      case'COMPARE':{const other=Object.prototype.hasOwnProperty.call(step,'value')?step.value:src[step.binding]?.value;value=stable(value)===stable(other);break;}
      case'BYTE_COMPARE':{const a=bytesOf(value),b=bytesOf(src[step.binding]?.bytes);if(!a||!b)throw new Error('BYTE_COMPARE requires bytes.');let same=a.byteLength===b.byteLength;if(same)for(let x=0;x<a.length;x++)if(a[x]!==b[x]){same=false;break;}value=same;break;}
      default:{
        let r=null;
        if(step.op==='ASSERT_EQ')r=assertion(equals(value,step),step.value,value,step.message);
        else if(step.op==='ASSERT_GT')r=assertion(Number(value)>Number(step.value),`> ${step.value}`,value,step.message);
        else if(step.op==='ASSERT_GTE')r=assertion(Number(value)>=Number(step.value),`>= ${step.value}`,value,step.message);
        else if(step.op==='ASSERT_LT')r=assertion(Number(value)<Number(step.value),`< ${step.value}`,value,step.message);
        else if(step.op==='ASSERT_LTE')r=assertion(Number(value)<=Number(step.value),`<= ${step.value}`,value,step.message);
        else if(step.op==='ASSERT_MATCH'){if(String(value).length>LIMITS.maxRegexInputLength)throw new Error('Regex input exceeds limit.');const rx=lastRegex||new RegExp(step.pattern,step.flags||'');r=assertion(rx.test(String(value)),String(rx),value,step.message);}
        else if(step.op==='ASSERT_CONTAINS')r=assertion(Array.isArray(value)?value.some(x=>stable(x)===stable(step.value)):String(value).includes(String(step.value)),`contains ${stable(step.value)}`,value,step.message);
        else if(step.op==='ASSERT_NOT_CONTAINS')r=assertion(Array.isArray(value)?!value.some(x=>stable(x)===stable(step.value)):!String(value).includes(String(step.value)),`not contains ${stable(step.value)}`,value,step.message);
        else if(step.op==='ASSERT_SET_EQUAL'){if(!Array.isArray(value)||!Array.isArray(step.value))throw new Error('ASSERT_SET_EQUAL requires arrays.');r=assertion(stable([...new Set(value.map(stable))].sort())===stable([...new Set(step.value.map(stable))].sort()),step.value,value,step.message);}
        if(!r)throw new Error(`Unsupported operation ${step.op}.`);
        observations.push({step:i,op:step.op,...r});if(r.determination==='VIOLATED')return {status:'COMPLETE',determination:'VIOLATED',expected:r.expected,actual:r.actual,observations,executorVersion:VERSION,runtimeVersion:VERSION,specVersion:SPEC_VERSION};continue;
      }
    }
    observations.push({step:i,op:step.op});
  }
  const a=[...observations].reverse().find(x=>x.determination);return {status:'COMPLETE',determination:a?.determination||'UNDETERMINED',expected:a?.expected??null,actual:a?.actual??value,observations,executorVersion:VERSION,runtimeVersion:VERSION,specVersion:SPEC_VERSION};
}
async function executeTest(test,artifacts,canonicalBindings={}){const spec=field(test,'EXECUTABLE_SPEC'),bindings=field(test,'EXECUTABLE_INPUT_BINDINGS'),check=validateSpec(spec,bindings);if(!check.valid)throw new Error(check.issues.join(' '));return execute({spec,artifacts:{...canonicalBindings,...artifacts}});}
globalThis.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,CAPABILITY,OPS,LIMITS,STEP_SCHEMAS,validateSpec,validateBindings,supports,execute,executeTest,capabilities:()=>Object.freeze([CAPABILITY])});
})();