(()=>{
'use strict';

const root=globalThis;
const VERSION='closed-loop-test-runtime/2';
const RUNTIME_SCRIPT_URL=typeof document!=='undefined'?document.currentScript?.src||null:null;
const RUNTIME_IDENTITY_PARAMETERS=(()=>{try{return RUNTIME_SCRIPT_URL?new URL(RUNTIME_SCRIPT_URL).searchParams:typeof importScripts==='function'?new URLSearchParams(root.location?.search||''):new URLSearchParams();}catch{return new URLSearchParams();}})();
const RUNTIME_BUILD_ID=RUNTIME_IDENTITY_PARAMETERS.get('v')||'UNMANIFESTED_LOCAL_RUNTIME';
const EXPECTED_WORKER_SHA256=(()=>{const value=RUNTIME_IDENTITY_PARAMETERS.get('workerSha256');return /^[0-9a-f]{64}$/.test(value||'')?value:null;})();
const MANIFESTED_RUNTIME=Boolean(EXPECTED_WORKER_SHA256)||RUNTIME_BUILD_ID.startsWith('build-sha256-');
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
const SPEC_VERSION='closed-loop-test-spec/1';
const EXECUTABLE_KIND='TEST_IR';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const TEST_IR_LANGUAGE_VERSION='closed-loop-test-ir-language/1';
const OPERATION_REGISTRY_VERSION='closed-loop-test-ir-operations/1';
const OPERATION_REGISTRY_SHA256='77e7b900e5f7f5ac66033564cc0cb4f323cc76b7f7dd95ac6d173c0f649f655d';
const JSON_SELECTOR_REGISTRY_VERSION='closed-loop-json-selector/1';
const JSON_SELECTOR_REGISTRY_SHA256='3136dbd1f69ee7039a178a1c682bcf1f21da94f11e89bbddc2fd0f8eb668fbc3';
const XML_SELECTOR_REGISTRY_VERSION='closed-loop-xml-selector/1';
const XML_SELECTOR_REGISTRY_SHA256='29c6c2698d789f185619a6e1a3493982f1ac96f4d5416c7e3221f9c63c5c5c79';
const REGEX_REGISTRY_VERSION='closed-loop-regex/1';
const REGEX_REGISTRY_SHA256='0533522402875ae03dc4cc859097424e2887d36045a2fd20db11b3feeaccce15';
const MAX_REGEX_UNBOUNDED_QUANTIFIERS=16;
const NORMALIZATION_CONTRACT=Object.freeze({id:'closed-loop-test-ir-normalization/1',version:1,implementationOwner:'test-runtime.js',implementationFunction:'normalizeSpec',canonicalInputContract:'VALIDATED_EXPLICIT_DAG_OR_REGISTERED_LEGACY_AUTHORING_FORM',outputContract:'VALIDATED_EXPLICIT_CANONICAL_TEST_IR_DAG',buildIdentity:TEST_IR_LANGUAGE_VERSION,invalidationConsequences:'RECHECK_EXECUTABLE_SPEC_HASH_AND_CURRENT_OPERATION_REGISTRY; REAUTHOR_AND_REVIEW_STALE_DEFINITIONS; PRESERVE_RAW_AUTHOR_RESPONSE'});
const PRIOR_OPERATION_REGISTRY_SHA256='21b4c97a596fecd7ec5dca7788ded488827ef71c0aee3a041f89bd19d0eede00';

/* Centralized implementation limits. These are support-contract limits, not claims
   about every browser or every possible project. Every boundary is fail-closed. */
const LIMITS=Object.freeze({
  maxTotalInputBytes:32*1024*1024,
  maxTextBytes:16*1024*1024,
  maxDecompressedBytes:64*1024*1024,
  maxSteps:128,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxParsedNodes:250000,
  maxCollectionItems:100000,
  maxRegexPatternBytes:2048,
  maxRegexLength:2000,
  maxRegexInputBytes:2*1024*1024,
  maxCsvCells:250000,
  maxXmlNodes:100000,
  workerTimeoutMs:5000,
  maxArchiveExpansionBytes:64*1024*1024
});

const STATUS=Object.freeze({
  SATISFIED:'SATISFIED',
  VIOLATED:'VIOLATED',
  UNDETERMINED:'UNDETERMINED',
  EXECUTION_FAILED:'EXECUTION_FAILED'
});

const OP_DEFINITIONS=Object.freeze({
  LOAD_ARTIFACT:{required:['binding'],optional:[],types:{binding:'binding'}},
  READ_BYTES:{required:[],optional:[],types:{}},
  DECODE_UTF8:{required:[],optional:[],types:{}},
  PARSE_JSON:{required:[],optional:[],types:{}},
  PARSE_CSV:{required:['delimiter','header','quote','newline','encoding'],optional:[],types:{delimiter:'delimiter',header:'boolean',quote:'quote',newline:'csvNewline',encoding:'utf8'}},
  PARSE_XML:{required:[],optional:[],types:{}},
  SELECT_JSON_PATH:{required:['path'],optional:[],types:{path:'jsonSelector'}},
  SELECT_XML:{required:['path'],optional:[],types:{path:'xmlSelector'}},
  COUNT:{required:[],optional:[],types:{}},
  SUM:{required:[],optional:[],types:{}},
  MIN:{required:[],optional:[],types:{}},
  MAX:{required:[],optional:[],types:{}},
  SORT:{required:[],optional:['direction','domain'],types:{direction:'sortDirection',domain:'sortDomain'}},
  UNIQUE:{required:[],optional:[],types:{}},
  HASH_SHA256:{required:[],optional:[],types:{}},
  REGEX:{required:['pattern'],optional:['flags'],types:{pattern:'regex',flags:'regexFlags'}},
  COMPARE:{required:[],optional:['value','binding','operator','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{binding:'binding',operator:'compareOperator',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'},oneOf:[['value'],['binding']]},
  ASSERT_EXISTS:{required:[],optional:['message'],types:{message:'string'}},
  ASSERT_TYPE:{required:['value'],optional:['message'],types:{value:'typeName',message:'string'}},
  ASSERT_NE:{required:['value'],optional:['message','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'}},
  ASSERT_EQ:{required:['value'],optional:['message','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'}},
  ASSERT_GT:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_GTE:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_LT:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_LTE:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_MATCH:{required:['pattern'],optional:['flags','message'],types:{pattern:'regex',flags:'regexFlags',message:'string'}},
  ASSERT_CONTAINS:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_NOT_CONTAINS:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_SET_EQUAL:{required:['value'],optional:['message'],types:{message:'string',value:'array'}},
  BYTE_COMPARE:{required:['binding'],optional:[],types:{binding:'binding'}}
});
const PORT_CONTRACTS=Object.freeze({
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
const INPUT_PORT_TYPES=Object.freeze({
  READ_BYTES:Object.freeze({artifact:Object.freeze(['ARTIFACT'])}),
  DECODE_UTF8:Object.freeze({bytes:Object.freeze(['BYTES'])}),
  PARSE_JSON:Object.freeze({text:Object.freeze(['STRING'])}),
  PARSE_CSV:Object.freeze({text:Object.freeze(['STRING'])}),
  PARSE_XML:Object.freeze({text:Object.freeze(['STRING'])}),
  SELECT_XML:Object.freeze({value:Object.freeze(['XML_NODE'])}),
  HASH_SHA256:Object.freeze({bytes:Object.freeze(['BYTES'])}),
  BYTE_COMPARE:Object.freeze({left:Object.freeze(['BYTES']),right:Object.freeze(['BYTES'])})
});
// Published argument vocabularies and validation share this owner. The language
// identities describe execution semantics; exposing these existing rules does
// not introduce another operation or another executable language.
const ARGUMENT_ENUMS=Object.freeze({
  csvNewline:Object.freeze(['AUTO','LF','CRLF','CR']),utf8:Object.freeze(['UTF-8']),
  sortDirection:Object.freeze(['ASC','DESC']),sortDomain:Object.freeze(['STRING','BOOLEAN','INTEGER','DECIMAL']),
  compareOperator:Object.freeze(['EQ','NE','GT','GTE','LT','LTE']),
  typeName:Object.freeze(['string','number','boolean','object','array','null','undefined','bytes']),
  numericMode:Object.freeze(['INTEGER','DECIMAL_STRING','APPROXIMATE'])
});
const VALUE_PORT_KINDS=Object.freeze({
  PARSE_JSON:{text:'STRING'},PARSE_XML:{text:'STRING'},PARSE_CSV:{text:'STRING'},REGEX:{value:'STRING'},ASSERT_MATCH:{actual:'STRING'},
  SUM:{value:'ARRAY'},MIN:{value:'ARRAY'},MAX:{value:'ARRAY'},SORT:{value:'ARRAY'},UNIQUE:{value:'ARRAY'},
  ASSERT_SET_EQUAL:{actual:'ARRAY',expected:'ARRAY'},ASSERT_CONTAINS:{actual:'STRING_OR_ARRAY'},ASSERT_NOT_CONTAINS:{actual:'STRING_OR_ARRAY'},COUNT:{value:'STRING_OR_ARRAY_OR_BYTES'}
});
const ARGUMENT_DESCRIPTIONS=Object.freeze({
  string:{valueType:'STRING'},boolean:{valueType:'BOOLEAN'},array:{valueType:'ARRAY'},binding:{valueType:'STRING',pattern:'^[A-Z][A-Z0-9_]{0,63}$'},
  delimiter:{valueType:'STRING',unicodeCodePointCount:1,excludedValues:['\r','\n']},quote:{valueType:'STRING',unicodeCodePointCount:1,excludedValues:['\r','\n']},
  regex:{valueType:'STRING',registry:'regex'},regexFlags:{valueType:'STRING',registry:'regex',defaultValue:''},
  jsonSelector:{valueType:'STRING',registry:'jsonSelector'},xmlSelector:{valueType:'STRING',registry:'xmlSelector'},
  exactNonnegativeDecimal:{valueType:'EXACT_NONNEGATIVE_DECIMAL',rule:'Canonical plain decimal text, or {numberType:"DECIMAL",value:<that text>}; nonnegative, no exponent or negative zero. Safe nonnegative integer JSON numbers are also accepted.'}
});
const OPERATION_EXECUTION_CONTRACTS=Object.freeze({
  LOAD_ARTIFACT:{cost:'BINDING_LOOKUP',errors:[],meaning:'Resolve the named immutable binding. The nominal ARTIFACT output carries its artifact transport or explicit canonical value; a canonical value does not acquire bytes.'},
  READ_BYTES:{cost:'BYTE_VIEW',errors:['BYTES_REQUIRED'],meaning:'Read exact bytes from an explicit byte-backed artifact.'},
  DECODE_UTF8:{cost:'LINEAR_BYTES',errors:['BYTES_REQUIRED','TEXT_BYTE_LIMIT','DECOMPRESSED_BYTE_LIMIT','INVALID_UTF8'],meaning:'Fatal UTF-8 decoding; invalid bytes are UNDETERMINED. A leading UTF-8 BOM follows TextDecoder UTF-8 handling.'},
  PARSE_JSON:{cost:'BOUNDED_PARSE',errors:['MALFORMED_JSON','UNSUPPORTED_JSON_NUMBER','DUPLICATE_JSON_MEMBER','PARSED_DEPTH_LIMIT','PARSED_NODE_LIMIT','COLLECTION_LIMIT'],meaning:'Strict JSON with unique object members. JSON numbers must be safe integers without fraction, exponent or negative zero; member order is retained for selection.'},
  PARSE_CSV:{cost:'BOUNDED_PARSE',errors:['UNSUPPORTED_ENCODING','MALFORMED_CSV','CSV_CELL_LIMIT','COLLECTION_LIMIT','PARSED_NODE_LIMIT','PARSED_DEPTH_LIMIT'],meaning:'Explicit delimiter, quote, header, newline and UTF-8 settings. Delimiter and quote must differ. Double the quote character inside a quoted cell. After a closing quote only delimiter, contracted newline or end is allowed. Header false returns row arrays; true returns objects with unique exact header names and equal cell counts. Empty input returns [].'},
  PARSE_XML:{cost:'BOUNDED_PARSE',errors:['MALFORMED_XML','UNSUPPORTED_XML_DECLARATION','UNSUPPORTED_XML_ENTITY','UNSAFE_XML','XML_NODE_LIMIT','PARSED_DEPTH_LIMIT','PARSED_NODE_LIMIT','COLLECTION_LIMIT'],meaning:'XML 1.0 UTF-8 subset with one root; ASCII element/attribute names, legal XML characters, predefined and legal numeric entities, comments and CDATA. DTDs, custom entities and processing instructions are prohibited. XML newline and literal attribute-whitespace normalization apply.'},
  SELECT_JSON_PATH:{cost:'BOUNDED_SELECTION',errors:['UNSUPPORTED_JSON_SELECTOR','SELECTOR_LIMIT','JSON_PATH_MISSING'],meaning:'Use the jsonSelector registry. Without wildcard return the selected value; with wildcard return selected values in document order. No match is UNDETERMINED.'},
  SELECT_XML:{cost:'BOUNDED_SELECTION',errors:['XML_NODE_REQUIRED','UNSUPPORTED_XML_SELECTOR','SELECTOR_LIMIT','XML_PATH_MISSING'],meaning:'Use the xmlSelector registry on an actual PARSE_XML node. Element selections return arrays. Final @name and text() return arrays of strings; missing selected attributes or a missing child path followed by either suffix return []. A mismatched document root or missing final element path without a suffix is UNDETERMINED.'},
  COUNT:{cost:'LENGTH',errors:['COUNT_INPUT','COLLECTION_LIMIT'],meaning:'Array item count, string UTF-16 code-unit length, or byte length; bounded by maxCollectionItems.'},
  SUM:{cost:'LINEAR_COLLECTION',errors:['COLLECTION_REQUIRED','COLLECTION_LIMIT','UNSUPPORTED_NUMERIC_PRECISION','INTEGER_OVERFLOW'],meaning:'Exact safe-integer sum; empty array gives 0, each intermediate sum must remain safe.'},
  MIN:{cost:'LINEAR_COLLECTION',errors:['COLLECTION_REQUIRED','COLLECTION_LIMIT','UNSUPPORTED_NUMERIC_PRECISION','EMPTY_COLLECTION'],meaning:'Minimum of a nonempty safe-integer array.'},
  MAX:{cost:'LINEAR_COLLECTION',errors:['COLLECTION_REQUIRED','COLLECTION_LIMIT','UNSUPPORTED_NUMERIC_PRECISION','EMPTY_COLLECTION'],meaning:'Maximum of a nonempty safe-integer array.'},
  SORT:{cost:'COLLECTION_SORT',errors:['COLLECTION_REQUIRED','COLLECTION_LIMIT','SORT_DOMAIN','UNSUPPORTED_NUMERIC_PRECISION'],meaning:'Homogeneous domain; infer from first item when domain is omitted, empty defaults to STRING. ASC default; DESC reverses. Strings compare Unicode code points, booleans false before true, integers exactly, typed DECIMAL objects by their plain decimal value.'},
  UNIQUE:{cost:'CANONICAL_COLLECTION',errors:['COLLECTION_REQUIRED','COLLECTION_LIMIT'],meaning:'Canonical JSON equality; retain the first occurrence and original order.'},
  HASH_SHA256:{cost:'LINEAR_BYTES',errors:['BYTES_REQUIRED'],meaning:'Lowercase SHA-256 of exact bytes.'},
  REGEX:{cost:'BOUNDED_REGEX',errors:['REGEX_INPUT_LIMIT','UNSAFE_REGEX'],meaning:'Restricted regex test on a STRING, returning BOOLEAN.'},
  COMPARE:{cost:'BOUNDED_VALUE_COMPARISON',errors:['UNSUPPORTED_NUMERIC_PRECISION','INVALID_TOLERANCE','INVALID_COMPARE_OPERATOR'],meaning:'EQ default; NE negates equality. Other operators use exact ordered numeric comparison; see numericSemantics.'},
  ASSERT_EQ:{cost:'BOUNDED_VALUE_COMPARISON',errors:['UNSUPPORTED_NUMERIC_PRECISION','INVALID_TOLERANCE'],meaning:'Assert equality under numericSemantics or canonical JSON equality.'},
  ASSERT_GT:{cost:'BOUNDED_VALUE_COMPARISON',errors:['UNSUPPORTED_NUMERIC_PRECISION'],meaning:'Assert actual > expected for safe integers or plain decimal strings.'},
  ASSERT_GTE:{cost:'BOUNDED_VALUE_COMPARISON',errors:['UNSUPPORTED_NUMERIC_PRECISION'],meaning:'Assert actual >= expected for safe integers or plain decimal strings.'},
  ASSERT_LT:{cost:'BOUNDED_VALUE_COMPARISON',errors:['UNSUPPORTED_NUMERIC_PRECISION'],meaning:'Assert actual < expected for safe integers or plain decimal strings.'},
  ASSERT_LTE:{cost:'BOUNDED_VALUE_COMPARISON',errors:['UNSUPPORTED_NUMERIC_PRECISION'],meaning:'Assert actual <= expected for safe integers or plain decimal strings.'},
  ASSERT_MATCH:{cost:'BOUNDED_REGEX',errors:['REGEX_INPUT_LIMIT','UNSAFE_REGEX'],meaning:'Assert restricted regex match on actual STRING.'},
  ASSERT_CONTAINS:{cost:'CANONICAL_COLLECTION_OR_TEXT',errors:[],meaning:'For strings expected must be STRING; for arrays compare each item to expected by canonical JSON equality.'},
  ASSERT_NOT_CONTAINS:{cost:'CANONICAL_COLLECTION_OR_TEXT',errors:[],meaning:'Negate ASSERT_CONTAINS with the same input rules.'},
  ASSERT_SET_EQUAL:{cost:'CANONICAL_COLLECTION_SORT',errors:['COLLECTION_REQUIRED','COLLECTION_LIMIT'],meaning:'Compare arrays as sets of canonical JSON values, ignoring order and duplicate multiplicity.'},
  BYTE_COMPARE:{cost:'LINEAR_BYTES',errors:['BYTES_REQUIRED'],meaning:'Exact length and byte equality of explicit left and right byte inputs.'}
});
const OPS=Object.freeze(Object.keys(PORT_CONTRACTS));
const ASSERTION_OPS=new Set(['ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);
const encoder=new TextEncoder();
// Parser-only metadata cannot collide with keys supplied by an artifact.
const jsonMemberOrder=new WeakMap();
const parsedXmlNodes=new WeakSet();
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const DIAGNOSTIC_POLICY=Object.freeze({mode:'FAIL_FAST_CLOSED_SHAPE_OR_RESOURCE_BOUND',maxValuePreviewCodeUnits:256,retainedSource:'Complete submitted values remain in the original response; diagnostic previews do not transform accepted data.'});
const diagnosticLabel=value=>{if(typeof value!=='string')return '<non-string>';if(value.length<=DIAGNOSTIC_POLICY.maxValuePreviewCodeUnits)return value;let end=DIAGNOSTIC_POLICY.maxValuePreviewCodeUnits;if(value.charCodeAt(end-1)>=0xd800&&value.charCodeAt(end-1)<=0xdbff&&value.charCodeAt(end)>=0xdc00&&value.charCodeAt(end)<=0xdfff)end--;return value.slice(0,end)+'… ['+value.length+' UTF-16 code units; complete value retained in source]';};
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const scalarCompare=(a,b)=>{const aa=Array.from(String(a),ch=>ch.codePointAt(0)),bb=Array.from(String(b),ch=>ch.codePointAt(0)),n=Math.min(aa.length,bb.length);for(let i=0;i<n;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return aa.length-bb.length;};
const canonical=value=>{const authority=root.closedLoopHash;if(!authority||authority.canonicalizationVersion!=='closed-loop-canonical-json/1'||typeof authority.stableStringify!=='function')fail('CANONICAL_HASH_AUTHORITY_UNAVAILABLE','Test IR requires the shared closed-loop-canonical-json/1 authority.');return authority.stableStringify(value);};
const byteLength=value=>encoder.encode(String(value)).byteLength;

class RuntimeError extends Error{
  constructor(code,message,disposition=STATUS.EXECUTION_FAILED){super(message);this.name='ClosedLoopTestRuntimeError';this.code=code;this.disposition=disposition;}
}
const fail=(code,message,disposition)=>{throw new RuntimeError(code,message,disposition);};

async function sha256(bytes){
  const data=bytesOf(bytes);if(!data)fail('BYTES_REQUIRED','SHA-256 requires byte input.');
  const digest=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function sha256Canonical(value){return sha256(encoder.encode(canonical(value)));}

function validateResourceEnvelope(claim={}){
  const issues=[];const allowed=new Set(['totalInputBytes','decompressedBytes','archiveExpansionBytes']);for(const key of Object.keys(claim||{}))if(!allowed.has(key))issues.push('Unknown resource-envelope property '+key+'.');
  const checks=[['totalInputBytes','maxTotalInputBytes'],['decompressedBytes','maxDecompressedBytes'],['archiveExpansionBytes','maxArchiveExpansionBytes']];
  for(const [key,limitKey] of checks){if(!Object.prototype.hasOwnProperty.call(claim,key))continue;const value=claim[key];if(!Number.isSafeInteger(value)||value<0)issues.push(key+' must be a nonnegative safe integer.');else if(value>LIMITS[limitKey])issues.push(key+' exceeds '+limitKey+'.');}
  return {valid:issues.length===0,issues};
}
function validateRegex(pattern,flags=''){
  const issues=[];
  if(typeof pattern!=='string'||typeof flags!=='string')return ['Regex pattern and flags must be strings.'];
  if(byteLength(pattern)>LIMITS.maxRegexPatternBytes||pattern.length>LIMITS.maxRegexLength)issues.push('Regex pattern exceeds the registered byte limit.');
  if(!/^[imsu]*$/.test(flags)||new Set(flags).size!==flags.length)issues.push('Regex flags must be a unique subset of i, m, s, and u.');
  let inClass=false,unbounded=0,lastGroup=null;
  const groups=[];
  for(let i=0;i<pattern.length;i++){
    const ch=pattern[i];
    if(ch==='\\'){
      const escaped=pattern[++i];
      if(escaped===undefined){issues.push('Regex ends with an incomplete escape.');break;}
      if(/[1-9]/.test(escaped)||escaped==='k')issues.push('Regex backreferences and legacy numeric escapes are not supported.');
      if(escaped==='0'&&/[0-9]/.test(pattern[i+1]||''))issues.push('Regex legacy numeric escapes are not supported.');
      if(escaped==='p'||escaped==='P')issues.push('Unicode property escapes are not supported in closed-loop-regex/1.');
      if(/[A-Za-z]/.test(escaped)&&!'dDwWsSbBfnrtvux'.includes(escaped))issues.push('Regex contains an unsupported character escape.');
      lastGroup=null;continue;
    }
    if(inClass){if(ch===']')inClass=false;continue;}
    if(ch==='['){inClass=true;lastGroup=null;continue;}
    if(ch==='('){
      if(pattern[i+1]==='?'){
        if(pattern[i+2]!==':')issues.push('Regex lookaround, named groups, and inline mode groups are not supported.');
        else i+=2;
      }
      groups.push({unbounded:false});lastGroup=null;continue;
    }
    if(ch===')'){lastGroup=groups.pop()||null;if(lastGroup?.unbounded&&groups.length)groups.at(-1).unbounded=true;continue;}
    if(ch==='*'||ch==='+'||ch==='{'){
      if(lastGroup?.unbounded)issues.push('Regex nested unbounded quantification is outside the registered safe subset.');
      const repeat=ch==='{'?pattern.slice(i).match(/^\{\d+,(\d*)\}/):null;
      if(ch==='*'||ch==='+'||(repeat&&repeat[1]==='')){unbounded++;if(groups.length)groups.at(-1).unbounded=true;}
    }
    if(ch!=='?')lastGroup=null;
  }
  if(unbounded>MAX_REGEX_UNBOUNDED_QUANTIFIERS)issues.push('Regex contains too many unbounded quantifiers.');
  try{if(!issues.length)new RegExp(pattern,flags);}catch(error){issues.push(`Regex is invalid: ${error.message}`);}
  return [...new Set(issues)];
}

function parseJsonSelector(path){
  const text=String(path||'');if(text==='$')return [];
  if(!text.startsWith('$'))fail('UNSUPPORTED_JSON_SELECTOR','JSON selector must begin with $.');
  const parts=[];let i=1;
  const identifier=()=>{const match=text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(!match)fail('UNSUPPORTED_JSON_SELECTOR',`Expected identifier at character ${i} in ${text}.`);i+=match[0].length;return match[0];};
  const quotedName=()=>{if(text[i]!=="'")fail('UNSUPPORTED_JSON_SELECTOR',`Expected single-quoted bracket name in ${text}.`);i++;let out='';while(i<text.length){const ch=text[i++];if(ch==="'")return out;if(ch==='\\'){if(i>=text.length)fail('UNSUPPORTED_JSON_SELECTOR',`Invalid bracket-name escape in ${text}.`);const next=text[i++];if(next!=="'"&&next!=='\\')fail('UNSUPPORTED_JSON_SELECTOR',`Only escaped quote and backslash are supported in bracket names: ${text}.`);out+=next;}else out+=ch;}fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed bracket name in ${text}.`);};
  while(i<text.length){
    if(text[i]==='.'){
      i++;if(text[i]==='*'){parts.push({kind:'wildcard'});i++;}
      else parts.push({kind:'child',key:identifier()});
    }else if(text[i]==='['){
      i++;if(text[i]==='*'){i++;if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Malformed wildcard segment in ${text}.`);parts.push({kind:'wildcard'});}
      else if(text[i]==="'"){const key=quotedName();if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed bracket-name segment in ${text}.`);parts.push({kind:'child',key});}
      else {const match=text.slice(i).match(/^(0|[1-9]\d*)/);if(!match)fail('UNSUPPORTED_JSON_SELECTOR',`Only nonnegative array indexes, single-quoted child names, and * are supported in brackets: ${text}.`);i+=match[0].length;if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed array index in ${text}.`);const index=Number(match[0]);if(!Number.isSafeInteger(index))fail('UNSUPPORTED_JSON_SELECTOR','JSON indexes must be nonnegative safe integers.');parts.push({kind:'index',index});}
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
        multi=true;if(Array.isArray(node))next.push(...node);else if(node!==null&&typeof node==='object')for(const key of jsonMemberOrder.get(node)||Object.keys(node).sort(scalarCompare))next.push(node[key]);
      }
    }
    if(!next.length)fail('JSON_PATH_MISSING',`JSON selector does not resolve: ${path}.`,STATUS.UNDETERMINED);
    current=next;
  }
  return multi?current:current[0];
}

function isXmlCharacter(code){return code===9||code===10||code===13||(code>=0x20&&code<=0xd7ff)||(code>=0xe000&&code<=0xfffd)||(code>=0x10000&&code<=0x10ffff);}
function decodeXmlEntity(entity){
  const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(hasOwn(known,entity))return known[entity];
  let code=null;
  if(/^#\d+$/.test(entity))code=Number(entity.slice(1));
  else if(/^#x[0-9a-fA-F]+$/.test(entity))code=parseInt(entity.slice(2),16);
  if(Number.isSafeInteger(code)&&isXmlCharacter(code))return String.fromCodePoint(code);
  fail('UNSUPPORTED_XML_ENTITY',`Unsupported or illegal XML entity &${entity};.`);
}
function decodeXmlText(text){
  const source=String(text);let result='',start=0;
  while(start<source.length){
    const amp=source.indexOf('&',start);if(amp<0){result+=source.slice(start);break;}
    result+=source.slice(start,amp);const end=source.indexOf(';',amp+1);
    if(end<0)fail('MALFORMED_XML','XML contains an unterminated entity reference.');
    result+=decodeXmlEntity(source.slice(amp+1,end));start=end+1;
  }
  return result;
}
function parseXmlAttributes(source){
  const attributes=Object.create(null);let rest=String(source||'');
  while(rest){
    const gap=rest.match(/^[\x20\x09\x0a\x0d]+/);
    if(!gap)fail('MALFORMED_XML','XML attributes must be separated by whitespace.');
    rest=rest.slice(gap[0].length);if(!rest)break;
    const match=rest.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)[\x20\x09\x0a\x0d]*=[\x20\x09\x0a\x0d]*("[^"<]*"|'[^'<]*')/);
    if(!match)fail('MALFORMED_XML',`Malformed XML attribute text: ${rest.slice(0,80)}.`);
    if(hasOwn(attributes,match[1]))fail('MALFORMED_XML',`Duplicate XML attribute ${match[1]}.`);
    // XML normalizes literal attribute whitespace, not character references.
    attributes[match[1]]=decodeXmlText(match[2].slice(1,-1).replace(/[\t\r\n]/g,' '));rest=rest.slice(match[0].length);
  }
  return attributes;
}
function parseXml(text){
  let source=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  for(const ch of source)if(!isXmlCharacter(ch.codePointAt(0)))fail('MALFORMED_XML','XML contains an illegal character.');
  if(source.startsWith('<?xml')){
    const declaration=source.match(/^<\?xml[ \t\n]+version[ \t\n]*=[ \t\n]*(["'])1\.0\1(?:[ \t\n]+encoding[ \t\n]*=[ \t\n]*(["'])UTF-8\2)?(?:[ \t\n]+standalone[ \t\n]*=[ \t\n]*(["'])(?:yes|no)\3)?[ \t\n]*\?>/);
    if(!declaration)fail('UNSUPPORTED_XML_DECLARATION','Only a valid XML 1.0 UTF-8 declaration is supported.');
    source=source.slice(declaration[0].length);
  }
  const documentNode={name:'#document',attributes:Object.create(null),children:[],content:[]},stack=[documentNode];let nodes=0,index=0;
  const appendText=(value,cdata=false)=>{
    if(stack.length===1){if(cdata||/[^\x20\x09\x0a\x0d]/.test(value))fail('MALFORMED_XML','Text and CDATA outside the document element are prohibited.');return;}
    if(!cdata&&value.includes(']]>'))fail('MALFORMED_XML','The CDATA closing delimiter is prohibited in ordinary XML text.');
    if(value)stack.at(-1).content.push(cdata?value:decodeXmlText(value));
  };
  while(index<source.length){
    const open=source.indexOf('<',index);if(open<0){appendText(source.slice(index));break;}appendText(source.slice(index,open));
    if(source.startsWith('<!--',open)){
      const end=source.indexOf('-->',open+4);if(end<0||/--|-$/.test(source.slice(open+4,end)))fail('MALFORMED_XML','Malformed XML comment.');
      index=end+3;continue;
    }
    if(source.startsWith('<![CDATA[',open)){
      const end=source.indexOf(']]>',open+9);if(end<0)fail('MALFORMED_XML','Unterminated XML CDATA section.');
      appendText(source.slice(open+9,end),true);index=end+3;continue;
    }
    if(source.startsWith('<?',open)||source.startsWith('<!',open))fail('UNSAFE_XML','DTD, entity declarations, and processing instructions are not supported.');
    let close=open+1,quote=null;
    for(;close<source.length;close++){
      const ch=source[close];
      if(quote){if(ch===quote)quote=null;}
      else if(ch==='"'||ch==="'")quote=ch;
      else if(ch==='>')break;
      else if(ch==='<')fail('MALFORMED_XML','Unexpected tag opening inside an XML tag.');
    }
    if(close===source.length)fail('MALFORMED_XML','Unterminated XML tag.');
    let body=source.slice(open+1,close);
    if(body.startsWith('/')){
      const closing=body.match(/^\/([A-Za-z_][A-Za-z0-9_.:-]*)[\x20\x09\x0a\x0d]*$/);
      if(!closing||stack.length===1||stack.at(-1).name!==closing[1])fail('MALFORMED_XML','Unexpected XML closing tag.');
      stack.pop();index=close+1;continue;
    }
    const selfClosing=body.endsWith('/');if(selfClosing)body=body.slice(0,-1);
    const name=body.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)/);if(!name)fail('MALFORMED_XML','XML element name is invalid or outside the supported name subset.');
    const node={name:name[1],attributes:parseXmlAttributes(body.slice(name[0].length)),children:[],content:[]};parsedXmlNodes.add(node);
    stack.at(-1).children.push(node);stack.at(-1).content.push(node);
    if(++nodes>LIMITS.maxXmlNodes)fail('XML_NODE_LIMIT','XML exceeds the registered node limit.');
    if(!selfClosing){stack.push(node);if(stack.length>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','XML exceeds the registered depth limit.');}
    index=close+1;
  }
  if(stack.length!==1)fail('MALFORMED_XML',`Unclosed XML element ${stack.at(-1).name}.`);
  if(documentNode.children.length!==1)fail('MALFORMED_XML','XML must contain exactly one document element.');
  return documentNode.children[0];
}
function parseXmlSelector(path){
  const text=String(path||'');if(!text.startsWith('/')||text.startsWith('//'))fail('UNSUPPORTED_XML_SELECTOR','XML selector must be an absolute child path beginning with one /.');
  const raw=text.slice(1).split('/');if(!raw.length||raw.some(part=>!part))fail('UNSUPPORTED_XML_SELECTOR','XML selector contains an empty segment.');
  if(raw.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','XML selector exceeds the registered depth limit.');
  return raw.map((part,index)=>{
    if(part==='text()'){if(index!==raw.length-1)fail('UNSUPPORTED_XML_SELECTOR','text() is supported only as the final XML selector segment.');return {kind:'text'};}
    if(part.startsWith('@')){if(index!==raw.length-1||!/^@[A-Za-z_][A-Za-z0-9_.:-]*$/.test(part))fail('UNSUPPORTED_XML_SELECTOR','XML attributes are supported only as a valid final @name segment.');return {kind:'attribute',name:part.slice(1)};}
    const match=part.match(/^(\*|[A-Za-z_][A-Za-z0-9_.:-]*)(?:\[(\d+)\])?$/),position=match?.[2]===undefined?null:Number(match[2]);
    if(!match||(position!==null&&(!Number.isSafeInteger(position)||position<1)))fail('UNSUPPORTED_XML_SELECTOR',`Unsupported XML selector segment ${part}.`);
    return {kind:'element',name:match[1],index:position};
  });
}
function xmlText(node){return node.content.map(item=>typeof item==='string'?item:xmlText(item)).join('');}
function selectXml(rootNode,path){
  if(!parsedXmlNodes.has(rootNode))fail('XML_NODE_REQUIRED','SELECT_XML requires a node produced by PARSE_XML.');
  const parts=parseXmlSelector(path),first=parts.shift();if(first.kind!=='element'||(first.name!=='*'&&first.name!==rootNode.name)||(first.index!==null&&first.index!==1))fail('XML_PATH_MISSING',`XML selector does not address document element ${rootNode.name}.`,STATUS.UNDETERMINED);
  let current=[rootNode];
  for(const part of parts){
    if(part.kind==='text')return current.map(xmlText);
    if(part.kind==='attribute')return current.filter(node=>hasOwn(node.attributes,part.name)).map(node=>node.attributes[part.name]);
    const next=[];for(const node of current){const matches=node.children.filter(child=>part.name==='*'||child.name===part.name);if(part.index!==null){if(matches[part.index-1])next.push(matches[part.index-1]);}else next.push(...matches);}current=next;
  }
  if(!current.length)fail('XML_PATH_MISSING',`XML selector does not resolve: ${path}.`,STATUS.UNDETERMINED);
  return current;
}


function validateJsonSourceExact(text){
  const source=text,length=source.length;let i=0,nodes=0;
  const ws=()=>{while(i<length&&/[\x20\x09\x0a\x0d]/.test(source[i]))i++;};
  const error=message=>fail('MALFORMED_JSON',`JSON parse failed: ${message} at character ${i}.`,STATUS.UNDETERMINED);
  const stringToken=()=>{if(source[i]!=='"')error('Expected string');const start=i++;let escaped=false;for(;i<length;i++){const ch=source[i];if(escaped){if(ch==='u'){if(!/^[0-9a-fA-F]{4}$/.test(source.slice(i+1,i+5)))error('Invalid Unicode escape');i+=4;}else if(!'"\\/bfnrt'.includes(ch))error('Invalid string escape');escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='"'){i++;try{return JSON.parse(source.slice(start,i));}catch{error('Invalid JSON string');}}if(ch.charCodeAt(0)<0x20)error('Unescaped control character');}error('Unterminated string');};
  const numberToken=()=>{const match=source.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);if(!match)error('Invalid number');const raw=match[0];i+=raw.length;if(raw.includes('.')||/[eE]/.test(raw))fail('UNSUPPORTED_JSON_NUMBER',`PARSE_JSON numeric token ${raw} is not a safe-integer JSON number. Use a typed exact number representation.`,STATUS.UNDETERMINED);const n=Number(raw);if(!Number.isSafeInteger(n)||Object.is(n,-0))fail('UNSUPPORTED_JSON_NUMBER',`PARSE_JSON numeric token ${raw} is outside the finite safe-integer domain.`,STATUS.UNDETERMINED);return n;};
  const parseValue=depth=>{
    if(depth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','JSON exceeds the registered depth limit.');
    if(++nodes>LIMITS.maxParsedNodes)fail('PARSED_NODE_LIMIT','JSON exceeds the registered node limit.');
    ws();const ch=source[i];
    if(ch==='"')return stringToken();
    if(ch==='{'){
      i++;ws();const value=Object.create(null),keys=[];jsonMemberOrder.set(value,keys);
      if(source[i]==='}'){i++;return value;}
      while(i<length){ws();const key=stringToken();if(hasOwn(value,key))fail('DUPLICATE_JSON_MEMBER',`PARSE_JSON rejects duplicate object member ${key}.`,STATUS.UNDETERMINED);ws();if(source[i++]!==':')error('Expected colon');value[key]=parseValue(depth+1);keys.push(key);ws();if(source[i]==='}'){i++;return value;}if(source[i++]!==',')error('Expected comma');}
      error('Unterminated object');
    }
    if(ch==='['){
      i++;ws();const value=[];if(source[i]===']'){i++;return value;}
      while(i<length){value.push(parseValue(depth+1));if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','JSON exceeds the registered collection limit.');ws();if(source[i]===']'){i++;return value;}if(source[i++]!==',')error('Expected comma');}
      error('Unterminated array');
    }
    if(source.startsWith('true',i)){i+=4;return true;}if(source.startsWith('false',i)){i+=5;return false;}if(source.startsWith('null',i)){i+=4;return null;}
    if(ch==='-'||/\d/.test(ch||''))return numberToken();error('Unexpected token');
  };
  const value=parseValue(1);ws();if(i!==length)error('Trailing content');return value;
}

function exactDecimalParts(value){
  if(value&&typeof value==='object'&&!Array.isArray(value)&&value.numberType==='DECIMAL')value=value.value;
  const text=String(value);if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)||text==='-0'||/^-0(?:\.0+)?$/.test(text))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact decimal value must be canonical plain decimal text with no exponent or negative zero.',STATUS.UNDETERMINED);
  const neg=text[0]==='-',body=neg?text.slice(1):text,[whole,fraction='']=body.split('.'),scale=fraction.length,digits=BigInt((whole+fraction)||'0');return{sign:neg?-1n:1n,digits,scale};
}
function decimalAlign(a,b){const scale=Math.max(a.scale,b.scale),pow=n=>10n**BigInt(n);return{a:a.sign*a.digits*pow(scale-a.scale),b:b.sign*b.digits*pow(scale-b.scale),scale};}
function decimalAbsDiff(a,b){const x=decimalAlign(exactDecimalParts(a),exactDecimalParts(b));return{digits:x.a>=x.b?x.a-x.b:x.b-x.a,scale:x.scale};}
function decimalAbs(value){const p=exactDecimalParts(value);return{digits:p.digits,scale:p.scale};}
function decimalMaxAbs(a,b){const aa=decimalAbs(a),bb=decimalAbs(b),x=decimalAlign({...aa,sign:1n},{...bb,sign:1n});return x.a>=x.b?{digits:x.a,scale:x.scale}:{digits:x.b,scale:x.scale};}
function decimalMultiply(a,b){const aa=exactDecimalParts(a),bb=b&&b.digits!==undefined?b:decimalAbs(b);return{digits:aa.digits*bb.digits,scale:aa.scale+bb.scale};}
function decimalLTE(left,right){const x=decimalAlign({sign:1n,digits:left.digits,scale:left.scale},{sign:1n,digits:right.digits,scale:right.scale});return x.a<=x.b;}
function exactApproximate(actual,expected,step){const issues=comparisonIssues(step,'Approximate comparison');for(const key of ['absTol','relTol','absoluteTolerance','relativeTolerance'])if(step[key]!==undefined&&!validateType(step[key],'exactNonnegativeDecimal'))issues.push('Tolerance must be a nonnegative exact decimal.');if(issues.length)fail('INVALID_TOLERANCE',issues.join(' '));const absTol=step.absTol??step.absoluteTolerance??'0',relTol=step.relTol??step.relativeTolerance??'0',diff=decimalAbsDiff(actual,expected),abs=decimalAbs(absTol),relProduct=decimalMultiply(relTol,decimalMaxAbs(actual,expected)),maxTol=decimalLTE(abs,relProduct)?relProduct:abs;return decimalLTE(diff,maxTol);}
function sortDomain(values,declared){if(!values.length)return declared||'STRING';const inferred=typeof values[0]==='string'?'STRING':typeof values[0]==='boolean'?'BOOLEAN':Number.isSafeInteger(values[0])?'INTEGER':values[0]&&values[0].numberType==='DECIMAL'?'DECIMAL':null,domain=declared||inferred;if(!domain)fail('SORT_DOMAIN','SORT requires an explicit supported homogeneous domain.',STATUS.UNDETERMINED);const ok=v=>domain==='STRING'?typeof v==='string':domain==='BOOLEAN'?typeof v==='boolean':domain==='INTEGER'?Number.isSafeInteger(v):domain==='DECIMAL'&&v&&v.numberType==='DECIMAL';if(!values.every(ok))fail('SORT_DOMAIN','SORT input is not homogeneous in the declared domain.',STATUS.UNDETERMINED);return domain;}
function compareSortValues(a,b,domain){if(domain==='STRING')return scalarCompare(a,b);if(domain==='BOOLEAN')return a===b?0:a?1:-1;if(domain==='INTEGER')return a===b?0:a<b?-1:1;if(domain==='DECIMAL')return compareDecimal(a.value,b.value);return 0;}

function inspectStructure(value){
  let nodes=0,maxDepth=0;const seen=new Set();const stack=[{value,depth:1}];
  while(stack.length){const item=stack.pop();nodes++;maxDepth=Math.max(maxDepth,item.depth);if(nodes>LIMITS.maxParsedNodes)fail('PARSED_NODE_LIMIT','Parsed structure exceeds the registered node limit.');if(maxDepth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','Parsed structure exceeds the registered depth limit.');const current=item.value;if(!current||typeof current!=='object'||seen.has(current))continue;seen.add(current);if(Array.isArray(current)){if(current.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','Parsed array exceeds the registered collection limit.');for(const child of current)stack.push({value:child,depth:item.depth+1});}else for(const child of Object.values(current))stack.push({value:child,depth:item.depth+1});}
  return {nodes,maxDepth};
}

function parseCsv(text,configuration){
  const {delimiter,header,quote,newline,encoding}=configuration;if(encoding!=='UTF-8')fail('UNSUPPORTED_ENCODING','Version 1 CSV supports UTF-8 only.');
  const rows=[];let row=[],cell='',state='UNQUOTED',started=false,cells=0,index=0;const source=text;
  const newlineAt=position=>{if(newline==='LF')return source[position]==='\n'?1:0;if(newline==='CR')return source[position]==='\r'?1:0;if(newline==='CRLF')return source.startsWith('\r\n',position)?2:0;if(source.startsWith('\r\n',position))return 2;if(source[position]==='\n'||source[position]==='\r')return 1;return 0;};
  const pushCell=()=>{row.push(cell);cell='';state='UNQUOTED';if(++cells>LIMITS.maxCsvCells)fail('CSV_CELL_LIMIT','CSV exceeds the registered cell limit.');};
  const pushRow=()=>{pushCell();rows.push(row);row=[];started=false;if(rows.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','CSV exceeds the registered row limit.');};
  while(index<source.length){
    const ch=String.fromCodePoint(source.codePointAt(index)),width=ch.length;
    if(state==='QUOTED'){
      if(ch===quote){if(source.startsWith(quote,index+width)){cell+=quote;index+=width*2;}else{state='AFTER_QUOTE';index+=width;}continue;}
      cell+=ch;index+=width;continue;
    }
    if(ch===delimiter){pushCell();started=true;index+=width;continue;}
    const lineWidth=newlineAt(index);if(lineWidth){pushRow();index+=lineWidth;continue;}
    if(state==='AFTER_QUOTE')fail('MALFORMED_CSV','Only a delimiter, contracted newline, or end may follow a closing quote.');
    if(ch===quote){if(cell.length)fail('MALFORMED_CSV','CSV quote begins inside an unquoted field.');state='QUOTED';started=true;index+=width;continue;}
    if(ch==='\r'||ch==='\n')fail('MALFORMED_CSV','CSV newline does not match the explicit newline contract.');
    cell+=ch;started=true;index+=width;
  }
  if(state==='QUOTED')fail('MALFORMED_CSV','CSV has an unterminated quoted field.');if(started||row.length)pushRow();
  if(!header)return rows;if(!rows.length)return [];const names=rows.shift();if(new Set(names).size!==names.length)fail('MALFORMED_CSV','CSV header names must be unique.');
  return rows.map((values,rowIndex)=>{if(values.length!==names.length)fail('MALFORMED_CSV',`CSV row ${rowIndex+2} has ${values.length} cells; expected ${names.length}.`);const row=Object.fromEntries(names.map((name,column)=>[name,values[column]]));jsonMemberOrder.set(row,names);return row;});
}

function normalizeDecimal(value){
  const text=String(value).trim();const match=text.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);if(!match)return null;let whole=match[2].replace(/^0+(?=\d)/,'');let fraction=(match[3]||'').replace(/0+$/,'');if(whole==='0'&&!fraction)return '0';return `${match[1]==='-'?'-':''}${whole}${fraction?'.'+fraction:''}`;
}
function compareDecimal(left,right){
  const a=normalizeDecimal(left),b=normalizeDecimal(right);if(a===null||b===null)fail('UNSUPPORTED_NUMERIC_PRECISION','Exact decimal comparison requires plain decimal strings.',STATUS.UNDETERMINED);if(a===b)return 0;const negA=a.startsWith('-'),negB=b.startsWith('-');if(negA!==negB)return negA?-1:1;const aa=negA?a.slice(1):a,bb=negB?b.slice(1):b;const [aw,af='']=aa.split('.'),[bw,bf='']=bb.split('.');let result=aw.length!==bw.length?(aw.length<bw.length?-1:1):aw!==bw?(aw<bw?-1:1):af.padEnd(Math.max(af.length,bf.length),'0')===bf.padEnd(Math.max(af.length,bf.length),'0')?0:af.padEnd(Math.max(af.length,bf.length),'0')<bf.padEnd(Math.max(af.length,bf.length),'0')?-1:1;return negA?-result:result;
}
function isSafeIntegerValue(value){return typeof value==='number'&&Number.isSafeInteger(value);}
function exactEqual(actual,expected,step){
  const mode=step.numericMode;
  if(mode==='DECIMAL_STRING')return compareDecimal(actual,expected)===0;
  if(mode==='APPROXIMATE')return exactApproximate(actual,expected,step);
  if(typeof actual==='number'||typeof expected==='number'){
    if(!isSafeIntegerValue(actual)||!isSafeIntegerValue(expected))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact numeric equality is supported only for safe integers unless DECIMAL_STRING or APPROXIMATE semantics are explicit.',STATUS.UNDETERMINED);
    return actual===expected;
  }
  return canonical(actual)===canonical(expected);
}
function orderedCompare(actual,expected){
  if(isSafeIntegerValue(actual)&&isSafeIntegerValue(expected))return actual===expected?0:actual<expected?-1:1;
  if(typeof actual==='string'&&typeof expected==='string'&&normalizeDecimal(actual)!==null&&normalizeDecimal(expected)!==null)return compareDecimal(actual,expected);
  fail('UNSUPPORTED_NUMERIC_PRECISION','Ordered numeric comparison supports safe integers or plain decimal strings only.',STATUS.UNDETERMINED);
}
function validateType(value,type){
  if(Object.prototype.hasOwnProperty.call(ARGUMENT_ENUMS,type))return ARGUMENT_ENUMS[type].includes(value);
  switch(type){
    case 'string':return typeof value==='string';case 'boolean':return typeof value==='boolean';case 'array':return Array.isArray(value);
    case 'binding':return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value);
    case 'delimiter':return typeof value==='string'&&[...value].length===1&&!['\r','\n'].includes(value);
    case 'quote':return typeof value==='string'&&[...value].length===1&&!['\r','\n'].includes(value);
    case 'regex':return typeof value==='string';case 'regexFlags':return typeof value==='string';
    case 'jsonSelector':try{if(typeof value!=='string')return false;parseJsonSelector(value);return true;}catch{return false;}
    case 'xmlSelector':try{if(typeof value!=='string')return false;parseXmlSelector(value);return true;}catch{return false;}
    case 'exactNonnegativeDecimal':try{const p=exactDecimalParts(value);return p.sign>0n||p.digits===0n;}catch{return false;}case 'nonnegativeNumber':return typeof value==='number'&&Number.isFinite(value)&&value>=0;
    default:return true;
  }
}
function validateStep(step,index){
  const issues=[];if(!step||typeof step!=='object'||Array.isArray(step))return [`Step ${index} must be an object.`];const definition=typeof step.op==='string'&&hasOwn(OP_DEFINITIONS,step.op)?OP_DEFINITIONS[step.op]:null;if(!definition)return [`Step ${index} uses unknown operation ${diagnosticLabel(step.op)}.`];
  const allowed=new Set(['op',...definition.required,...definition.optional]);for(const key of Object.keys(step))if(!allowed.has(key))return [`Step ${index} operation ${diagnosticLabel(step.op)} contains unknown property ${diagnosticLabel(key)}.`];
  for(const key of definition.required)if(!hasOwn(step,key))issues.push(`Step ${index} operation ${diagnosticLabel(step.op)} is missing required property ${diagnosticLabel(key)}.`);
  for(const [key,type] of Object.entries(definition.types||{}))if(hasOwn(step,key)&&!validateType(step[key],type))issues.push(`Step ${index} operation ${diagnosticLabel(step.op)} has invalid ${diagnosticLabel(key)}.`);
  for(const alternatives of definition.oneOf||[]){/* evaluated together below */}
  if(definition.oneOf){const present=definition.oneOf.filter(group=>group.every(key=>hasOwn(step,key)));if(present.length!==1)issues.push(`Step ${index} operation ${diagnosticLabel(step.op)} requires exactly one of ${definition.oneOf.map(group=>group.join('+')).join(' or ')}.`);}
  if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&typeof step.pattern==='string')issues.push(...validateRegex(step.pattern,step.flags).map(message=>`Step ${index}: ${message}`));
  if(['COMPARE','ASSERT_EQ'].includes(step.op)&&step.numericMode==='APPROXIMATE'&&!['absTol','relTol','absoluteTolerance','relativeTolerance'].some(key=>hasOwn(step,key)))issues.push(`Step ${index} approximate comparison requires absTol, relTol, or an explicitly supported compatibility tolerance.`);
  if(['COMPARE','ASSERT_EQ'].includes(step.op)&&typeof step.value==='number'&&!Number.isSafeInteger(step.value))issues.push(`Step ${index} numeric literals must be finite safe integers; use a typed DECIMAL value for precision-sensitive comparisons.`);
  if(step.op==='PARSE_CSV'&&step.delimiter===step.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);
  return issues;
}
function deepClone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function isInputRef(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const keys=Object.keys(value);
  if(keys.length===1&&keys[0]==='literal')return true;
  if(keys.length===1&&keys[0]==='bindingRef')return typeof value.bindingRef==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value.bindingRef);
  if(keys.length===2&&keys.includes('stepRef')&&keys.includes('output'))return typeof value.stepRef==='string'&&typeof value.output==='string'&&value.output.length>0;
  return false;
}
function validLiteral(value,depth=1,seen=new Set()){
  if(depth>LIMITS.maxParsedDepth)return false;
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isSafeInteger(value)&&!Object.is(value,-0);
  if(!value||typeof value!=='object'||seen.has(value))return false;
  if(Object.prototype.toString.call(value)!=='[object Object]'&&!Array.isArray(value))return false;
  if(Array.isArray(value)&&value.length>LIMITS.maxCollectionItems)return false;
  seen.add(value);const valid=Object.values(value).every(item=>validLiteral(item,depth+1,seen));seen.delete(value);return valid;
}
function valueInputType(op,name,value){
  const kind=VALUE_PORT_KINDS[op]?.[name];
  if(kind==='STRING')return typeof value==='string';
  if(kind==='ARRAY')return Array.isArray(value);
  if(kind==='STRING_OR_ARRAY')return Array.isArray(value)||typeof value==='string';
  if(kind==='STRING_OR_ARRAY_OR_BYTES')return Array.isArray(value)||typeof value==='string'||Boolean(bytesOf(value));
  return true;
}
function forbidsLiteralInput(op,name){return Boolean(INPUT_PORT_TYPES[op]?.[name]?.some(type=>['ARTIFACT','BYTES','XML_NODE'].includes(type)));}
function comparisonIssues(inputs,prefix){
  const issues=[],mode=inputs.numericMode;
  if(mode==='APPROXIMATE'&&!['absTol','relTol','absoluteTolerance','relativeTolerance'].some(key=>inputs[key]!==undefined))issues.push(`${prefix} approximate comparison requires an explicit tolerance.`);
  for(const [short,long] of [['absTol','absoluteTolerance'],['relTol','relativeTolerance']])if(inputs[short]!==undefined&&inputs[long]!==undefined&&inputs[short]!==inputs[long])issues.push(`${prefix} contains contradictory ${short} and ${long} tolerances.`);
  return issues;
}
function resolvedInputIssues(step,inputs){
  const issues=[];
  for(const [name,value] of Object.entries(inputs)){
    if(!valueInputType(step.op,name,value))issues.push(`${diagnosticLabel(step.op)} input ${diagnosticLabel(name)} has an invalid value type.`);
    const type=OP_DEFINITIONS[step.op]?.types?.[name];
    if(type&&!(step.op==='LOAD_ARTIFACT'&&name==='binding')&&!validateType(value,type))issues.push(`${diagnosticLabel(step.op)} input ${diagnosticLabel(name)} is invalid.`);
  }
  if(['COMPARE','ASSERT_EQ'].includes(step.op))issues.push(...comparisonIssues(inputs,step.op));
  if(['ASSERT_CONTAINS','ASSERT_NOT_CONTAINS'].includes(step.op)&&typeof inputs.actual==='string'&&typeof inputs.expected!=='string')issues.push(`${diagnosticLabel(step.op)} string containment requires a string expected input.`);
  return issues;
}

