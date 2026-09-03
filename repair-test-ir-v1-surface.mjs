import fs from 'node:fs';

const runtimePath='test-runtime.js';
let source=fs.readFileSync(runtimePath,'utf8');
const mustReplace=(needle,replacement,label)=>{
  if(!source.includes(needle))throw new Error(`Repair prerequisite missing: ${label}`);
  source=source.replace(needle,replacement);
};

mustReplace("  ASSERT_EXISTS:{required:[],optional:['message'],types:{message:'string'}},\n  ASSERT_TYPE:{required:['value'],optional:['message'],types:{value:'typeName',message:'string'}},\n  ASSERT_NE:{required:['value'],optional:['message','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'}},\n",'', 'non-Version-1 operation definitions');
mustReplace("const ASSERTION_OPS=new Set(['ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);","const ASSERTION_OPS=new Set(['ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);",'assertion registry');
mustReplace("      case 'ASSERT_EXISTS':finalAssertion=resultForAssertion(value!==null&&value!==undefined,'present',value,step.message);break;\n      case 'ASSERT_TYPE':{const actual=bytesOf(value)?'bytes':Array.isArray(value)?'array':value===null?'null':typeof value;finalAssertion=resultForAssertion(actual===step.value,step.value,actual,step.message);break;}\n      case 'ASSERT_NE':finalAssertion=resultForAssertion(!exactEqual(value,step.value,step),`not ${canonical(step.value)}`,value,step.message);break;\n",'', 'non-Version-1 execution cases');

const regexBlock=`function validateRegex(pattern,flags=''){
  const issues=[];const text=String(pattern);const flagText=String(flags||'');
  if(byteLength(text)>LIMITS.maxRegexPatternBytes||text.length>LIMITS.maxRegexLength)issues.push('Regex pattern exceeds the registered byte limit.');
  if(!/^[imsu]*$/.test(flagText)||new Set(flagText).size!==flagText.length)issues.push('Regex flags must be a unique subset of i, m, s, and u.');
  if(/\\\\[1-9]/.test(text)||/\\\\k</.test(text))issues.push('Regex backreferences are not supported.');
  if(/\\\\[pP]\\{/.test(text))issues.push('Unicode property escapes are not supported.');
  for(let index=0;index<text.length;index++){
    if(text[index]!=='('||text[index-1]==='\\\\')continue;
    if(text[index+1]==='?'&&text.slice(index,index+3)!=='(?:')issues.push('Regex lookaround, named groups, and inline mode groups are not supported.');
  }
  if((text.match(/[+*]/g)||[]).length>16)issues.push('Regex contains too many unbounded quantifiers.');
  try{if(!issues.length)new RegExp(text,flagText);}catch(error){issues.push(\`Regex is invalid: \${error.message}\`);}
  return [...new Set(issues)];
}
`;
const beforeRegex=/function validateRegex\(pattern,flags=''\)\{[\s\S]*?\n\}\n\nfunction parseJsonSelector/;
if(!beforeRegex.test(source))throw new Error('validateRegex block not found');
source=source.replace(beforeRegex,()=>regexBlock+'\nfunction parseJsonSelector');

