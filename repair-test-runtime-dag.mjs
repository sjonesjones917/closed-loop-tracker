import fs from 'node:fs';

const path='test-runtime.js';
let source=fs.readFileSync(path,'utf8');
const requireText=(needle,label=needle)=>{if(!source.includes(needle))throw new Error(`Repair precondition failed: ${label}`);};
const replaceOnce=(needle,replacement,label=needle)=>{requireText(needle,label);source=source.replace(needle,replacement);};
const replaceBetween=(start,end,replacement,label=start)=>{
  const a=source.indexOf(start);if(a<0)throw new Error(`Repair start marker missing: ${label}`);
  const b=source.indexOf(end,a+start.length);if(b<0)throw new Error(`Repair end marker missing: ${label}`);
  source=source.slice(0,a)+replacement+source.slice(b);
};

const amendmentMarker='\n/* INTEGRATED CONTROLLING COMPLETION 53-70 */';
const amendmentIndex=source.indexOf(amendmentMarker);
if(amendmentIndex>=0)source=source.slice(0,amendmentIndex).trimEnd()+'\n';

replaceOnce(
"const CAPABILITY='CLOSED_LOOP_TEST_IR';\n",
"const CAPABILITY='CLOSED_LOOP_TEST_IR';\nconst TEST_IR_LANGUAGE_VERSION='closed-loop-test-ir-language/1';\nconst OPERATION_REGISTRY_VERSION='closed-loop-test-ir-operations/1';\nconst OPERATION_REGISTRY_SHA256='370d3c04ffe55cb21311607833de5311afde8a15e443093abf43425bb44eb393';\nconst JSON_SELECTOR_REGISTRY_VERSION='closed-loop-json-selector/1';\nconst JSON_SELECTOR_REGISTRY_SHA256='546daaa22cccdbbdb10ba55da859b21b09c852781f42726cd5fb4f8356cd1ee5';\nconst XML_SELECTOR_REGISTRY_VERSION='closed-loop-xml-selector/1';\nconst XML_SELECTOR_REGISTRY_SHA256='83077fa4cfae3a215852e01728cde32f943c46ae7ba4bc5e845b2347b4a0a903';\nconst REGEX_REGISTRY_VERSION='closed-loop-regex/1';\nconst REGEX_REGISTRY_SHA256='dd4585d69d80059a7b284ef1307e2782ab5de81439b3ce0da31aa634de6ab2b8';\n",
'insert Test IR registry identities');

const portContracts=`const PORT_CONTRACTS=Object.freeze({
  LOAD_ARTIFACT:Object.freeze({requiredInputs:Object.freeze(['binding']),optionalInputs:Object.freeze([]),outputs:Object.freeze({artifact:'ARTIFACT'})}),
  READ_BYTES:Object.freeze({requiredInputs:Object.freeze(['artifact']),optionalInputs:Object.freeze([]),outputs:Object.freeze({bytes:'BYTES'})}),
  DECODE_UTF8:Object.freeze({requiredInputs:Object.freeze(['bytes']),optionalInputs:Object.freeze([]),outputs:Object.freeze({text:'STRING'})}),
  PARSE_JSON:Object.freeze({requiredInputs:Object.freeze(['text']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'VALUE'})}),
  PARSE_CSV:Object.freeze({requiredInputs:Object.freeze(['text','delimiter','header','quote','newline','encoding']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'VALUE'})}),
  PARSE_XML:Object.freeze({requiredInputs:Object.freeze(['text']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'XML_NODE'})}),
  SELECT_JSON_PATH:Object.freeze({requiredInputs:Object.freeze(['value','path']),optionalInputs:Object.freeze([]),outputs:Object.freeze({selection:'VALUE'})}),
  SELECT_XML:Object.freeze({requiredInputs:Object.freeze(['value','path']),optionalInputs:Object.freeze([]),outputs:Object.freeze({selection:'VALUE'})}),
  COUNT:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({count:'INTEGER'})}),
  SUM:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'INTEGER'})}),
  MIN:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'INTEGER'})}),
  MAX:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'INTEGER'})}),
  SORT:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze(['direction','domain']),outputs:Object.freeze({value:'VALUE'})}),
  UNIQUE:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'VALUE'})}),
  HASH_SHA256:Object.freeze({requiredInputs:Object.freeze(['bytes']),optionalInputs:Object.freeze([]),outputs:Object.freeze({sha256:'STRING'})}),
  REGEX:Object.freeze({requiredInputs:Object.freeze(['value','pattern']),optionalInputs:Object.freeze(['flags']),outputs:Object.freeze({match:'BOOLEAN'})}),
  COMPARE:Object.freeze({requiredInputs:Object.freeze(['left','right']),optionalInputs:Object.freeze(['operator','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance']),outputs:Object.freeze({comparison:'BOOLEAN'})}),
  ASSERT_EQ:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['numericMode','absTol','relTol','absoluteTolerance','relativeTolerance','message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_GT:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_GTE:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_LT:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_LTE:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_MATCH:Object.freeze({requiredInputs:Object.freeze(['actual','pattern']),optionalInputs:Object.freeze(['flags','message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_CONTAINS:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_NOT_CONTAINS:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_SET_EQUAL:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  BYTE_COMPARE:Object.freeze({requiredInputs:Object.freeze(['left','right']),optionalInputs:Object.freeze([]),outputs:Object.freeze({comparison:'BOOLEAN'})})
});
const OPS=Object.freeze(Object.keys(PORT_CONTRACTS));
const ASSERTION_OPS=new Set(['ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);
`;
replaceBetween('const OPS=Object.freeze(Object.keys(OP_DEFINITIONS));','const encoder=new TextEncoder();',portContracts+'const encoder=new TextEncoder();','replace canonical operation registry');