function priorRegistrySubset(spec){return spec?.operationRegistrySha256===PRIOR_OPERATION_REGISTRY_SHA256&&Array.isArray(spec.steps)&&spec.steps.length<=LIMITS.maxSteps&&spec.steps.every(step=>typeof step?.op==='string'&&hasOwn(PORT_CONTRACTS,step.op)&&step.op!=='SELECT_JSON_PATH');}
function validateDagSpec(spec,bindings,{allowPriorRegistry=false}={}){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  if(Array.isArray(spec.steps)&&spec.steps.length>LIMITS.maxSteps)return {valid:false,issues:[`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`]};
  const rootKeys=['version','languageVersion','operationRegistryVersion','operationRegistrySha256','steps','result'];
  for(const key of Object.keys(spec))if(!rootKeys.includes(key))return {valid:false,issues:[`Test IR contains unknown root property ${diagnosticLabel(key)}.`]};
  for(const key of rootKeys)if(!hasOwn(spec,key))issues.push(`Test IR is missing required root property ${diagnosticLabel(key)}.`);
  if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${diagnosticLabel(spec.version)}.`);
  if(spec.languageVersion!==TEST_IR_LANGUAGE_VERSION)issues.push(`Unsupported Test IR language version ${diagnosticLabel(spec.languageVersion)}.`);
  if(spec.operationRegistryVersion!==OPERATION_REGISTRY_VERSION)issues.push(`Unsupported operation registry version ${diagnosticLabel(spec.operationRegistryVersion)}.`);
  if(spec.operationRegistrySha256!==OPERATION_REGISTRY_SHA256&&!(allowPriorRegistry&&priorRegistrySubset(spec)))issues.push('Operation registry digest does not match the current registered semantics.');
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');
  const ids=new Set(),prior=new Map();
  for(const [index,step] of (Array.isArray(spec.steps)?spec.steps:[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} must be an object.`);continue;}
    for(const key of Object.keys(step))if(!['stepId','op','inputs'].includes(key))return {valid:false,issues:[...issues,`Step ${index} contains unknown property ${diagnosticLabel(key)}.`]};
    if(typeof step.stepId!=='string'||!/^S[0-9]{3,}$/.test(step.stepId))issues.push(`Step ${index} requires a canonical stepId such as S001.`);
    else if(ids.has(step.stepId))issues.push(`Duplicate stepId ${diagnosticLabel(step.stepId)}.`);
    const contract=typeof step.op==='string'&&hasOwn(PORT_CONTRACTS,step.op)?PORT_CONTRACTS[step.op]:null;if(!contract){issues.push(`Step ${index} uses unknown operation ${diagnosticLabel(step.op)}.`);continue;}
    if(!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)){issues.push(`Step ${index} operation ${diagnosticLabel(step.op)} requires a closed inputs object.`);continue;}
    const allowed=[...contract.requiredInputs,...contract.optionalInputs];for(const key of Object.keys(step.inputs))if(!allowed.includes(key))return {valid:false,issues:[...issues,`Step ${index} operation ${diagnosticLabel(step.op)} contains unknown input port ${diagnosticLabel(key)}.`]};
    for(const key of contract.requiredInputs)if(!hasOwn(step.inputs,key))issues.push(`Step ${index} operation ${diagnosticLabel(step.op)} is missing required input port ${diagnosticLabel(key)}.`);
    for(const [name,ref] of Object.entries(step.inputs)){
      if(!allowed.includes(name))continue;
      if(!isInputRef(ref)){issues.push(`Step ${index} input ${diagnosticLabel(name)} is not one literal, bindingRef, or prior step output reference.`);continue;}
      if(hasOwn(ref,'literal')){
        if(!validLiteral(ref.literal))issues.push(`Step ${index} input ${diagnosticLabel(name)} must be supported finite exact JSON data.`);
        if(!valueInputType(step.op,name,ref.literal))issues.push(`Step ${index} input ${diagnosticLabel(name)} has an invalid literal type.`);
        if(forbidsLiteralInput(step.op,name))issues.push(`Step ${index} input ${diagnosticLabel(name)} cannot fabricate an internal typed value with a literal.`);
      }
      const settingType=OP_DEFINITIONS[step.op]?.types?.[name];
      if(step.op==='LOAD_ARTIFACT'&&name==='binding'){
        if(!hasOwn(ref,'bindingRef'))issues.push(`Step ${index} LOAD_ARTIFACT requires an explicit bindingRef.`);
      }else if(settingType){
        if(name!=='message'&&!hasOwn(ref,'literal'))issues.push(`Step ${index} input ${diagnosticLabel(name)} must be a literal contract value so ingestion can validate it.`);
        if(hasOwn(ref,'literal')&&!validateType(ref.literal,settingType))issues.push(`Step ${index} input ${diagnosticLabel(name)} is invalid.`);
      }
      if(hasOwn(ref,'bindingRef')&&bindings!==undefined&&!hasOwn(bindings||{},ref.bindingRef))issues.push(`Step ${index} references undeclared binding ${diagnosticLabel(ref.bindingRef)}.`);
      if(hasOwn(ref,'stepRef')){
        if(!prior.has(ref.stepRef))issues.push(`Step ${index} has a forward, missing, or cyclic reference to ${diagnosticLabel(ref.stepRef)}.`);
        else {const priorStep=prior.get(ref.stepRef),priorContract=PORT_CONTRACTS[priorStep.op];if(!priorContract||!hasOwn(priorContract.outputs,ref.output))issues.push(`Step ${index} references unknown output port ${diagnosticLabel(ref.output)} on ${diagnosticLabel(ref.stepRef)}.`);else {const producedType=priorContract.outputs[ref.output],acceptedTypes=INPUT_PORT_TYPES[step.op]?.[name];if(acceptedTypes&&!acceptedTypes.includes(producedType))issues.push(`Step ${index} input ${diagnosticLabel(name)} requires ${acceptedTypes.join(' or ')} but ${diagnosticLabel(ref.stepRef)}.${diagnosticLabel(ref.output)} produces ${producedType}.`);}}
      }
    }
    if(['COMPARE','ASSERT_EQ'].includes(step.op))issues.push(...comparisonIssues(Object.fromEntries(Object.entries(step.inputs).filter(([,ref])=>ref&&hasOwn(ref,'literal')).map(([key,ref])=>[key,ref.literal])),`Step ${index}`));
    if(step.op==='REGEX'||step.op==='ASSERT_MATCH'){
      const pattern=step.inputs?.pattern?.literal,flags=step.inputs?.flags?.literal;if(typeof pattern==='string')issues.push(...validateRegex(pattern,flags).map(message=>`Step ${index}: ${message}`));
    }
    if(step.op==='PARSE_CSV'){
      for(const key of ['delimiter','header','quote','newline','encoding'])if(step.inputs?.[key]&&!hasOwn(step.inputs[key],'literal'))issues.push(`Step ${index} PARSE_CSV ${diagnosticLabel(key)} must be a literal contract value.`);
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
  else if(typeof spec.result.stepRef!=='string'||!prior.has(spec.result.stepRef))issues.push(`Test IR result references missing step ${diagnosticLabel(spec.result.stepRef)}.`);
  else {const contract=PORT_CONTRACTS[prior.get(spec.result.stepRef).op];if(typeof spec.result.output!=='string'||!hasOwn(contract.outputs,spec.result.output))issues.push(`Test IR result references unknown output ${diagnosticLabel(spec.result.output)}.`);else if(contract.outputs[spec.result.output]!=='ASSERTION'||!ASSERTION_OPS.has(prior.get(spec.result.stepRef).op))issues.push('Test IR result must be a registered ASSERTION output; ordinary data cannot supply a determination.');}
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);for(const issue of bindingResult.issues)issues.push(issue);}
  return {valid:issues.length===0,issues:[...new Set(issues)]};
}
function validateLegacySpec(spec,bindings){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  if(Array.isArray(spec.steps)&&spec.steps.length>LIMITS.maxSteps)return {valid:false,issues:[`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`]};
  for(const key of Object.keys(spec))if(!['version','steps'].includes(key))return {valid:false,issues:[`Legacy Test IR authoring form contains unknown root property ${diagnosticLabel(key)}.`]};
  if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${diagnosticLabel(spec.version)}.`);
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');
  for(const [index,step] of (Array.isArray(spec.steps)?spec.steps:[]).entries()){
    for(const issue of validateStep(step,index))issues.push(issue);if(typeof step?.op==='string'&&!hasOwn(PORT_CONTRACTS,step.op))issues.push(`Legacy authoring operation ${diagnosticLabel(step.op)} cannot compile to the canonical closed operation registry.`);
  }
  if(Array.isArray(spec.steps)&&spec.steps.length&&!spec.steps.some(step=>ASSERTION_OPS.has(step?.op)))issues.push('Test IR must contain at least one registered assertion operation.');
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);for(const issue of bindingResult.issues)issues.push(issue);const declared=new Set(Object.keys(bindings||{}));for(const [index,step] of (Array.isArray(spec.steps)?spec.steps:[]).entries())if(step&&typeof step.binding==='string'&&!declared.has(step.binding))issues.push(`Step ${index} references undeclared binding ${diagnosticLabel(step.binding)}.`);}
  return {valid:issues.length===0,issues:[...new Set(issues)]};
}
function validateSpec(spec,bindings,options={}){
  if(spec&&typeof spec==='object'&&hasOwn(spec,'languageVersion'))return validateDagSpec(spec,bindings,options);
  const legacy=validateLegacySpec(spec,bindings);if(!legacy.valid)return legacy;
  try{return validateDagSpec(compileLegacySpec(spec),bindings);}catch(error){return {valid:false,issues:[String(error?.message||error)]};}
}
const INPUT_BINDING_CONTRACT=Object.freeze({
  bindingName:Object.freeze({valueType:'STRING',pattern:'^[A-Z][A-Z0-9_]{0,63}$'}),
  bindingValueForms:Object.freeze(['NONEMPTY_ARTIFACT_ID_STRING','CLOSED_BINDING_OBJECT']),
  closed:true,
  properties:Object.freeze(Object.fromEntries(['kind','artifactId','source','artifactRole','filename','expectedSha256','canonicalKey','valueSha256'].map(name=>[name,Object.freeze({valueType:'STRING',required:false,nullable:false,nonempty:true,...(name==='kind'?{enumValues:Object.freeze(['ARTIFACT','CANONICAL_VALUE']),defaultValue:'ARTIFACT'}:name==='source'?{enumValues:Object.freeze(['CURRENT_PRODUCT','CURRENT_SCOPE','EXPLICIT_ARTIFACT'])}:['expectedSha256','valueSha256'].includes(name)?{pattern:'^[0-9a-f]{64}$'}:{})})]))),
  requirementsByKind:Object.freeze({ARTIFACT:Object.freeze({atLeastOne:Object.freeze(['artifactId','artifactRole','filename'])}),CANONICAL_VALUE:Object.freeze({required:Object.freeze(['canonicalKey'])})})
});
const inputBindingContract=()=>JSON.parse(JSON.stringify(INPUT_BINDING_CONTRACT));
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be a closed object.']};
  for(const [name,binding] of Object.entries(bindings)){
    if(!new RegExp(INPUT_BINDING_CONTRACT.bindingName.pattern).test(name))return {valid:false,issues:[`Invalid Test IR binding name ${diagnosticLabel(name)}.`]};
    if(typeof binding==='string'){if(!binding.trim())return {valid:false,issues:[`Binding ${diagnosticLabel(name)} cannot be empty.`]};continue;}
    if(!binding||typeof binding!=='object'||Array.isArray(binding))return {valid:false,issues:[`Binding ${diagnosticLabel(name)} must be an artifact ID string or a closed binding object.`]};
    const allowed=new Set(Object.keys(INPUT_BINDING_CONTRACT.properties));for(const key of Object.keys(binding)){if(!allowed.has(key))return {valid:false,issues:[`Binding ${diagnosticLabel(name)} contains unknown property ${diagnosticLabel(key)}.`]};else if(typeof binding[key]!=='string'||!binding[key].trim())issues.push(`Binding ${diagnosticLabel(name)} ${diagnosticLabel(key)} must be a nonempty STRING when present.`);}
    const kind=hasOwn(binding,'kind')?binding.kind:INPUT_BINDING_CONTRACT.properties.kind.defaultValue;if(typeof kind==='string'&&!INPUT_BINDING_CONTRACT.properties.kind.enumValues.includes(kind))issues.push(`Binding ${diagnosticLabel(name)} has unsupported kind ${diagnosticLabel(kind)}.`);
    if(kind==='ARTIFACT'&&!INPUT_BINDING_CONTRACT.requirementsByKind.ARTIFACT.atLeastOne.some(key=>typeof binding[key]==='string'&&binding[key].trim()))issues.push(`Binding ${diagnosticLabel(name)} does not identify an artifact.`);
    if(kind==='CANONICAL_VALUE'&&INPUT_BINDING_CONTRACT.requirementsByKind.CANONICAL_VALUE.required.some(key=>typeof binding[key]!=='string'||!binding[key].trim()))issues.push(`Binding ${diagnosticLabel(name)} does not identify an immutable canonical value.`);
    if(typeof binding.source==='string'&&!INPUT_BINDING_CONTRACT.properties.source.enumValues.includes(binding.source))issues.push(`Binding ${diagnosticLabel(name)} has unsupported source ${diagnosticLabel(binding.source)}.`);
    for(const key of ['expectedSha256','valueSha256'])if(hasOwn(binding,key)&&(typeof binding[key]!=='string'||!new RegExp(INPUT_BINDING_CONTRACT.properties[key].pattern).test(binding[key])))issues.push(`Binding ${diagnosticLabel(name)} ${diagnosticLabel(key)} is invalid.`);
    if(issues.length)return {valid:false,issues};
  }
  return {valid:issues.length===0,issues};
}
function outputPortFor(op){const outputs=Object.keys(PORT_CONTRACTS[op]?.outputs||{});if(outputs.length!==1)fail('UNDEFINED_OPERATION_OUTPUT',`Operation ${op} does not have exactly one registered output in version 1.`);return outputs[0];}
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
function normalizeSpec(spec,options={}){
  const original=validateSpec(spec,undefined,options);if(!original.valid)fail('INVALID_TEST_IR',original.issues.join(' '));
  const normalized=spec&&typeof spec==='object'&&hasOwn(spec,'languageVersion')?deepClone(spec):compileLegacySpec(spec);
  const check=validateDagSpec(normalized,undefined,options);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  return normalized;
}
function normalizeTestSpec(test){
  const spec=field(test,'EXECUTABLE_SPEC'),normalized=normalizeSpec(spec,{allowPriorRegistry:true}),stored=field(test,'EXECUTABLE_SPEC_SHA256');
  // Only a retained legacy definition with an exact application-owned prior
  // canonical hash can select this finite compatibility contract. No selector
  // operation (including unused branches) may acquire changed semantics.
  if(!hasOwn(spec,'languageVersion')&&typeof stored==='string'&&/^[0-9a-f]{64}$/.test(stored)&&root.closedLoopHash.sha256Value(normalized)!==stored){
    const previous={...normalized,operationRegistrySha256:PRIOR_OPERATION_REGISTRY_SHA256};
    if(priorRegistrySubset(previous)&&root.closedLoopHash.sha256Value(previous)===stored)return previous;
  }
  return normalized;
}
function executableSpecIdentityCurrent(test){
  const stored=field(test,'EXECUTABLE_SPEC_SHA256');
  // Unaccepted author proposals have no application-owned hash yet. A retained
  // accepted definition with a hash cannot silently acquire new registry meaning.
  if(stored===undefined||stored===null||stored==='')return !test?.fields;
  if(typeof stored!=='string'||!/^[0-9a-f]{64}$/.test(stored))return false;
  try{return root.closedLoopHash.sha256Value(normalizeTestSpec(test))===stored;}catch{return false;}
}
function supports(test){
  const mode=field(test,'EXECUTION_MODE');if(typeof mode!=='string'||mode.toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;
  const capability=field(test,'REQUIRED_CAPABILITY');if(typeof capability!=='string'||capability.toUpperCase()!==CAPABILITY)return false;
  const kind=field(test,'EXECUTABLE_KIND');if(typeof kind!=='string'||kind.toUpperCase()!==EXECUTABLE_KIND)return false;
  if(field(test,'EXECUTABLE_SPEC_VERSION')!==SPEC_VERSION)return false;
  return validateSpec(field(test,'EXECUTABLE_SPEC'),field(test,'EXECUTABLE_INPUT_BINDINGS'),{allowPriorRegistry:true}).valid&&executableSpecIdentityCurrent(test);
}
function resolveBinding(name,artifacts,canonicalBindings){
  if(hasOwn(artifacts||{},name))return {kind:'ARTIFACT',value:artifacts[name]};
  if(hasOwn(canonicalBindings||{},name)){const binding=canonicalBindings[name];if(!binding||typeof binding!=='object'||!hasOwn(binding,'value'))fail('INVALID_CANONICAL_BINDING',`Canonical binding ${name} must have its explicit transport value.`);return {kind:'CANONICAL_VALUE',value:binding.value};}
  fail('MISSING_BINDING',`Required binding ${name} is unavailable.`);
}
function collection(value,op){if(!Array.isArray(value))fail('COLLECTION_REQUIRED',`${op} requires an array.`);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT',`${op} input exceeds the registered collection limit.`);return value;}
function resultForAssertion(ok,expected,actual,message){return {determination:ok?STATUS.SATISFIED:STATUS.VIOLATED,expected,actual,message:message||null};}

function resolveDagInput(ref,outputs,artifacts,canonicalBindings){
  if(hasOwn(ref,'literal'))return deepClone(ref.literal);
  if(hasOwn(ref,'bindingRef'))return resolveBinding(ref.bindingRef,artifacts,canonicalBindings).value;
  const step=outputs.get(ref.stepRef);if(!step||!hasOwn(step,ref.output))fail('MISSING_STEP_OUTPUT',`Required output ${ref.stepRef}.${ref.output} is unavailable.`);return step[ref.output];
}
function bytesFrom(value){return bytesOf(value?.bytes??value);}
function assertion(ok,expected,actual,message){return {determination:ok?STATUS.SATISFIED:STATUS.VIOLATED,expected,actual,message:message||null};}
function observationValue(value,type){
  const bytes=bytesFrom(value);if(bytes)return {kind:'BYTES',byteLength:bytes.byteLength};
  if(type==='ASSERTION')return {kind:'ASSERTION',determination:value.determination,expected:value.expected,actual:value.actual,message:value.message||null};
  if(Array.isArray(value))return {kind:'ARRAY',length:value.length};
  if(value&&typeof value==='object')return {kind:'OBJECT',keys:Object.keys(value).slice(0,50)};
  return {kind:typeof value,value};
}
// Snapshot JSON values without coercion so the receipt hashes the value executed.
// Null-prototype copies also preserve plain objects received across JS realms.
function snapshotCanonicalValue(value,seen=new Set(),depth=1){
  if(value===null||typeof value!=='object')return value;
  if(depth>LIMITS.maxParsedDepth||seen.has(value))fail('INVALID_CANONICAL_VALUE','Canonical value is cyclic or too deeply nested.');
  const prototype=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&prototype!==null&&Object.getPrototypeOf(prototype)!==null)fail('INVALID_CANONICAL_VALUE','Canonical value must contain plain JSON objects.');
  if(Object.getOwnPropertySymbols(value).length)fail('INVALID_CANONICAL_VALUE','Canonical value cannot contain symbol properties.');
  const copy=Array.isArray(value)?new Array(value.length):Object.create(null);seen.add(value);
  for(const key of Object.keys(value)){const property=Object.getOwnPropertyDescriptor(value,key);if(!property||!hasOwn(property,'value'))fail('INVALID_CANONICAL_VALUE','Canonical value cannot contain accessors.');Object.defineProperty(copy,key,{value:snapshotCanonicalValue(property.value,seen,depth+1),enumerable:true,writable:true,configurable:true});}
  seen.delete(value);return copy;
}
async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){
  canonicalBindings=Object.fromEntries(Object.entries(canonicalBindings).map(([name,entry])=>{if(!entry||typeof entry!=='object'||!hasOwn(entry,'value'))fail('INVALID_CANONICAL_BINDING',`Canonical binding ${name} must have its explicit transport value.`);return [name,{...entry,value:snapshotCanonicalValue(entry.value)}];}));
  const normalized=normalizeSpec(spec,{allowPriorRegistry:true});const check=validateDagSpec(normalized,metadata.bindings,{allowPriorRegistry:true});if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  const bindingCheck=validateBindings(metadata.bindings||Object.fromEntries([...Object.keys(artifacts),...Object.keys(canonicalBindings)].map(key=>[key,hasOwn(artifacts,key)?{kind:'ARTIFACT',artifactId:String(artifacts[key]?.artifactId||key)}:{kind:'CANONICAL_VALUE',canonicalKey:key}])));if(!bindingCheck.valid)fail('INVALID_BINDINGS',bindingCheck.issues.join(' '));
  const inputViews=new Map();let totalInputBytes=0;for(const artifact of Object.values(artifacts||{})){const bytes=bytesFrom(artifact);if(!bytes)continue;let views=inputViews.get(bytes.buffer);if(!views){views=new Set();inputViews.set(bytes.buffer,views);}const view=`${bytes.byteOffset}:${bytes.byteLength}`;if(!views.has(view)){views.add(view);totalInputBytes+=bytes.byteLength;}}
  const envelope=validateResourceEnvelope({totalInputBytes});if(!envelope.valid)fail('INPUT_BYTE_LIMIT',envelope.issues.join(' '));
  const observations=[],outputs=new Map(),inputArtifactIds=[],inputArtifactSha256Values=[],inputCanonicalIdentities=[];let decisiveResult=null;
  for(const [bindingName,artifact] of Object.entries(artifacts||{})){const bytes=bytesFrom(artifact);if(!bytes)continue;const calculated=await sha256(bytes);if(artifact?.sha256&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifact.artifactId||bindingName} bytes do not match its declared SHA-256.`);inputArtifactIds.push(String(artifact?.artifactId||bindingName));inputArtifactSha256Values.push(calculated);}
  for(const [bindingName,entry] of Object.entries(canonicalBindings||{})){
    const binding=metadata.bindings?.[bindingName];
    if(binding&&binding.kind!=='CANONICAL_VALUE'||hasOwn(artifacts,bindingName))fail('INVALID_BINDINGS',`Canonical input ${bindingName} conflicts with its declared binding kind.`);
    if(!entry||typeof entry!=='object'||!hasOwn(entry,'value'))fail('MISSING_CANONICAL_VALUE',`Canonical input ${bindingName} has no value.`);
    const canonicalKey=String(binding?.canonicalKey||entry.canonicalKey||bindingName),valueSha256=await sha256Canonical(entry.value);
    if(entry.canonicalKey&&entry.canonicalKey!==canonicalKey)fail('CANONICAL_IDENTITY_MISMATCH',`Canonical input ${bindingName} has the wrong identity.`);
    if([binding?.valueSha256,entry.valueSha256].some(expected=>expected&&String(expected).toLowerCase()!==valueSha256))fail('CANONICAL_HASH_MISMATCH',`Canonical input ${bindingName} changed from its bound value.`);
    inputCanonicalIdentities.push({bindingName,canonicalKey,valueSha256});
  }
  for(const step of normalized.steps){
    const inputs=Object.fromEntries(Object.entries(step.inputs).map(([name,ref])=>[name,resolveDagInput(ref,outputs,artifacts,canonicalBindings)]));const inputIssues=resolvedInputIssues(step,inputs);if(inputIssues.length)fail('INVALID_INPUT_TYPE',inputIssues.join(' '));let out;
    switch(step.op){
      case 'LOAD_ARTIFACT':out={artifact:inputs.binding};break;
      case 'READ_BYTES':{const bytes=bytesFrom(inputs.artifact);if(!bytes)fail('BYTES_REQUIRED','READ_BYTES requires a byte-backed artifact binding.');out={bytes};break;}
      case 'DECODE_UTF8':{const bytes=bytesFrom(inputs.bytes);if(!bytes)fail('BYTES_REQUIRED','DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','UTF-8 input exceeds the registered text-byte limit.');if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT','UTF-8 input exceeds the registered decompressed-byte limit.');try{out={text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};}catch{fail('INVALID_UTF8','Input is not valid UTF-8.',STATUS.UNDETERMINED);}break;}
      case 'PARSE_JSON':{const value=validateJsonSourceExact(inputs.text);inspectStructure(value);out={value};break;}
      case 'PARSE_CSV':{const value=parseCsv(inputs.text,{delimiter:inputs.delimiter,header:inputs.header,quote:inputs.quote,newline:inputs.newline,encoding:inputs.encoding});inspectStructure(value);out={value};break;}
      case 'PARSE_XML':{const value=parseXml(inputs.text);inspectStructure(value);out={value};break;}
      case 'SELECT_JSON_PATH':out={selection:selectJsonPath(inputs.value,inputs.path)};break;
      case 'SELECT_XML':out={selection:selectXml(inputs.value,inputs.path)};break;
      case 'COUNT':{const value=inputs.value;if(value==null||typeof value.length!=='number')fail('COUNT_INPUT','COUNT requires an array, string, or array-like value.',STATUS.UNDETERMINED);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','COUNT input exceeds the registered collection limit.');out={count:value.length};break;}
      case 'SUM':case 'MIN':case 'MAX':{const values=collection(inputs.value,step.op);if(!values.every(isSafeIntegerValue))fail('UNSUPPORTED_NUMERIC_PRECISION',`${step.op} supports safe integers only in version 1.`,STATUS.UNDETERMINED);if(step.op!=='SUM'&&!values.length)fail('EMPTY_COLLECTION',`${step.op} requires at least one integer.`,STATUS.UNDETERMINED);const value=step.op==='SUM'?values.reduce((sum,item)=>{const next=sum+item;if(!Number.isSafeInteger(next))fail('INTEGER_OVERFLOW','SUM exceeded exact safe-integer range.',STATUS.UNDETERMINED);return next;},0):step.op==='MIN'?values.reduce((a,b)=>a<b?a:b):values.reduce((a,b)=>a>b?a:b);out={value};break;}
      case 'SORT':{const items=[...collection(inputs.value,'SORT')],domain=sortDomain(items,inputs.domain);items.sort((a,b)=>compareSortValues(a,b,domain));if((inputs.direction||'ASC')==='DESC')items.reverse();out={value:items};break;}
      case 'UNIQUE':{const seen=new Set(),value=collection(inputs.value,'UNIQUE').filter(item=>{const key=canonical(item);if(seen.has(key))return false;seen.add(key);return true;});out={value};break;}
      case 'HASH_SHA256':{const bytes=bytesFrom(inputs.bytes);if(!bytes)fail('BYTES_REQUIRED','HASH_SHA256 requires bytes.');out={sha256:await sha256(bytes)};break;}
      case 'REGEX':{const input=inputs.value;if(byteLength(input)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(inputs.pattern,inputs.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));out={match:new RegExp(inputs.pattern,inputs.flags||'').test(input)};break;}
      case 'COMPARE':{const left=inputs.left,right=inputs.right,operator=inputs.operator||'EQ';const options={numericMode:inputs.numericMode,absTol:inputs.absTol,relTol:inputs.relTol,absoluteTolerance:inputs.absoluteTolerance,relativeTolerance:inputs.relativeTolerance};const cmp=['EQ','NE'].includes(operator)?null:orderedCompare(left,right);let comparison;if(operator==='EQ')comparison=exactEqual(left,right,options);else if(operator==='NE')comparison=!exactEqual(left,right,options);else if(operator==='GT')comparison=cmp>0;else if(operator==='GTE')comparison=cmp>=0;else if(operator==='LT')comparison=cmp<0;else if(operator==='LTE')comparison=cmp<=0;else fail('INVALID_COMPARE_OPERATOR',`Unsupported compare operator ${operator}.`);out={comparison};break;}
      case 'BYTE_COMPARE':{const left=bytesFrom(inputs.left),right=bytesFrom(inputs.right);if(!left||!right)fail('BYTES_REQUIRED','BYTE_COMPARE requires explicit byte-backed left and right inputs.');let comparison=left.byteLength===right.byteLength;if(comparison)for(let i=0;i<left.byteLength;i++)if(left[i]!==right[i]){comparison=false;break;}out={comparison};break;}
      case 'ASSERT_EQ':{const actual=inputs.actual,expected=inputs.expected,options={numericMode:inputs.numericMode,absTol:inputs.absTol,relTol:inputs.relTol,absoluteTolerance:inputs.absoluteTolerance,relativeTolerance:inputs.relativeTolerance};out={assertion:assertion(exactEqual(actual,expected,options),expected,actual,inputs.message)};break;}
      case 'ASSERT_GT':case 'ASSERT_GTE':case 'ASSERT_LT':case 'ASSERT_LTE':{const actual=inputs.actual,expected=inputs.expected,cmp=orderedCompare(actual,expected),ok=step.op==='ASSERT_GT'?cmp>0:step.op==='ASSERT_GTE'?cmp>=0:step.op==='ASSERT_LT'?cmp<0:cmp<=0;out={assertion:assertion(ok,`${step.op.slice(7)} ${expected}`,actual,inputs.message)};break;}
      case 'ASSERT_MATCH':{const actual=inputs.actual;if(byteLength(actual)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(inputs.pattern,inputs.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));out={assertion:assertion(new RegExp(inputs.pattern,inputs.flags||'').test(actual),`matches /${inputs.pattern}/${inputs.flags||''}`,actual,inputs.message)};break;}
      case 'ASSERT_CONTAINS':case 'ASSERT_NOT_CONTAINS':{const actual=inputs.actual,expected=inputs.expected,contains=Array.isArray(actual)?actual.some(item=>canonical(item)===canonical(expected)):String(actual).includes(String(expected)),ok=step.op==='ASSERT_CONTAINS'?contains:!contains;out={assertion:assertion(ok,step.op==='ASSERT_CONTAINS'?`contains ${canonical(expected)}`:`does not contain ${canonical(expected)}`,actual,inputs.message)};break;}
      case 'ASSERT_SET_EQUAL':{const actual=collection(inputs.actual,'ASSERT_SET_EQUAL'),expected=collection(inputs.expected,'ASSERT_SET_EQUAL'),left=[...new Set(actual.map(canonical))].sort(),right=[...new Set(expected.map(canonical))].sort();out={assertion:assertion(canonical(left)===canonical(right),expected,actual,inputs.message)};break;}
      default:fail('UNKNOWN_OPERATION',`Unsupported Test IR operation ${step.op}.`);
    }
    outputs.set(step.stepId,out);const port=Object.keys(out)[0];observations.push({stepId:step.stepId,op:step.op,outputPort:port,...observationValue(out[port],PORT_CONTRACTS[step.op].outputs[port])});
    if(PORT_CONTRACTS[step.op].outputs.assertion==='ASSERTION'&&out.assertion.determination===STATUS.VIOLATED){decisiveResult={stepRef:step.stepId,output:'assertion'};break;}
  }
  const selectedResult=decisiveResult||normalized.result,selected=outputs.get(selectedResult.stepRef);if(!selected||!hasOwn(selected,selectedResult.output))fail('RESULT_OUTPUT_UNAVAILABLE','The selected Test IR result output was not produced.');const resultValue=selected[selectedResult.output];
  const normalizedDagSha256=await sha256Canonical(normalized),determination=resultValue?.determination||STATUS.UNDETERMINED;
  const executedStepIds=observations.map(row=>row.stepId),usedIdentities=nativeRegistryIdentity(normalized,executedStepIds);
  return {testId:metadata.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:normalizedDagSha256,normalizedDagSha256,testIrLanguageVersion:TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:normalized.operationRegistryVersion,operationRegistrySha256:normalized.operationRegistrySha256,...usedIdentities,executedStepIds,selectedResultStepId:selectedResult.stepRef,selectedResultPort:selectedResult.output,status:'COMPLETE',determination,expected:resultValue?.expected??null,actual:resultValue?.actual??resultValue,observations,evidence:[{kind:'APPLICATION_NATIVE_RUNTIME_OBSERVATION',testSpecSha256:normalizedDagSha256,inputArtifactIds,inputArtifactSha256Values,inputCanonicalIdentities}],executorVersion:VERSION,runtimeVersion:VERSION,inputArtifactIds,inputArtifactSha256Values,inputCanonicalIdentities};
}

const NATIVE_EXECUTION_IDENTITY_CONTRACT=Object.freeze({
 schema:'closed-loop-native-execution-identity/1',owner:'test-runtime.js',
 fields:Object.freeze(['schema','testId','runtimeVersion','runtimeBuildIdentity','testWorkerSha256','workerProtocolVersion','testSpecVersion','testSpecSha256','normalizedDagSha256','testIrLanguageVersion','operationRegistryVersion','operationRegistrySha256','jsonSelectorRegistryVersion','jsonSelectorRegistrySha256','xmlSelectorRegistryVersion','xmlSelectorRegistrySha256','regexRegistryVersion','regexRegistrySha256','parserRegistryIdentities','executedStepIds','selectedResultStepId','selectedResultPort','startedAtDeviceTime','endedAtDeviceTime']),
 parserIdentityFields:Object.freeze(['operation','registryVersion','registrySha256']),
 parserIdentityBasis:'Parser and UTF-8 decoder semantics are entries in the operation registry. Each actually executed parser/decoder operation retains that registry version and digest; no independent parser is implied.',
 currentness:'A completed execution binds the exact normalized accepted definition, executed step prefix, selected assertion, used registries, runtime, loaded build, worker bytes and protocol. A failed execution retains the loaded target identities with an empty verified step prefix and null selected result, never release-bearing. Unmanifested local observations are non-release-bearing.',
 timeBasis:'DEVICE_REPORTED; never trusted external time or canonical event ordering'
});
const PARSER_OPERATIONS=Object.freeze(['DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML']);
function nativeRegistryIdentity(normalized,executedStepIds){
 const executed=new Set(executedStepIds),used=new Set(normalized.steps.filter(step=>executed.has(step.stepId)).map(step=>step.op));
 return {
  jsonSelectorRegistryVersion:used.has('SELECT_JSON_PATH')?JSON_SELECTOR_REGISTRY_VERSION:null,jsonSelectorRegistrySha256:used.has('SELECT_JSON_PATH')?JSON_SELECTOR_REGISTRY_SHA256:null,
  xmlSelectorRegistryVersion:used.has('SELECT_XML')?XML_SELECTOR_REGISTRY_VERSION:null,xmlSelectorRegistrySha256:used.has('SELECT_XML')?XML_SELECTOR_REGISTRY_SHA256:null,
  regexRegistryVersion:used.has('REGEX')||used.has('ASSERT_MATCH')?REGEX_REGISTRY_VERSION:null,regexRegistrySha256:used.has('REGEX')||used.has('ASSERT_MATCH')?REGEX_REGISTRY_SHA256:null,
  parserRegistryIdentities:PARSER_OPERATIONS.filter(operation=>used.has(operation)).map(operation=>({operation,registryVersion:normalized.operationRegistryVersion,registrySha256:normalized.operationRegistrySha256}))
 };
}
function nativeExecutionIdentityCurrent(test,identity){
 const issues=[],reject=(code,message)=>issues.push({code,message});
 if(!identity||typeof identity!=='object'||Array.isArray(identity))return {valid:false,releaseBearing:false,issues:[{code:'NATIVE_EXECUTION_IDENTITY_MISSING',message:'A complete application-native execution identity is required.'}]};
 const keys=Object.keys(identity),required=NATIVE_EXECUTION_IDENTITY_CONTRACT.fields;
 if(keys.length!==required.length||required.some(key=>!hasOwn(identity,key))||keys.some(key=>!required.includes(key)))reject('NATIVE_EXECUTION_IDENTITY_SHAPE','The execution identity must contain exactly the published identity fields.');
 let normalized;try{if(!executableSpecIdentityCurrent(test))throw new Error('The accepted executable definition hash is missing or stale.');normalized=normalizeTestSpec(test);}catch(error){reject('STALE_EXECUTABLE_SPEC_IDENTITY',String(error?.message||error));return {valid:false,releaseBearing:false,issues};}
 const expected={schema:NATIVE_EXECUTION_IDENTITY_CONTRACT.schema,testId:field(test,'TEST_ID')||test?.testId||null,runtimeVersion:VERSION,runtimeBuildIdentity:RUNTIME_BUILD_ID,testWorkerSha256:EXPECTED_WORKER_SHA256,workerProtocolVersion:WORKER_PROTOCOL_VERSION,testSpecVersion:SPEC_VERSION,testSpecSha256:root.closedLoopHash.sha256Value(normalized),normalizedDagSha256:root.closedLoopHash.sha256Value(normalized),testIrLanguageVersion:normalized.languageVersion,operationRegistryVersion:normalized.operationRegistryVersion,operationRegistrySha256:normalized.operationRegistrySha256};
 for(const [key,value]of Object.entries(expected))if(identity[key]!==value)reject('NATIVE_EXECUTION_IDENTITY_MISMATCH',key+' does not match the accepted definition and loaded runtime.');
 const ids=identity.executedStepIds,failedExecution=Array.isArray(ids)&&ids.length===0&&identity.selectedResultStepId===null&&identity.selectedResultPort===null,validIds=Array.isArray(ids)&&(ids.length>0||failedExecution)&&ids.length<=normalized.steps.length&&ids.every((id,index)=>typeof id==='string'&&id===normalized.steps[index].stepId);
 if(!validIds)reject('NATIVE_EXECUTION_STEP_IDENTITY_MISMATCH','Executed step identities must be an ordered prefix of the normalized DAG; only a failed execution has an empty prefix and null result.');
 else{
  const selected=normalized.steps.find(step=>step.stepId===identity.selectedResultStepId);
  if(!failedExecution&&(identity.selectedResultPort!=='assertion'||!selected||!ASSERTION_OPS.has(selected.op)||!ids.includes(selected.stepId)))reject('NATIVE_EXECUTION_RESULT_IDENTITY_MISMATCH','The selected result must be an actually executed registered assertion output.');
  const registry=nativeRegistryIdentity(normalized,ids);for(const [key,value]of Object.entries(registry)){let same=false;try{same=hasOwn(identity,key)&&canonical(identity[key])===canonical(value);}catch{}if(!same)reject('NATIVE_EXECUTION_REGISTRY_MISMATCH',key+' does not match the executed operation registry.');}
 }
 for(const key of ['startedAtDeviceTime','endedAtDeviceTime'])if(typeof identity[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(identity[key])||!Number.isFinite(Date.parse(identity[key]))||new Date(identity[key]).toISOString()!==identity[key])reject('NATIVE_EXECUTION_TIME_IDENTITY_INVALID',key+' must retain the exact application-generated device timestamp.');
 const releaseBearing=issues.length===0&&!failedExecution&&RUNTIME_BUILD_ID.startsWith('build-sha256-')&&/^build-sha256-[0-9a-f]{64}$/.test(RUNTIME_BUILD_ID)&&/^[0-9a-f]{64}$/.test(EXPECTED_WORKER_SHA256||'');
 return {valid:issues.length===0,releaseBearing,failedExecution,issues};
}
function nativeExecutionOutcomeCurrent(test,identity,result){
 const checked=nativeExecutionIdentityCurrent(test,identity),reject=message=>{checked.issues.push({code:'NATIVE_EXECUTION_OUTCOME_IDENTITY_MISMATCH',message});checked.valid=false;checked.releaseBearing=false;};
 const honestFailure=checked.failedExecution&&['EXECUTION_FAILED','UNDETERMINED'].includes(result?.status)&&result?.determination===STATUS.UNDETERMINED&&typeof result?.failure?.code==='string'&&result.failure.code.length>0&&typeof result.failure.message==='string'&&result.failure.message.length>0&&Array.isArray(result.observations)&&result.observations.length===0;
 if(checked.failedExecution){if(!honestFailure)reject('A failed execution identity requires its explicit inconclusive failure and no fabricated completed observations.');}
 else if(result?.status!=='COMPLETE')reject('A completed execution identity requires a complete execution.');
 else if(checked.valid){
  const normalized=normalizeTestSpec(test),observations=result.observations,ids=identity.executedStepIds;
  if(!Array.isArray(observations)||observations.length!==ids.length||observations.some((row,index)=>!row||row.stepId!==ids[index]||row.op!==normalized.steps[index].op||!hasOwn(PORT_CONTRACTS[row.op]?.outputs||{},row.outputPort)))reject('Completed observations must retain the exact executed operation and output sequence.');
  else{
   const violation=observations.find(row=>row.kind==='ASSERTION'&&row.determination===STATUS.VIOLATED),selected=violation?{stepRef:violation.stepId,output:'assertion'}:normalized.result,observed=observations.find(row=>row.stepId===selected.stepRef&&row.outputPort===selected.output);
   if(!violation&&ids.length!==normalized.steps.length||violation&&ids.at(-1)!==violation.stepId||identity.selectedResultStepId!==selected.stepRef||identity.selectedResultPort!==selected.output||observed?.kind!=='ASSERTION'||!['SATISFIED','VIOLATED'].includes(observed.determination)||result.determination!==observed.determination)reject('The recorded outcome must be the declared assertion or first terminal violated assertion, after the required execution prefix.');
   else{let same=false;try{same=canonical(result.expected??null)===canonical(observed.expected??null)&&canonical(result.actual??null)===canonical(observed.actual??null);}catch{}if(!same)reject('The selected assertion values do not match the recorded outcome.');}
  }
 }
 return {...checked,failedExecution:honestFailure};
}
function nativeExecutionIdentity(test,result){
 const identity={schema:NATIVE_EXECUTION_IDENTITY_CONTRACT.schema};
 for(const key of NATIVE_EXECUTION_IDENTITY_CONTRACT.fields)if(key!=='schema'&&hasOwn(result||{},key))identity[key]=result[key]===undefined?undefined:deepClone(result[key]);
 return {...nativeExecutionOutcomeCurrent(test,identity,result),identity};
}

function workerUrl(){
  const source=RUNTIME_SCRIPT_URL,base=source||root.location?.href;if(!base)return 'test-worker.js';const url=new URL('test-worker.js',base);
  if(MANIFESTED_RUNTIME&&!EXPECTED_WORKER_SHA256)throw new RuntimeError('WORKER_DIGEST_IDENTITY_MISSING','The deployed runtime lacks its manifest-bound worker digest.');
  if(source)url.search=new URL(source).search;return url.href;
}
function executionFailure(test,startedAtDeviceTime,error){
  const disposition=error?.disposition===STATUS.UNDETERMINED?STATUS.UNDETERMINED:STATUS.EXECUTION_FAILED;
  // These are the loaded execution target identities, not a claim that a
  // worker completed any step. The null result and empty prefix preserve that
  // distinction when the application records an honest failed attempt.
  let definitionIdentity={};try{const normalized=normalizeTestSpec(test),digest=root.closedLoopHash.sha256Value(normalized);definitionIdentity={testSpecSha256:digest,normalizedDagSha256:digest,testIrLanguageVersion:normalized.languageVersion,operationRegistryVersion:normalized.operationRegistryVersion,operationRegistrySha256:normalized.operationRegistrySha256,...nativeRegistryIdentity(normalized,[])};}catch{}
  return {testId:field(test,'TEST_ID')||test?.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:null,...definitionIdentity,runtimeBuildIdentity:RUNTIME_BUILD_ID,testWorkerSha256:EXPECTED_WORKER_SHA256,workerProtocolVersion:WORKER_PROTOCOL_VERSION,executedStepIds:[],selectedResultStepId:null,selectedResultPort:null,status:disposition,determination:STATUS.UNDETERMINED,expected:null,actual:null,observations:[],evidence:[],executorVersion:VERSION,runtimeVersion:VERSION,inputArtifactIds:[],inputArtifactSha256Values:[],inputCanonicalIdentities:[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString(),failure:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error)}};
}
function executeTest(test,artifacts,canonicalBindings,options={}){
  const spec=field(test,'EXECUTABLE_SPEC');const bindings=field(test,'EXECUTABLE_INPUT_BINDINGS');const check=validateSpec(spec,bindings,{allowPriorRegistry:true});const startedAtDeviceTime=new Date().toISOString();if(!check.valid)return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('INVALID_TEST_IR',check.issues.join(' '))));
  if(!executableSpecIdentityCurrent(test))return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('STALE_EXECUTABLE_SPEC_IDENTITY','The accepted executable definition no longer matches its application-owned canonical hash and current registry. Reauthor and review it through Stage 06; retained raw responses and history remain available.')));
  const WorkerClass=options.Worker||root.Worker;if(typeof WorkerClass!=='function')return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_UNAVAILABLE','The isolated Test IR worker is unavailable.')));
  return new Promise(resolve=>{
    const requestId=`test-ir-${Date.now()}-${Math.random().toString(36).slice(2)}`;let settled=false,worker;try{worker=new WorkerClass(options.workerUrl||workerUrl());}catch(error){resolve(executionFailure(test,startedAtDeviceTime,error));return;}
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);try{worker.terminate();}catch{}resolve(result);};
    const timer=setTimeout(()=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_TIMEOUT',`Test IR worker exceeded ${LIMITS.workerTimeoutMs} ms.`))),Number(options.timeoutMs||LIMITS.workerTimeoutMs));
    worker.onmessage=event=>{const message=event?.data||{};if(message.requestId!==requestId)return;if(message.ok){if(MANIFESTED_RUNTIME&&(message.result?.runtimeBuildIdentity!==RUNTIME_BUILD_ID||message.result?.testWorkerSha256!==EXPECTED_WORKER_SHA256||message.result?.workerProtocolVersion!==WORKER_PROTOCOL_VERSION)){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_RESULT_IDENTITY_MISMATCH','Test IR worker result does not match the loaded runtime build, worker digest and protocol.')));return;}finish({...message.result,startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()});}else finish(executionFailure(test,startedAtDeviceTime,new RuntimeError(message.error?.code||'WORKER_EXECUTION_FAILED',message.error?.message||'Worker execution failed.',message.error?.disposition||STATUS.EXECUTION_FAILED)));};
    worker.onerror=event=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_ERROR',event?.message||'Test IR worker failed.')));
    try{const transfers=options.transferInputBuffers?[...new Set(Object.values(artifacts||{}).map(artifact=>bytesFrom(artifact)?.buffer).filter(buffer=>buffer instanceof ArrayBuffer))]:[];worker.postMessage({type:'EXECUTE_TEST_IR',requestId,spec:normalizeTestSpec(test),bindings,artifacts:artifacts||{},canonicalBindings:canonicalBindings||{},metadata:{testId:field(test,'TEST_ID')||test?.testId||null,bindings}},transfers);}catch(error){finish(executionFailure(test,startedAtDeviceTime,error));}
  });
}

function argumentContract(type){
  return ARGUMENT_ENUMS[type]?{valueType:'STRING',enumValues:[...ARGUMENT_ENUMS[type]]}:deepClone(ARGUMENT_DESCRIPTIONS[type]||{valueType:'VALUE'});
}
function operationContracts(){
  return Object.fromEntries(OPS.map(op=>{
    const ports=PORT_CONTRACTS[op],execution=OPERATION_EXECUTION_CONTRACTS[op];
    const inputs=Object.fromEntries([...ports.requiredInputs,...ports.optionalInputs].map(name=>{
      const settingType=OP_DEFINITIONS[op]?.types?.[name],bindingOnly=op==='LOAD_ARTIFACT'&&name==='binding';
      return [name,{cardinality:ports.requiredInputs.includes(name)?'EXACTLY_ONE':'ZERO_OR_ONE',
        referenceForms:bindingOnly?['bindingRef']:settingType&&name!=='message'?['literal']:forbidsLiteralInput(op,name)?['bindingRef','stepOutput']:['literal','bindingRef','stepOutput'],
        ...(settingType&&!bindingOnly?{argumentType:settingType,...argumentContract(settingType)}:{valueType:VALUE_PORT_KINDS[op]?.[name]||INPUT_PORT_TYPES[op]?.[name]?.join('_OR_')||'VALUE'}),
        ...(INPUT_PORT_TYPES[op]?.[name]?{acceptedPriorOutputTypes:[...INPUT_PORT_TYPES[op][name]],literalPermitted:!forbidsLiteralInput(op,name)}:{}),
        ...(bindingOnly?{bindingNamePattern:INPUT_BINDING_CONTRACT.bindingName.pattern}:{}),
        ...(op==='SORT'&&name==='direction'?{defaultValue:'ASC'}:op==='COMPARE'&&name==='operator'?{defaultValue:'EQ'}:{})}];
    }));
    return [op,{...deepClone(ports),inputs,outputCardinality:'EXACTLY_ONE_NAMED_OUTPUT',
      semantics:execution.meaning,deterministicErrorCodes:[...execution.errors],sharedErrors:'executionContract.sharedErrorCodes',
      errorPropagation:'executionContract.errorPropagation',resourceCostCategory:execution.cost}];
  }));
}
function authoringContract(){
  return {
    schema:'closed-loop-test-ir-authoring-contract/1',version:SPEC_VERSION,languageVersion:TEST_IR_LANGUAGE_VERSION,
    operationRegistryVersion:OPERATION_REGISTRY_VERSION,operationRegistrySha256:OPERATION_REGISTRY_SHA256,
    requiredRootProperties:['version','languageVersion','operationRegistryVersion','operationRegistrySha256','steps','result'],additionalRootProperties:false,
    steps:{minItems:1,maxItems:LIMITS.maxSteps,requiredProperties:['stepId','op','inputs'],additionalProperties:false,
      stepId:{valueType:'STRING',pattern:'^S[0-9]{3,}$',uniqueWithinSpecification:true,allocatedBy:'AUTHOR_WITH_APPLICATION_VALIDATION'},
      op:{valueType:'STRING',enumValues:[...OPS]},inputs:{additionalProperties:false,ports:'operations.<op>.inputs'},
      ordering:'Topological order. References resolve only to a previously declared step and one declared output port. No forward, cyclic, missing or ambient value references.'},
    inputReferenceForms:{exactlyOne:[{requiredProperties:['literal'],additionalProperties:false},{requiredProperties:['bindingRef'],additionalProperties:false,bindingRef:INPUT_BINDING_CONTRACT.bindingName},{requiredProperties:['stepRef','output'],additionalProperties:false,stepRef:'EXACT_PRIOR_STEP_ID',output:'EXACT_NAMED_OUTPUT_PORT'}]},
    literal:{valueTypes:['NULL','STRING','BOOLEAN','SAFE_INTEGER','ARRAY','PLAIN_OBJECT'],maxDepth:LIMITS.maxParsedDepth,maxArrayItems:LIMITS.maxCollectionItems,
      restrictions:'Finite JSON only; no negative zero, unsafe/fractional JSON numbers, cyclic values or internal ARTIFACT/BYTES/XML_NODE fabrication. Per-port types and semantics apply after reference resolution.'},
    result:{requiredProperties:['stepRef','output'],additionalProperties:false,stepRef:'EXACT_DECLARED_ASSERTION_STEP_ID',output:'assertion',permittedOperations:[...ASSERTION_OPS]},
    legacyAuthoring:{requiredProperties:['version','steps'],additionalProperties:false,version:SPEC_VERSION,
      operations:Object.fromEntries(OPS.map(op=>[op,deepClone(OP_DEFINITIONS[op])])),
      rules:'Optional compatibility form only. Flat steps contain op and exactly the listed required/optional properties. Each value-consuming step uses the immediately preceding named output after compilation; COMPARE chooses exactly one value or binding, BYTE_COMPARE uses its binding as right. The last step must produce an ASSERTION. The application compiles and validates the entire explicit DAG before acceptance; execute only the normalized DAG.'},
    argumentTypes:Object.fromEntries([...new Set(OPS.flatMap(op=>Object.values(OP_DEFINITIONS[op].types)))].map(type=>[type,argumentContract(type)])),
    operations:operationContracts(),inputBindings:inputBindingContract(),diagnostics:{...DIAGNOSTIC_POLICY},normalization:{...NORMALIZATION_CONTRACT},nativeExecutionIdentity:{...NATIVE_EXECUTION_IDENTITY_CONTRACT},limits:{...LIMITS},
    selectors:{
      jsonSelector:{version:JSON_SELECTOR_REGISTRY_VERSION,sha256:JSON_SELECTOR_REGISTRY_SHA256,
        grammar:["root := '$'",'segment := .identifier | .* | [index] | [*] | [\'name\']','identifier := [A-Za-z_][A-Za-z0-9_]*','index := 0 | [1-9][0-9]*; nonnegative safe integer',"bracket name permits only escaped single quote and escaped backslash; other characters are literal"],
        maxSegments:LIMITS.maxSelectorDepth,order:'Arrays retain item order. Parsed JSON preserves source-document member order and CSV row objects preserve header order. Structured literal and immutable canonical objects have no source-document order: use unsigned Unicode scalar key order from closed-loop-canonical-json/1, independently of insertion order.',excluded:['recursive descent','filters','unions','slices','script expressions']},
      xmlSelector:{version:XML_SELECTOR_REGISTRY_VERSION,sha256:XML_SELECTOR_REGISTRY_SHA256,
        grammar:['absolute child path beginning with exactly one /','element := name | * optionally followed by [positive-safe-integer]','name := [A-Za-z_][A-Za-z0-9_.:-]*','only final segment may be @name or text()'],
        maxSegments:LIMITS.maxSelectorDepth,positionBase:1,rootRule:'The first segment matches the document element; its only possible position is 1.',excluded:['//','other axes','other predicates','other functions','empty segments']}},
    regex:{version:REGEX_REGISTRY_VERSION,sha256:REGEX_REGISTRY_SHA256,flags:{valueType:'STRING',uniqueCharacters:['i','m','s','u'],defaultValue:''},
      supported:['literal characters','.','character classes, ranges and negation','\\d \\D \\w \\W \\s \\S','^ $','alternation','capturing and non-capturing groups','greedy and lazy * + ? {m} {m,} {m,n}','JavaScript-compatible \\b \\B \\f \\n \\r \\t \\v \\u \\x escapes'],
      excluded:['backreferences','legacy numeric escapes','lookaround','named groups','inline mode groups','Unicode property escapes','unsupported alphabetic escapes','nested unbounded quantification'],
      maxUnboundedQuantifiers:MAX_REGEX_UNBOUNDED_QUANTIFIERS,maxPatternUtf8Bytes:LIMITS.maxRegexPatternBytes,maxPatternUtf16CodeUnits:LIMITS.maxRegexLength,maxInputUtf8Bytes:LIMITS.maxRegexInputBytes,
      rule:'The pattern must also compile as a JavaScript RegExp with the declared flags. Runtime work is isolated by the published worker timeout.'},
    csv:{allSettingsRequired:true,delimiterAndQuoteMustDiffer:true,newlineValues:[...ARGUMENT_ENUMS.csvNewline],encodingValues:[...ARGUMENT_ENUMS.utf8],newlineAuto:'Accept CRLF, LF or CR; quoted content is preserved.',headerValues:[false,true],selector:'jsonSelector'},
    numericSemantics:{integer:'JSON numbers are finite safe integers. SUM checks each intermediate result; unsupported precision is UNDETERMINED.',
      equality:'Default or INTEGER: safe integers if either value is a number, otherwise canonical JSON equality. DECIMAL_STRING: exact plain decimal-string interpretation, accepting leading +, zeros and surrounding whitespace. No exponent.',
      approximate:'COMPARE/ASSERT_EQ numericMode APPROXIMATE requires explicit absTol or relTol, or compatibility names absoluteTolerance/relativeTolerance. Aliases may coexist only when their values are strictly equal primitives (same text or same number); separately supplied typed DECIMAL objects conflict even when their contents match. Prefer one name per tolerance component, especially for typed objects. Tolerances are nonnegative exact decimals. abs(actual-expected) <= max(absTol, relTol*max(abs(actual),abs(expected))). Omitted tolerance component is zero.',
      ordered:'GT/GTE/LT/LTE support safe integers or plain decimal strings; they do not use approximate mode.',typedDecimal:'{numberType:"DECIMAL",value:"<plain decimal text>"} supports declared DECIMAL sorting and approximate operands; it is not an arbitrary-precision JSON number.'},
    executionContract:{
      sharedErrorCodes:['INVALID_TEST_IR','INVALID_BINDINGS','INVALID_INPUT_TYPE','INVALID_CANONICAL_BINDING','INVALID_CANONICAL_VALUE','MISSING_BINDING','MISSING_CANONICAL_VALUE','MISSING_STEP_OUTPUT','INPUT_BYTE_LIMIT','ARTIFACT_HASH_MISMATCH','CANONICAL_IDENTITY_MISMATCH','CANONICAL_HASH_MISMATCH','CANONICAL_HASH_AUTHORITY_UNAVAILABLE','RESULT_OUTPUT_UNAVAILABLE','UNDEFINED_OPERATION_OUTPUT','IMPLICIT_OPERAND_MISSING','UNKNOWN_OPERATION'],
      workerErrorCodes:['STALE_EXECUTABLE_SPEC_IDENTITY','WORKER_UNAVAILABLE','WORKER_TIMEOUT','WORKER_ERROR','WORKER_EXECUTION_FAILED','WORKER_DIGEST_IDENTITY_MISSING','WORKER_RESULT_IDENTITY_MISMATCH'],
      undeterminedErrorCodes:['INVALID_UTF8','JSON_PATH_MISSING','XML_PATH_MISSING','MALFORMED_JSON','UNSUPPORTED_JSON_NUMBER','DUPLICATE_JSON_MEMBER','UNSUPPORTED_NUMERIC_PRECISION','SORT_DOMAIN','COUNT_INPUT','EMPTY_COLLECTION','INTEGER_OVERFLOW'],
      errorPropagation:'Validation rejects malformed definitions before execution. A typed error stops execution; no dependent or later step consumes a failed output. execute throws that typed error; the isolated executeTest boundary returns its registered UNDETERMINED disposition or EXECUTION_FAILED, determination UNDETERMINED, and no partial observations/evidence. Unexpected worker/platform failures are EXECUTION_FAILED, never SATISFIED.',
      assertionPropagation:'A VIOLATED assertion terminates the DAG and becomes the decisive result; otherwise the explicitly selected ASSERTION result determines the outcome. Ordinary data cannot create a determination.',
      intermediateLifetime:'Current execution only, except explicitly emitted observations/evidence.',
      resourceCosts:'Categories describe the implementation work shape, not a measured duration or a new budget. All operations remain under centralized limits and isolated workerTimeoutMs; unsupported work routes externally or remains blocked.'},
    priorRegistryCompatibility:{operationRegistrySha256:PRIOR_OPERATION_REGISTRY_SHA256,excludedOperations:['SELECT_JSON_PATH'],scope:'Retained accepted definitions only; new author submissions must use the current published registry. Explicit prior DAGs retain their exact prior identity. Legacy retained forms must match their stored application-owned canonical hash under that exact prior registry. All ordinary syntax, type, binding and resource checks still apply; missing or changed hashes and any excluded operation require reauthor/review. Receipts report the selected DAG registry, never relabel prior work as the current registry.'},
    recovery:'Contract error: correct the declared syntax/type/value. Missing/stale binding or bytes: obtain the authorized current input and regenerate as required. Unsupported language/precision/format or exceeded supported limit: route externally or report BLOCKED, never fabricate a passing native receipt.'
  };
}
const capabilities=()=>Object.freeze([CAPABILITY]);
root.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,TEST_IR_LANGUAGE_VERSION,OPERATION_REGISTRY_VERSION,OPERATION_REGISTRY_SHA256,JSON_SELECTOR_REGISTRY_VERSION,JSON_SELECTOR_REGISTRY_SHA256,XML_SELECTOR_REGISTRY_VERSION,XML_SELECTOR_REGISTRY_SHA256,REGEX_REGISTRY_VERSION,REGEX_REGISTRY_SHA256,OPS,OP_DEFINITIONS,PORT_CONTRACTS,INPUT_PORT_TYPES,LIMITS,STATUS,RuntimeError,exactDecimalParts,validateSpec,validateBindings,inputBindingContract,normalizeSpec,normalizeTestSpec,supports,execute,executeTest,capabilities,operationContracts,authoringContract,NORMALIZATION_CONTRACT,NATIVE_EXECUTION_IDENTITY_CONTRACT,nativeExecutionIdentity,nativeExecutionIdentityCurrent,nativeExecutionOutcomeCurrent,executableSpecIdentityCurrent,sha256Canonical,validateResourceEnvelope,validateRegex,parseJsonSelector});
})();