const jsonBlock=`function parseJsonSelector(path){
  const text=String(path||'');
  if(text==='$')return [];
  if(!text.startsWith('$'))fail('UNSUPPORTED_JSON_SELECTOR','JSON selector must begin with $.');
  const parts=[];let i=1;
  const identifier=/^[A-Za-z_$][A-Za-z0-9_$:-]*/;
  while(i<text.length){
    if(parts.length>=LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','JSON selector exceeds the registered depth limit.');
    if(text[i]==='.'){
      i++;
      if(text[i]==='*'){parts.push({kind:'wildcard'});i++;continue;}
      const match=text.slice(i).match(identifier);if(!match)fail('UNSUPPORTED_JSON_SELECTOR',\`Invalid JSON child selector in \${text}.\`);
      parts.push({kind:'key',key:match[0]});i+=match[0].length;continue;
    }
    if(text[i]==='['){
      const end=text.indexOf(']',i+1);if(end<0)fail('UNSUPPORTED_JSON_SELECTOR',\`Unclosed JSON selector bracket in \${text}.\`);
      const raw=text.slice(i+1,end);
      if(raw==='*')parts.push({kind:'wildcard'});
      else if(/^(0|[1-9]\\d*)$/.test(raw))parts.push({kind:'index',index:Number(raw)});
      else{
        const quoted=raw.match(/^'((?:\\\\['\\\\]|[^'\\\\])*)'$/);if(!quoted)fail('UNSUPPORTED_JSON_SELECTOR',\`Only single-quoted child names, nonnegative indexes, and * are supported in brackets: \${text}.\`);
        parts.push({kind:'key',key:quoted[1].replace(/\\\\(['\\\\])/g,'$1')});
      }
      i=end+1;continue;
    }
    fail('UNSUPPORTED_JSON_SELECTOR',\`Unsupported JSON selector syntax in \${text}.\`);
  }
  return parts;
}
function selectJsonPath(value,path){
  const parts=parseJsonSelector(path);let values=[value],expanded=false;
  for(const part of parts){
    const next=[];
    for(const current of values){
      if(part.kind==='wildcard'){
        expanded=true;
        if(Array.isArray(current))next.push(...current);
        else if(current&&typeof current==='object')next.push(...Object.values(current));
        else fail('JSON_PATH_MISSING',\`JSON wildcard does not address a collection: \${path}.\`,STATUS.UNDETERMINED);
      }else if(part.kind==='index'){
        if(!Array.isArray(current)||!hasOwn(current,part.index))fail('JSON_PATH_MISSING',\`JSON selector does not resolve: \${path}.\`,STATUS.UNDETERMINED);
        next.push(current[part.index]);
      }else{
        if(current===null||current===undefined||!hasOwn(Object(current),part.key))fail('JSON_PATH_MISSING',\`JSON selector does not resolve: \${path}.\`,STATUS.UNDETERMINED);
        next.push(current[part.key]);
      }
    }
    values=next;
  }
  if(!values.length)fail('JSON_PATH_MISSING',\`JSON selector does not resolve: \${path}.\`,STATUS.UNDETERMINED);
  return expanded?values:values[0];
}
`;
const jsonRange=/function parseJsonSelector\(path\)\{[\s\S]*?\nfunction decodeXmlEntity/;
if(!jsonRange.test(source))throw new Error('JSON selector block not found');
source=source.replace(jsonRange,()=>jsonBlock+'\nfunction decodeXmlEntity');

const xmlBlock=`function parseXmlSelector(path){
  const text=String(path||'');if(!text.startsWith('/')||text.startsWith('//'))fail('UNSUPPORTED_XML_SELECTOR','XML selector must be an absolute child path beginning with one /.');
  const raw=text.slice(1).split('/');if(!raw.length||raw.some(part=>!part))fail('UNSUPPORTED_XML_SELECTOR','XML selector contains an empty segment.');
  if(raw.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','XML selector exceeds the registered depth limit.');
  return raw.map((part,index)=>{
    if(part==='text()'){if(index!==raw.length-1)fail('UNSUPPORTED_XML_SELECTOR','text() is supported only as the final XML selector segment.');return {kind:'text'};}
    if(part.startsWith('@')){if(index!==raw.length-1||!/^@[A-Za-z_][A-Za-z0-9_.:-]*$/.test(part))fail('UNSUPPORTED_XML_SELECTOR','XML attributes are supported only as a valid final @name segment.');return {kind:'attribute',name:part.slice(1)};}
    const match=part.match(/^(\\*|[A-Za-z_][A-Za-z0-9_.:-]*)(?:\\[(\\d+)\\])?$/);if(!match||match[2]==='0')fail('UNSUPPORTED_XML_SELECTOR',\`Unsupported XML selector segment \${part}.\`);return {kind:'element',name:match[1],index:match[2]?Number(match[2]):null};
  });
}
function xmlText(node){return [...node.textParts,...node.children.map(xmlText)].join('');}
function selectXml(rootNode,path){
  const parts=parseXmlSelector(path);const first=parts.shift();if(first.kind!=='element'||(first.name!=='*'&&first.name!==rootNode.name)||(first.index&&first.index!==1))fail('XML_PATH_MISSING',\`XML selector does not address document element \${rootNode.name}.\`,STATUS.UNDETERMINED);
  let current=[rootNode];
  for(const part of parts){
    if(part.kind==='text')return current.map(xmlText);
    if(part.kind==='attribute')return current.map(node=>node.attributes[part.name]).filter(value=>value!==undefined);
    const next=[];for(const node of current){const matches=node.children.filter(child=>part.name==='*'||child.name===part.name);if(part.index){if(matches[part.index-1])next.push(matches[part.index-1]);}else next.push(...matches);}current=next;
  }
  if(!current.length)fail('XML_PATH_MISSING',\`XML selector does not resolve: \${path}.\`,STATUS.UNDETERMINED);
  return current;
}
`;
const xmlRange=/function parseXmlSelector\(path\)\{[\s\S]*?\n\nfunction validateJsonSourceExact/;
if(!xmlRange.test(source))throw new Error('XML selector block not found');
source=source.replace(xmlRange,()=>xmlBlock+'\n\nfunction validateJsonSourceExact');

fs.writeFileSync(runtimePath,source);

const workflowPath='.github/workflows/pages.yml';
let workflow=fs.readFileSync(workflowPath,'utf8');
const testIrNeedle='          node verify-test-runtime-v3.mjs\n';
if(!workflow.includes(testIrNeedle))throw new Error('Test IR CI insertion point missing.');
if(!workflow.includes('node verify-test-ir-v1-surface.mjs'))workflow=workflow.replace(testIrNeedle,testIrNeedle+'          node verify-test-ir-v1-surface.mjs\n');
fs.writeFileSync(workflowPath,workflow);
console.log('Applied exact Version 1 operation, selector, and regex surface repair.');