const regexBlock=`function validateRegex(pattern,flags=''){
  const issues=[];const text=String(pattern);const flagText=String(flags||'');
  if(byteLength(text)>LIMITS.maxRegexPatternBytes||text.length>LIMITS.maxRegexLength)issues.push('Regex pattern exceeds the registered byte limit.');
  if(!/^[imsu]*$/.test(flagText)||new Set(flagText).size!==flagText.length)issues.push('Regex flags must be a unique subset of i, m, s, and u.');
  if(/\\\\[1-9]/.test(text)||/\\\\k</.test(text))issues.push('Regex backreferences are not supported.');
  if(/\\\\[pP]\\{/.test(text))issues.push('Unicode property escapes are not supported in closed-loop-regex/1.');
  for(let i=0;i<text.length;i++){
    if(text[i]==='\\\\'){i++;continue;}
    if(text[i]==='('&&text[i+1]==='?'&&text[i+2]!==':')issues.push('Regex lookaround, named groups, and inline mode groups are not supported.');
  }
  if(/\\((?:[^()\\\\]|\\\\.)*[+*](?:[^()\\\\]|\\\\.)*\\)\\s*(?:[+*]|\\{)/.test(text))issues.push('Regex nested unbounded quantification is outside the registered safe subset.');
  if((text.match(/(?:^|[^\\\\])[+*]/g)||[]).length>16)issues.push('Regex contains too many unbounded quantifiers.');
  try{if(!issues.length)new RegExp(text,flagText);}catch(error){issues.push(`Regex is invalid: ${error.message}`);}
  return [...new Set(issues)];
}

`;
replaceBetween('function validateRegex(pattern,flags=\'\'){','function parseJsonSelector(path){',regexBlock+'function parseJsonSelector(path){','replace regex registry semantics');

const selectorBlock=`function parseJsonSelector(path){
  const text=String(path||'');if(text==='$')return [];
  if(!text.startsWith('$'))fail('UNSUPPORTED_JSON_SELECTOR','JSON selector must begin with $.');
  const parts=[];let i=1;
  const identifier=()=>{const match=text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(!match)fail('UNSUPPORTED_JSON_SELECTOR',`Expected identifier at character ${i} in ${text}.`);i+=match[0].length;return match[0];};
  const quotedName=()=>{if(text[i]!=="'")fail('UNSUPPORTED_JSON_SELECTOR',`Expected single-quoted bracket name in ${text}.`);i++;let out='';while(i<text.length){const ch=text[i++];if(ch==="'")return out;if(ch==='\\\\'){if(i>=text.length)fail('UNSUPPORTED_JSON_SELECTOR',`Invalid bracket-name escape in ${text}.`);const next=text[i++];if(next!=="'"&&next!=='\\\\')fail('UNSUPPORTED_JSON_SELECTOR',`Only escaped quote and backslash are supported in bracket names: ${text}.`);out+=next;}else out+=ch;}fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed bracket name in ${text}.`);};
  while(i<text.length){
    if(text[i]==='.'){
      i++;if(text[i]==='*'){parts.push({kind:'wildcard'});i++;}
      else parts.push({kind:'child',key:identifier()});
    }else if(text[i]==='['){
      i++;if(text[i]==='*'){i++;if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Malformed wildcard segment in ${text}.`);parts.push({kind:'wildcard'});}
      else if(text[i]==="'"){const key=quotedName();if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed bracket-name segment in ${text}.`);parts.push({kind:'child',key});}
      else {const match=text.slice(i).match(/^(0|[1-9]\\d*)/);if(!match)fail('UNSUPPORTED_JSON_SELECTOR',`Only nonnegative array indexes, single-quoted child names, and * are supported in brackets: ${text}.`);i+=match[0].length;if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed array index in ${text}.`);parts.push({kind:'index',index:Number(match[0])});}
    }else fail('UNSUPPORTED_JSON_SELECTOR',`Unsupported JSON selector character ${text[i]} at ${i}.`);
    if(parts.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','JSON selector exceeds the registered depth limit.');
  }
  return parts;
}
function selectJsonPath(value,path){
  const parts=parseJsonSelector(path);let current=[value],multi=false;
  for(const part of parts){
    const next=[];
    for(const node of current){
      if(part.kind==='child'){
        if(node!==null&&typeof node==='object'&&hasOwn(node,part.key))next.push(node[part.key]);
      }else if(part.kind==='index'){
        if(Array.isArray(node)&&part.index<node.length)next.push(node[part.index]);
      }else if(part.kind==='wildcard'){
        multi=true;if(Array.isArray(node))next.push(...node);else if(node!==null&&typeof node==='object')next.push(...Object.values(node));
      }
    }
    if(!next.length)fail('JSON_PATH_MISSING',`JSON selector does not resolve: ${path}.`,STATUS.UNDETERMINED);
    current=next;
  }
  return multi?current:current[0];
}

`;
replaceBetween('function parseJsonSelector(path){','function decodeXmlEntity(entity){',selectorBlock+'function decodeXmlEntity(entity){','replace JSON selector registry semantics');

const dagValidation=`function deepClone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function isInputRef(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const keys=Object.keys(value);
  if(keys.length===1&&keys[0]==='literal')return true;
  if(keys.length===1&&keys[0]==='bindingRef')return typeof value.bindingRef==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value.bindingRef);
  if(keys.length===2&&keys.includes('stepRef')&&keys.includes('output'))return typeof value.stepRef==='string'&&typeof value.output==='string'&&value.output.length>0;
  return false;
}
function validateDagSpec(spec,bindings){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  const rootKeys=['version','languageVersion','operationRegistryVersion','operationRegistrySha256','steps','result'];
  for(const key of Object.keys(spec))if(!rootKeys.includes(key))issues.push(`Test IR contains unknown root property ${key}.`);
  for(const key of rootKeys)if(!hasOwn(spec,key))issues.push(`Test IR is missing required root property ${key}.`);
  if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${String(spec.version)}.`);
  if(spec.languageVersion!==TEST_IR_LANGUAGE_VERSION)issues.push(`Unsupported Test IR language version ${String(spec.languageVersion)}.`);
  if(spec.operationRegistryVersion!==OPERATION_REGISTRY_VERSION)issues.push(`Unsupported operation registry version ${String(spec.operationRegistryVersion)}.`);
  if(spec.operationRegistrySha256!==OPERATION_REGISTRY_SHA256)issues.push('Operation registry digest does not match the current registered semantics.');
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');
  if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push(`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`);
  const ids=new Set(),prior=new Map();
  for(const [index,step] of (spec.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} must be an object.`);continue;}
    for(const key of Object.keys(step))if(!['stepId','op','inputs'].includes(key))issues.push(`Step ${index} contains unknown property ${key}.`);
    if(typeof step.stepId!=='string'||!/^S[0-9]{3,}$/.test(step.stepId))issues.push(`Step ${index} requires a canonical stepId such as S001.`);
    else if(ids.has(step.stepId))issues.push(`Duplicate stepId ${step.stepId}.`);
    const contract=PORT_CONTRACTS[step.op];if(!contract){issues.push(`Step ${index} uses unknown operation ${String(step.op)}.`);continue;}
    if(!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)){issues.push(`Step ${index} operation ${step.op} requires a closed inputs object.`);continue;}
    const allowed=[...contract.requiredInputs,...contract.optionalInputs];for(const key of Object.keys(step.inputs))if(!allowed.includes(key))issues.push(`Step ${index} operation ${step.op} contains unknown input port ${key}.`);
    for(const key of contract.requiredInputs)if(!hasOwn(step.inputs,key))issues.push(`Step ${index} operation ${step.op} is missing required input port ${key}.`);
    for(const [name,ref] of Object.entries(step.inputs)){
      if(!isInputRef(ref)){issues.push(`Step ${index} input ${name} is not one literal, bindingRef, or prior step output reference.`);continue;}
      if(hasOwn(ref,'bindingRef')&&bindings!==undefined&&!hasOwn(bindings||{},ref.bindingRef))issues.push(`Step ${index} references undeclared binding ${ref.bindingRef}.`);
      if(hasOwn(ref,'stepRef')){
        if(!prior.has(ref.stepRef))issues.push(`Step ${index} has a forward, missing, or cyclic reference to ${ref.stepRef}.`);
        else {const priorStep=prior.get(ref.stepRef),priorContract=PORT_CONTRACTS[priorStep.op];if(!priorContract||!hasOwn(priorContract.outputs,ref.output))issues.push(`Step ${index} references unknown output port ${ref.output} on ${ref.stepRef}.`);}
      }
    }
    if(step.op==='REGEX'||step.op==='ASSERT_MATCH'){
      const pattern=step.inputs?.pattern?.literal,flags=step.inputs?.flags?.literal;if(typeof pattern==='string')issues.push(...validateRegex(pattern,flags).map(message=>`Step ${index}: ${message}`));
    }
    if(step.op==='PARSE_CSV'){
      for(const key of ['delimiter','header','quote','newline','encoding'])if(step.inputs?.[key]&&!hasOwn(step.inputs[key],'literal'))issues.push(`Step ${index} PARSE_CSV ${key} must be a literal contract value.`);
      const cfg=Object.fromEntries(['delimiter','header','quote','newline','encoding'].map(key=>[key,step.inputs?.[key]?.literal]));
      if(cfg.delimiter!==undefined&&!validateType(cfg.delimiter,'delimiter'))issues.push(`Step ${index} PARSE_CSV delimiter is invalid.`);
      if(cfg.header!==undefined&&!validateType(cfg.header,'boolean'))issues.push(`Step ${index} PARSE_CSV header is invalid.`);
      if(cfg.quote!==undefined&&!validateType(cfg.quote,'quote'))issues.push(`Step ${index} PARSE_CSV quote is invalid.`);
      if(cfg.newline!==undefined&&!validateType(cfg.newline,'csvNewline'))issues.push(`Step ${index} PARSE_CSV newline is invalid.`);
      if(cfg.encoding!==undefined&&!validateType(cfg.encoding,'utf8'))issues.push(`Step ${index} PARSE_CSV encoding is invalid.`);
      if(cfg.delimiter!==undefined&&cfg.quote!==undefined&&cfg.delimiter===cfg.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);
    }
    ids.add(step.stepId);prior.set(step.stepId,step);
  }
  if(!spec.result||typeof spec.result!=='object'||Array.isArray(spec.result)||Object.keys(spec.result).sort().join(',')!=='output,stepRef')issues.push('Test IR result must contain exactly stepRef and output.');
  else if(!prior.has(spec.result.stepRef))issues.push(`Test IR result references missing step ${String(spec.result.stepRef)}.`);
  else {const contract=PORT_CONTRACTS[prior.get(spec.result.stepRef).op];if(!hasOwn(contract.outputs,spec.result.output))issues.push(`Test IR result references unknown output ${String(spec.result.output)}.`);}
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);issues.push(...bindingResult.issues);}
  return {valid:issues.length===0,issues:[...new Set(issues)]};
}
function validateLegacySpec(spec,bindings){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  for(const key of Object.keys(spec))if(!['version','steps'].includes(key))issues.push(`Legacy Test IR authoring form contains unknown root property ${key}.`);
  if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${String(spec.version)}.`);
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');
  if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push(`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`);
  for(const [index,step] of (spec.steps||[]).entries()){
    issues.push(...validateStep(step,index));if(step?.op&&!PORT_CONTRACTS[step.op])issues.push(`Legacy authoring operation ${step.op} cannot compile to the canonical closed operation registry.`);
  }
  if(Array.isArray(spec.steps)&&spec.steps.length&&!spec.steps.some(step=>ASSERTION_OPS.has(step?.op)))issues.push('Test IR must contain at least one registered assertion operation.');
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);issues.push(...bindingResult.issues);const declared=new Set(Object.keys(bindings||{}));for(const [index,step] of (spec.steps||[]).entries())if(step&&typeof step.binding==='string'&&!declared.has(step.binding))issues.push(`Step ${index} references undeclared binding ${step.binding}.`);}
  return {valid:issues.length===0,issues:[...new Set(issues)]};
}
function validateSpec(spec,bindings){
  if(spec&&typeof spec==='object'&&hasOwn(spec,'languageVersion'))return validateDagSpec(spec,bindings);
  const legacy=validateLegacySpec(spec,bindings);if(!legacy.valid)return legacy;
  try{return validateDagSpec(compileLegacySpec(spec),bindings);}catch(error){return {valid:false,issues:[String(error?.message||error)]};}
}
`;
replaceBetween('function validateSpec(spec,bindings){','function validateBindings(bindings){',dagValidation+'function validateBindings(bindings){','replace Test IR validation');

const normalizeBlock=`function outputPortFor(op){const outputs=Object.keys(PORT_CONTRACTS[op]?.outputs||{});if(outputs.length!==1)fail('UNDEFINED_OPERATION_OUTPUT',`Operation ${op} does not have exactly one registered output in version 1.`);return outputs[0];}
function priorRef(previous){if(!previous)fail('IMPLICIT_OPERAND_MISSING','Legacy authoring syntax requires a prior value-producing step.');return {stepRef:previous.stepId,output:previous.output};}
function literal(value){return {literal:deepClone(value)};}
function binding(name){return {bindingRef:String(name)};}
function compileLegacySpec(spec){
  const legacy=validateLegacySpec(spec);if(!legacy.valid)fail('INVALID_TEST_IR',legacy.issues.join(' '));
  const steps=[];let previous=null;
  for(const [index,old] of spec.steps.entries()){
    const stepId=`S${String(index+1).padStart(3,'0')}`;let inputs={};
    switch(old.op){
      case 'LOAD_ARTIFACT':inputs={binding:binding(old.binding)};break;
      case 'READ_BYTES':inputs={artifact:priorRef(previous)};break;
      case 'DECODE_UTF8':inputs={bytes:priorRef(previous)};break;
      case 'PARSE_JSON':inputs={text:priorRef(previous)};break;
      case 'PARSE_CSV':inputs={text:priorRef(previous),delimiter:literal(old.delimiter),header:literal(old.header),quote:literal(old.quote),newline:literal(old.newline),encoding:literal(old.encoding)};break;
      case 'PARSE_XML':inputs={text:priorRef(previous)};break;
      case 'SELECT_JSON_PATH':inputs={value:priorRef(previous),path:literal(old.path)};break;
      case 'SELECT_XML':inputs={value:priorRef(previous),path:literal(old.path)};break;
      case 'COUNT':case 'SUM':case 'MIN':case 'MAX':case 'UNIQUE':inputs={value:priorRef(previous)};break;
      case 'SORT':inputs={value:priorRef(previous)};if(old.direction!==undefined)inputs.direction=literal(old.direction);if(old.domain!==undefined)inputs.domain=literal(old.domain);break;
      case 'HASH_SHA256':inputs={bytes:priorRef(previous)};break;
      case 'REGEX':inputs={value:priorRef(previous),pattern:literal(old.pattern)};if(old.flags!==undefined)inputs.flags=literal(old.flags);break;
      case 'COMPARE':inputs={left:priorRef(previous),right:hasOwn(old,'value')?literal(old.value):binding(old.binding)};for(const key of ['operator','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'])if(old[key]!==undefined)inputs[key]=literal(old[key]);break;
      case 'BYTE_COMPARE':inputs={left:priorRef(previous),right:binding(old.binding)};break;
      case 'ASSERT_EQ':case 'ASSERT_GT':case 'ASSERT_GTE':case 'ASSERT_LT':case 'ASSERT_LTE':inputs={actual:priorRef(previous),expected:literal(old.value)};for(const key of ['numericMode','absTol','relTol','absoluteTolerance','relativeTolerance','message'])if(old[key]!==undefined)inputs[key]=literal(old[key]);break;
      case 'ASSERT_MATCH':inputs={actual:priorRef(previous),pattern:literal(old.pattern)};for(const key of ['flags','message'])if(old[key]!==undefined)inputs[key]=literal(old[key]);break;
      case 'ASSERT_CONTAINS':case 'ASSERT_NOT_CONTAINS':case 'ASSERT_SET_EQUAL':inputs={actual:priorRef(previous),expected:literal(old.value)};if(old.message!==undefined)inputs.message=literal(old.message);break;
      default:fail('UNKNOWN_OPERATION',`Legacy authoring operation ${old.op} cannot compile to the canonical operation registry.`);
    }
    const step={stepId,op:old.op,inputs};steps.push(step);previous={stepId,output:outputPortFor(old.op)};
  }
  return {version:SPEC_VERSION,languageVersion:TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:OPERATION_REGISTRY_VERSION,operationRegistrySha256:OPERATION_REGISTRY_SHA256,steps,result:{stepRef:previous.stepId,output:previous.output}};
}
function normalizeSpec(spec){
  const normalized=spec&&typeof spec==='object'&&hasOwn(spec,'languageVersion')?deepClone(spec):compileLegacySpec(spec);
  const check=validateDagSpec(normalized);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  return normalized;
}
`;
replaceBetween('function normalizeSpec(spec){','function supports(test){',normalizeBlock+'function supports(test){','replace Test IR normalization');

const executeBlock=`function unwrapValue(value){return value&&typeof value==='object'&&!Array.isArray(value)&&hasOwn(value,'value')?value.value:value;}
function resolveDagInput(ref,outputs,artifacts,canonicalBindings){
  if(hasOwn(ref,'literal'))return deepClone(ref.literal);
  if(hasOwn(ref,'bindingRef'))return resolveBinding(ref.bindingRef,artifacts,canonicalBindings).value;
  const step=outputs.get(ref.stepRef);if(!step||!hasOwn(step,ref.output))fail('MISSING_STEP_OUTPUT',`Required output ${ref.stepRef}.${ref.output} is unavailable.`);return step[ref.output];
}
function bytesFrom(value){return bytesOf(value?.bytes??value);}
function assertion(ok,expected,actual,message){return {determination:ok?STATUS.SATISFIED:STATUS.VIOLATED,expected,actual,message:message||null};}
function observationValue(value){
  const bytes=bytesFrom(value);if(bytes)return {kind:'BYTES',byteLength:bytes.byteLength};
  if(value&&typeof value==='object'&&value.determination)return {kind:'ASSERTION',determination:value.determination,expected:value.expected,actual:value.actual,message:value.message||null};
  if(Array.isArray(value))return {kind:'ARRAY',length:value.length};
  if(value&&typeof value==='object')return {kind:'OBJECT',keys:Object.keys(value).slice(0,50)};
  return {kind:typeof value,value};
}
async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){
  const normalized=normalizeSpec(spec);const check=validateDagSpec(normalized,metadata.bindings);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  const bindingCheck=validateBindings(metadata.bindings||Object.fromEntries([...Object.keys(artifacts),...Object.keys(canonicalBindings)].map(key=>[key,{kind:hasOwn(artifacts,key)?'ARTIFACT':'CANONICAL_VALUE',artifactId:hasOwn(artifacts,key)?String(artifacts[key]?.artifactId||key):undefined,canonicalKey:hasOwn(canonicalBindings,key)?key:undefined}])));if(!bindingCheck.valid)fail('INVALID_BINDINGS',bindingCheck.issues.join(' '));
  const uniqueBuffers=new Set();let totalInputBytes=0;for(const artifact of Object.values(artifacts||{})){const bytes=bytesFrom(artifact);if(bytes&&!uniqueBuffers.has(bytes.buffer)){uniqueBuffers.add(bytes.buffer);totalInputBytes+=bytes.byteLength;}}
  const envelope=validateResourceEnvelope({totalInputBytes});if(!envelope.valid)fail('INPUT_BYTE_LIMIT',envelope.issues.join(' '));
  const observations=[],outputs=new Map(),inputArtifactIds=[],inputArtifactSha256Values=[];
  for(const [bindingName,artifact] of Object.entries(artifacts||{})){const bytes=bytesFrom(artifact);if(!bytes)continue;const calculated=await sha256(bytes);if(artifact?.sha256&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifact.artifactId||bindingName} bytes do not match its declared SHA-256.`);inputArtifactIds.push(String(artifact?.artifactId||bindingName));inputArtifactSha256Values.push(calculated);}
  for(const step of normalized.steps){
    const inputs=Object.fromEntries(Object.entries(step.inputs).map(([name,ref])=>[name,resolveDagInput(ref,outputs,artifacts,canonicalBindings)]));let out;
    switch(step.op){
      case 'LOAD_ARTIFACT':out={artifact:inputs.binding};break;
      case 'READ_BYTES':{const bytes=bytesFrom(inputs.artifact);if(!bytes)fail('BYTES_REQUIRED','READ_BYTES requires a byte-backed artifact binding.');out={bytes};break;}
      case 'DECODE_UTF8':{const bytes=bytesFrom(inputs.bytes);if(!bytes)fail('BYTES_REQUIRED','DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','UTF-8 input exceeds the registered text-byte limit.');if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT','UTF-8 input exceeds the registered decompressed-byte limit.');try{out={text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};}catch{fail('INVALID_UTF8','Input is not valid UTF-8.',STATUS.UNDETERMINED);}break;}
      case 'PARSE_JSON':{const source=String(unwrapValue(inputs.text));validateJsonSourceExact(source);let value;try{value=JSON.parse(source);}catch(error){fail('MALFORMED_JSON',`JSON parse failed: ${error.message}`,STATUS.UNDETERMINED);}inspectStructure(value);out={value};break;}
      case 'PARSE_CSV':{const value=parseCsv(String(unwrapValue(inputs.text)),{delimiter:inputs.delimiter,header:inputs.header,quote:inputs.quote,newline:inputs.newline,encoding:inputs.encoding});inspectStructure(value);out={value};break;}
      case 'PARSE_XML':{const value=parseXml(String(unwrapValue(inputs.text)));inspectStructure(value);out={value};break;}
      case 'SELECT_JSON_PATH':out={selection:selectJsonPath(unwrapValue(inputs.value),inputs.path)};break;
      case 'SELECT_XML':out={selection:selectXml(unwrapValue(inputs.value),inputs.path)};break;
      case 'COUNT':{const value=unwrapValue(inputs.value);if(value==null||typeof value.length!=='number')fail('COUNT_INPUT','COUNT requires an array, string, or array-like value.',STATUS.UNDETERMINED);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','COUNT input exceeds the registered collection limit.');out={count:value.length};break;}
      case 'SUM':case 'MIN':case 'MAX':{const values=collection(unwrapValue(inputs.value),step.op);if(!values.every(isSafeIntegerValue))fail('UNSUPPORTED_NUMERIC_PRECISION',`${step.op} supports safe integers only in version 1.`,STATUS.UNDETERMINED);const value=step.op==='SUM'?values.reduce((sum,item)=>{const next=sum+item;if(!Number.isSafeInteger(next))fail('INTEGER_OVERFLOW','SUM exceeded exact safe-integer range.',STATUS.UNDETERMINED);return next;},0):step.op==='MIN'?Math.min(...values):Math.max(...values);out={value};break;}
      case 'SORT':{const items=[...collection(unwrapValue(inputs.value),'SORT')],domain=sortDomain(items,inputs.domain);items.sort((a,b)=>compareSortValues(a,b,domain));if((inputs.direction||'ASC')==='DESC')items.reverse();out={value:items};break;}
      case 'UNIQUE':{const seen=new Set(),value=collection(unwrapValue(inputs.value),'UNIQUE').filter(item=>{const key=canonical(item);if(seen.has(key))return false;seen.add(key);return true;});out={value};break;}
      case 'HASH_SHA256':{const bytes=bytesFrom(inputs.bytes);if(!bytes)fail('BYTES_REQUIRED','HASH_SHA256 requires bytes.');out={sha256:await sha256(bytes)};break;}
      case 'REGEX':{const input=String(unwrapValue(inputs.value));if(byteLength(input)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(inputs.pattern,inputs.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));out={match:new RegExp(inputs.pattern,inputs.flags||'').test(input)};break;}
      case 'COMPARE':{const left=unwrapValue(inputs.left),right=unwrapValue(inputs.right),operator=inputs.operator||'EQ';const options={numericMode:inputs.numericMode,absTol:inputs.absTol,relTol:inputs.relTol,absoluteTolerance:inputs.absoluteTolerance,relativeTolerance:inputs.relativeTolerance};const cmp=['EQ','NE'].includes(operator)?null:orderedCompare(left,right);let comparison;if(operator==='EQ')comparison=exactEqual(left,right,options);else if(operator==='NE')comparison=!exactEqual(left,right,options);else if(operator==='GT')comparison=cmp>0;else if(operator==='GTE')comparison=cmp>=0;else if(operator==='LT')comparison=cmp<0;else if(operator==='LTE')comparison=cmp<=0;else fail('INVALID_COMPARE_OPERATOR',`Unsupported compare operator ${operator}.`);out={comparison};break;}
      case 'BYTE_COMPARE':{const left=bytesFrom(inputs.left),right=bytesFrom(inputs.right);if(!left||!right)fail('BYTES_REQUIRED','BYTE_COMPARE requires explicit byte-backed left and right inputs.');let comparison=left.byteLength===right.byteLength;if(comparison)for(let i=0;i<left.byteLength;i++)if(left[i]!==right[i]){comparison=false;break;}out={comparison};break;}
      case 'ASSERT_EQ':{const actual=unwrapValue(inputs.actual),expected=unwrapValue(inputs.expected),options={numericMode:inputs.numericMode,absTol:inputs.absTol,relTol:inputs.relTol,absoluteTolerance:inputs.absoluteTolerance,relativeTolerance:inputs.relativeTolerance};out={assertion:assertion(exactEqual(actual,expected,options),expected,actual,inputs.message)};break;}
      case 'ASSERT_GT':case 'ASSERT_GTE':case 'ASSERT_LT':case 'ASSERT_LTE':{const actual=unwrapValue(inputs.actual),expected=unwrapValue(inputs.expected),cmp=orderedCompare(actual,expected),ok=step.op==='ASSERT_GT'?cmp>0:step.op==='ASSERT_GTE'?cmp>=0:step.op==='ASSERT_LT'?cmp<0:cmp<=0;out={assertion:assertion(ok,`${step.op.slice(7)} ${expected}`,actual,inputs.message)};break;}
      case 'ASSERT_MATCH':{const actual=String(unwrapValue(inputs.actual));if(byteLength(actual)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(inputs.pattern,inputs.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));out={assertion:assertion(new RegExp(inputs.pattern,inputs.flags||'').test(actual),`matches /${inputs.pattern}/${inputs.flags||''}`,actual,inputs.message)};break;}
      case 'ASSERT_CONTAINS':case 'ASSERT_NOT_CONTAINS':{const actual=unwrapValue(inputs.actual),expected=unwrapValue(inputs.expected),contains=Array.isArray(actual)?actual.some(item=>canonical(item)===canonical(expected)):String(actual).includes(String(expected)),ok=step.op==='ASSERT_CONTAINS'?contains:!contains;out={assertion:assertion(ok,step.op==='ASSERT_CONTAINS'?`contains ${canonical(expected)}`:`does not contain ${canonical(expected)}`,actual,inputs.message)};break;}
      case 'ASSERT_SET_EQUAL':{const actual=collection(unwrapValue(inputs.actual),'ASSERT_SET_EQUAL'),expected=collection(unwrapValue(inputs.expected),'ASSERT_SET_EQUAL'),left=[...new Set(actual.map(canonical))].sort(),right=[...new Set(expected.map(canonical))].sort();out={assertion:assertion(canonical(left)===canonical(right),expected,actual,inputs.message)};break;}
      default:fail('UNKNOWN_OPERATION',`Unsupported Test IR operation ${step.op}.`);
    }
    outputs.set(step.stepId,out);const port=Object.keys(out)[0];observations.push({stepId:step.stepId,op:step.op,outputPort:port,...observationValue(out[port])});
    if(out.assertion?.determination===STATUS.VIOLATED)break;
  }
  const selected=outputs.get(normalized.result.stepRef);if(!selected||!hasOwn(selected,normalized.result.output))fail('RESULT_OUTPUT_UNAVAILABLE','The selected Test IR result output was not produced.');const resultValue=selected[normalized.result.output];
  const normalizedDagSha256=await sha256Canonical(normalized),determination=resultValue?.determination||STATUS.UNDETERMINED;
  const usedJsonSelector=normalized.steps.some(step=>step.op==='SELECT_JSON_PATH'),usedXmlSelector=normalized.steps.some(step=>step.op==='SELECT_XML'),usedRegex=normalized.steps.some(step=>step.op==='REGEX'||step.op==='ASSERT_MATCH');
  return {testId:metadata.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:normalizedDagSha256,normalizedDagSha256,testIrLanguageVersion:TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:OPERATION_REGISTRY_VERSION,operationRegistrySha256:OPERATION_REGISTRY_SHA256,jsonSelectorRegistryVersion:usedJsonSelector?JSON_SELECTOR_REGISTRY_VERSION:null,jsonSelectorRegistrySha256:usedJsonSelector?JSON_SELECTOR_REGISTRY_SHA256:null,xmlSelectorRegistryVersion:usedXmlSelector?XML_SELECTOR_REGISTRY_VERSION:null,xmlSelectorRegistrySha256:usedXmlSelector?XML_SELECTOR_REGISTRY_SHA256:null,regexRegistryVersion:usedRegex?REGEX_REGISTRY_VERSION:null,regexRegistrySha256:usedRegex?REGEX_REGISTRY_SHA256:null,selectedResultStepId:normalized.result.stepRef,selectedResultPort:normalized.result.output,status:'COMPLETE',determination,expected:resultValue?.expected??null,actual:resultValue?.actual??resultValue,observations,evidence:[{kind:'APPLICATION_NATIVE_RUNTIME_OBSERVATION',testSpecSha256:normalizedDagSha256,inputArtifactIds:[...new Set(inputArtifactIds)],inputArtifactSha256Values:[...new Set(inputArtifactSha256Values)]}],executorVersion:VERSION,runtimeVersion:VERSION,inputArtifactIds:[...new Set(inputArtifactIds)],inputArtifactSha256Values:[...new Set(inputArtifactSha256Values)]};
}

`;
replaceBetween('async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){','function workerUrl(){',executeBlock+'function workerUrl(){','replace hidden accumulator executor with explicit DAG executor');

replaceOnce(
"const operationContracts=()=>JSON.parse(JSON.stringify(OP_DEFINITIONS));\nconst capabilities=()=>Object.freeze([CAPABILITY]);\nroot.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,OPS,OP_DEFINITIONS,LIMITS,STATUS,RuntimeError,validateSpec,validateBindings,normalizeSpec,supports,execute,executeTest,capabilities,operationContracts,sha256Canonical,validateResourceEnvelope});",
"const operationContracts=()=>JSON.parse(JSON.stringify(PORT_CONTRACTS));\nconst capabilities=()=>Object.freeze([CAPABILITY]);\nroot.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,TEST_IR_LANGUAGE_VERSION,OPERATION_REGISTRY_VERSION,OPERATION_REGISTRY_SHA256,JSON_SELECTOR_REGISTRY_VERSION,JSON_SELECTOR_REGISTRY_SHA256,XML_SELECTOR_REGISTRY_VERSION,XML_SELECTOR_REGISTRY_SHA256,REGEX_REGISTRY_VERSION,REGEX_REGISTRY_SHA256,OPS,OP_DEFINITIONS,PORT_CONTRACTS,LIMITS,STATUS,RuntimeError,validateSpec,validateBindings,normalizeSpec,supports,execute,executeTest,capabilities,operationContracts,sha256Canonical,validateResourceEnvelope,validateRegex,parseJsonSelector});",
'export canonical Test IR registry');

fs.writeFileSync(path,source);

// The preexisting v3 test expected every grouping construct to fail. The controlling
// registry requires capturing and non-capturing groups, while dangerous nested
// unbounded quantification remains rejected.
const v3='verify-test-runtime-v3.mjs';
let test=fs.readFileSync(v3,'utf8');
test=test.replace("assert.equal(dangerousRegex.valid,false);assert.match(dangerousRegex.issues.join(' '),/grouping/);","assert.equal(dangerousRegex.valid,false);assert.match(dangerousRegex.issues.join(' '),/nested unbounded quantification|safe subset/i);\nassert.equal(runtime.validateRegex('(ab)+').length,0);\nassert.equal(runtime.validateRegex('(?:ab)+').length,0);\nassert.ok(runtime.validateRegex('(?=ab)').length>0);");
fs.writeFileSync(v3,test);

console.log(JSON.stringify({patched:path,removedIntegratedWrapper:amendmentIndex>=0,explicitDag:true,registryIdentities:true,regexGroups:true,jsonSelectorWildcard:true},null,2));
