import {encodeNormativeManifest,projectInsertionEntryProvenance,reconstructInsertionEntryProvenance} from './normative-manifest-storage.mjs';
// Reviewed insertion-only source continuation. Ordinary source owners retain
// their original path; this explicit branch binds immutable base plus current delta.
import crypto from 'node:crypto';
import path from 'node:path';
import {validateSpecificationSource,validateAtomicRequirementRows,validateAtomicSectionCoverage,validateAtomicGoverningOccurrences,loadAtomicComponentReconciliation,validateAtomicLineMembership,projectAtomicSectionInventory,sourceInventorySummary,reviewSpecificationCoverageBytes,generatorMechanicalCandidates,mergeGeneratorMechanicalCandidates,applyGeneratorSourceClauses,applyGeneratorSourceSemantics,validateGeneratorMandatorySourceTraces,validateGeneratorSemanticTraceReferences,materializeGeneratorSourceCoverage,materializeGeneratorAtomicMembership,validateGeneratorResolvedSourceCoverage,atomicObligationSha256,isAtomicEvidencePath,readAtomicEvidenceBytes,loadReviewedAtomicExtraction,atomicEvidenceReferences} from './review-specification-coverage.mjs';

export const insertionTransportVersion='closed-loop-approved-insertion-transport/1';
export const insertionDagVersion='closed-loop-insertion-evidence-dag/1';
const maps=new WeakMap();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=(code,message)=>{const error=new Error(`${code}: ${message}`);error.code=code;throw error;};
const need=(value,code,message)=>{if(!value)fail(code,message);};
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const canonical=value=>globalThis.closedLoopHash.stableStringify(value);
const equal=(a,b)=>canonical(a)===canonical(b);
const keys=(value,expected,code)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&equal(Object.keys(value).sort(),[...expected].sort()),code,'Unexpected or missing fields.');
function source(bytes){
  need(Buffer.isBuffer(bytes),'INSERTION_SOURCE_BYTES','Exact source Buffer required.');
  const copy=Buffer.from(bytes),text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(copy);
  need(Buffer.from(text).equals(copy),'INSERTION_SOURCE_UTF8','Source must round-trip exactly.');
  need(text.endsWith('\n')&&!text.includes('\r'),'INSERTION_SOURCE_LINES','LF physical source lines required.');
  const lines=text.split('\n');lines.pop(); // The final split sentinel is not a physical line.
  let offset=0;const starts=lines.map(line=>{const start=offset;offset+=Buffer.byteLength(line)+1;return start;});
  return {bytes:copy,lines,starts};
}
function identity(bytes,expected,code){need(digest(expected)&&sha(bytes)===expected,code,'Exact byte digest mismatch.');}
function mapData(map){const data=maps.get(map);need(data,'INSERTION_MAP_BRAND','Map was not validated by this module.');return data;}

export function createApprovedInsertionMap({baseBytes,currentBytes,proposalBytes,baseSha256,currentSha256,proposalSha256,specificationPath,ranges}){
  need(isAtomicEvidencePath(specificationPath)&&specificationPath.startsWith('specification/')&&specificationPath.endsWith('.txt'),'INSERTION_SOURCE_PATH','Explicit first-party specification text path required.');
  const base=source(baseBytes),current=source(currentBytes),proposal=source(proposalBytes);
  identity(base.bytes,baseSha256,'INSERTION_BASE_HASH');identity(current.bytes,currentSha256,'INSERTION_CURRENT_HASH');identity(proposal.bytes,proposalSha256,'INSERTION_PROPOSAL_HASH');
  need(Array.isArray(ranges)&&ranges.length>0,'INSERTION_RANGES','Approved range inventory required.');
  const records=[];let addedLines=0,addedBytes=0,priorBefore=0;
  const compose=items=>{
    const parts=[];let cursor=0;
    for(const item of items){parts.push(base.bytes.subarray(cursor,item.baseByte),item.bytes);cursor=item.baseByte;}
    parts.push(base.bytes.subarray(cursor));return Buffer.concat(parts);
  };
  for(const range of ranges){
    need(range&&typeof range==='object','INSERTION_RANGE','Range object required.');
    const before=range.insertBeforeBaseLine,a=range.approvedProposalSourceStartLine,b=range.approvedProposalSourceEndLine;
    need(Number.isSafeInteger(before)&&before>=1&&before<=base.lines.length&&before>=priorBefore,'INSERTION_ANCHOR','Physical insertion anchor missing, out of order or outside base source.');
    need(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>=1&&b>=a&&b<=proposal.lines.length,'INSERTION_PROPOSAL_RANGE','Proposal range is invalid.');
    const bytes=Buffer.from(proposal.lines.slice(a-1,b).join('\n')+'\n\n'),lineCount=b-a+2,baseByte=base.starts[before-1];
    need(range.baseSpecificationSha256===baseSha256,'INSERTION_RANGE_BASE','Range has another identity base.');
    need(range.startLine===before+addedLines&&range.lineCount===lineCount&&range.endLine===range.startLine+lineCount-1&&range.insertBeforeBaseByte===baseByte,'INSERTION_RANGE_COORDINATES','Range start/count does not follow exact source order.');
    need(range.byteLength===bytes.length&&range.textSha256===sha(bytes),'INSERTION_RANGE_BYTES','Range differs from exact approved proposal bytes.');
    need(range.previousSpecificationSha256===sha(compose(records)),'INSERTION_PREDECESSOR','Sequential predecessor mismatch.');
    const currentByte=baseByte+addedBytes;
    need(current.starts[range.startLine-1]===currentByte&&current.bytes.subarray(currentByte,currentByte+bytes.length).equals(bytes),'INSERTION_CURRENT_RANGE','Current range bytes or coordinates differ.');
    records.push({before,baseByte,currentByte,bytes,lineCount,startLine:range.startLine});
    need(range.successorAfterThisInsertionSha256===sha(compose(records)),'INSERTION_SUCCESSOR','Sequential successor mismatch.');
    priorBefore=before;addedLines+=lineCount;addedBytes+=bytes.length;
  }
  need(compose(records).equals(current.bytes),'INSERTION_RECONSTRUCTION','Current source is not exactly base plus declared insertions.');
  need(current.lines.length===base.lines.length+addedLines,'INSERTION_PHYSICAL_LINES','Physical line count differs.');
  const forwardLine=line=>{
    need(Number.isSafeInteger(line)&&line>=1&&line<=base.lines.length,'INSERTION_BASE_LINE','Base coordinate is not a physical source line.');
    return line+records.filter(r=>r.before<=line).reduce((n,r)=>n+r.lineCount,0);
  };
  const inverseLine=line=>{
    need(Number.isSafeInteger(line)&&line>=1&&line<=current.lines.length,'INSERTION_CURRENT_LINE','Current coordinate is not a physical source line.');
    let delta=0;
    for(const r of records){need(line<r.startLine||line>=r.startLine+r.lineCount,'INSERTION_NEW_LINE','An inserted line has no original occurrence.');if(line>=r.startLine+r.lineCount)delta+=r.lineCount;}
    const original=line-delta;need(forwardLine(original)===line,'INSERTION_LINE_INVERSE','Line inverse mismatch.');return original;
  };
  const forwardLineRange=(start,end)=>{
    forwardLine(start);forwardLine(end);need(start<=end,'INSERTION_LINE_RANGE','Reversed line range.');
    const cuts=[...new Set(records.map(r=>r.before).filter(n=>n>start&&n<=end))].sort((a,b)=>a-b),segments=[];let at=start;
    for(const cut of [...cuts,end+1]){segments.push([forwardLine(at),forwardLine(cut-1)]);at=cut;}
    return segments;
  };
  const forwardByteRange=(start,end)=>{
    need(integer(start)&&integer(end)&&start<end&&end<=base.bytes.length,'INSERTION_BYTE_RANGE','Base byte range is invalid.');
    const cuts=[...new Set(records.map(r=>r.baseByte).filter(n=>n>start&&n<end))].sort((a,b)=>a-b),segments=[];let at=start;
    const begin=n=>n+records.filter(r=>r.baseByte<=n).reduce((sum,r)=>sum+r.bytes.length,0);
    const finish=n=>n+records.filter(r=>r.baseByte<n).reduce((sum,r)=>sum+r.bytes.length,0);
    for(const cut of [...cuts,end]){segments.push({startByte:begin(at),endByte:finish(cut)});at=cut;}
    return segments;
  };
  const inverseByteRange=(start,end)=>{
    need(integer(start)&&integer(end)&&start<end&&end<=current.bytes.length,'INSERTION_CURRENT_BYTE_RANGE','Current byte range is invalid.');
    for(const r of records)need(end<=r.currentByte||start>=r.currentByte+r.bytes.length,'INSERTION_NEW_BYTES','Range contains bytes with no original occurrence.');
    const back=n=>n-records.filter(r=>r.currentByte+r.bytes.length<=n).reduce((sum,r)=>sum+r.bytes.length,0);
    const result={startByte:back(start),endByte:back(end)},again=forwardByteRange(result.startByte,result.endByte);
    need(again.length===1&&again[0].startByte===start&&again[0].endByte===end,'INSERTION_BYTE_INVERSE','Byte inverse mismatch.');return result;
  };
  const map=Object.freeze({version:insertionTransportVersion,specificationPath,baseSha256,currentSha256,proposalSha256,basePhysicalLines:base.lines.length,currentPhysicalLines:current.lines.length,addedLines,addedBytes,forwardLine,inverseLine,forwardLineRange,forwardByteRange,inverseByteRange});
  maps.set(map,{base,current,records,specificationPath});return map;
}

export function validateInsertionMapSegments(map,segments){
  const {base,records}=mapData(map),expected=[];
  let at=1,lineDelta=0,byteDelta=0;
  for(const r of records){
    if(at<r.before)expected.push({baseStartLine:at,baseEndLine:r.before-1,lineDelta,byteDelta});
    at=r.before;lineDelta+=r.lineCount;byteDelta+=r.bytes.length;
  }
  expected.push({baseStartLine:at,baseEndLine:base.lines.length,lineDelta,byteDelta});
  need(Array.isArray(segments)&&equal(segments,expected),'INSERTION_SEGMENTS','Declared segments differ from the exact original physical-line occurrence set.');
  return true;
}

function location(value,src,path){
  keys(value,['path','startLine','endLine','lineSha256','controllingText'],'INSERTION_CONTEXT_FIELDS');
  need(value.path===path&&Number.isSafeInteger(value.startLine)&&value.startLine>=1&&value.startLine<=src.lines.length&&value.endLine===value.startLine,'INSERTION_CONTEXT_LOCATION','Context coordinate/path is invalid.');
  const raw=src.lines[value.startLine-1];need(value.lineSha256===sha(Buffer.from(raw))&&value.controllingText===raw.trim(),'INSERTION_CONTEXT_BYTES','Context differs from exact source.');
}
function scopeEntry(entry,src,specificationPath){
  need(entry&&entry.entryKind==='ATOMIC_OBLIGATION','INSERTION_ATOMIC_ENTRY','An actual atomic entry is required.');
  keys(entry.sourceLocation,['path','startLine','endLine','lineSha256'],'INSERTION_PRIMARY_FIELDS');
  const primary={...entry.sourceLocation,controllingText:entry.controllingText};location(primary,src,specificationPath);
  const scope=entry.atomicObligation;keys(scope,['key','statement','sourceSpans','contextSourceLocations','sha256'],'INSERTION_SCOPE_FIELDS');
  need(typeof scope.key==='string'&&/^[a-z][a-z0-9.-]*$/.test(scope.key)&&typeof scope.statement==='string'&&scope.statement.trim(),'INSERTION_SCOPE_VALUE','Scope key/statement is missing.');
  need(digest(scope.sha256)&&scope.sha256===atomicObligationSha256(scope),'INSERTION_SCOPE_DIGEST','Scope digest does not match its original coordinate-bearing preimage.');
  need(Array.isArray(scope.sourceSpans)&&scope.sourceSpans.length>0&&Array.isArray(scope.contextSourceLocations),'INSERTION_SCOPE_COLLECTIONS','Scope spans/contexts are missing.');
  const line=primary.startLine,start=src.starts[line-1],end=start+Buffer.byteLength(src.lines[line-1]);let prior=-1;const spanKeys=new Set();
  for(const span of scope.sourceSpans){
    keys(span,['startByte','endByte','text','sha256'],'INSERTION_SPAN_FIELDS');
    need(integer(span.startByte)&&integer(span.endByte)&&span.startByte>=start&&span.endByte<=end&&span.endByte>span.startByte&&span.startByte>=prior,'INSERTION_SPAN_LOCATION','Span is outside its primary physical line or unordered.');
    const spanKey=`${span.startByte}:${span.endByte}`;need(!spanKeys.has(spanKey),'INSERTION_SPAN_DUPLICATE','Span occurrence is duplicated.');spanKeys.add(spanKey);
    const bytes=src.bytes.subarray(span.startByte,span.endByte);need(span.sha256===sha(bytes)&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===span.text&&typeof span.text==='string'&&span.text.trim(),'INSERTION_SPAN_BYTES','Span differs from source or splits UTF-8.');prior=span.startByte;
  }
  prior=0;
  for(const context of scope.contextSourceLocations){location(context,src,primary.path);need(context.startLine>prior&&context.startLine!==line,'INSERTION_CONTEXT_ORDER','Contexts are duplicated, self-linked or out of order.');prior=context.startLine;}
}
function transformEntry(entry,map,inverse){
  const data=mapData(map),from=inverse?data.current:data.base,to=inverse?data.base:data.current;scopeEntry(entry,from,data.specificationPath);
  const line=inverse?map.inverseLine:map.forwardLine;
  const anchor=value=>({...value,startLine:line(value.startLine),endLine:line(value.endLine)});
  const old=entry.atomicObligation;
  const scope={key:old.key,statement:old.statement,sourceSpans:old.sourceSpans.map(span=>{
    const mapped=inverse?[map.inverseByteRange(span.startByte,span.endByte)]:map.forwardByteRange(span.startByte,span.endByte);
    need(mapped.length===1,'INSERTION_PRIMARY_SPLIT','One original primary-line span cannot absorb an insertion.');return {...span,...mapped[0]};
  }),contextSourceLocations:old.contextSourceLocations.map(anchor)};
  scope.sha256=atomicObligationSha256(scope);
  // This is a scope-coordinate candidate, not an activated requirement or proof.
  const result={entryKind:'ATOMIC_OBLIGATION',sourceLocation:anchor(entry.sourceLocation),controllingText:entry.controllingText,atomicObligation:scope};scopeEntry(result,to,data.specificationPath);return result;
}
export function transportAtomicScopeCoordinates(entry,map){return transformEntry(entry,map,false);}
export function verifyAtomicScopeCoordinateTransport(prior,current,map){
  const data=mapData(map);scopeEntry(prior,data.base,data.specificationPath);scopeEntry(current,data.current,data.specificationPath);
  const expected=transformEntry(prior,map,false),inverse=transformEntry(current,map,true);
  need(equal(current.sourceLocation,expected.sourceLocation)&&current.controllingText===expected.controllingText&&equal(current.atomicObligation,expected.atomicObligation),'INSERTION_FORWARD_SCOPE','Current scope changes more than whitelisted coordinates.');
  need(equal(inverse.sourceLocation,prior.sourceLocation)&&inverse.controllingText===prior.controllingText&&equal(inverse.atomicObligation,prior.atomicObligation),'INSERTION_INVERSE_SCOPE','Inverse transport does not recover the complete original scope.');
  return Object.freeze({coordinateTransportVerified:true,priorScopeSha256:prior.atomicObligation.sha256,currentScopeSha256:current.atomicObligation.sha256,semanticImpactReviewed:false,identityRetentionAuthorized:false,implementationConformance:false});
}

// The graph inventories are reconciled against schema-specific actual references
// by the future integration. Reading through this object rejects undeclared
// consumption. Fingerprint exposure is blocked until EVERY inventory is checked.
export function validateImmutableEvidenceDag({roots,nodes},readFile=readAtomicEvidenceBytes){
  need(Array.isArray(roots)&&roots.length>0&&Array.isArray(nodes)&&nodes.length>0,'INSERTION_DAG_INVENTORY','Pinned roots and node inventories are required.');
  const refs=list=>{
    need(Array.isArray(list),'INSERTION_DAG_INPUTS','Input inventory must be an array.');const seen=new Set();
    return list.map(ref=>{keys(ref,['path','sha256'],'INSERTION_DAG_REF');need(isAtomicEvidencePath(ref.path)&&digest(ref.sha256)&&!seen.has(ref.path),'INSERTION_DAG_DUPLICATE','Invalid reference or duplicate declaration within one inventory.');seen.add(ref.path);return {path:ref.path,sha256:ref.sha256};});
  };
  const rootRefs=refs(roots),byPath=new Map();
  for(const node of nodes){keys(node,['path','sha256','inputs'],'INSERTION_DAG_NODE');need(isAtomicEvidencePath(node.path)&&digest(node.sha256)&&!byPath.has(node.path),'INSERTION_DAG_NODE_DUPLICATE','Duplicate/invalid node declaration.');byPath.set(node.path,{path:node.path,sha256:node.sha256,inputs:refs(node.inputs)});}
  const verified=new Map(),active=new Set(),reconciled=new Set(),consumed=new Set();
  const visit=ref=>{
    const node=byPath.get(ref.path);need(node,'INSERTION_DAG_MISSING','Referenced immutable node is undeclared.');need(node.sha256===ref.sha256,'INSERTION_DAG_CONFLICT','One path has conflicting digest declarations.');
    need(!active.has(node.path),'INSERTION_DAG_CYCLE','Dependency contains an active traversal cycle.');if(verified.has(node.path))return;
    active.add(node.path);const returned=readFile(node.path);need(Buffer.isBuffer(returned),'INSERTION_DAG_BYTES','Evidence reader must return exact bytes.');
    // Snapshot reader-owned bytes before any child callback can mutate them.
    const bytes=Buffer.from(returned);identity(bytes,node.sha256,'INSERTION_DAG_HASH');
    for(const child of node.inputs)visit(child);
    active.delete(node.path);verified.set(node.path,bytes);
  };
  for(const root of rootRefs)visit(root);
  need(verified.size===byPath.size,'INSERTION_DAG_UNREACHABLE','Unreachable declared nodes cannot masquerade as consumed closure.');
  const normalized=list=>list.map(ref=>({path:ref.path,sha256:ref.sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return Object.freeze({version:insertionDagVersion,
    readRequired(file){need(verified.has(file),'INSERTION_DAG_UNDECLARED_READ','Attempted to consume an undeclared dependency.');consumed.add(file);return Buffer.from(verified.get(file));},
    reconcileInventory(file,actualReferences){need(byPath.has(file),'INSERTION_DAG_UNDECLARED_INVENTORY','Unknown parent inventory.');const actual=refs(actualReferences);need(equal(normalized(actual),normalized(byPath.get(file).inputs)),'INSERTION_DAG_INVENTORY_MISMATCH','Declared graph differs from schema-specific actual references.');for(const ref of actual)need(byPath.get(ref.path)?.sha256===ref.sha256,'INSERTION_DAG_CONFLICT','Actual reference conflicts with declared bytes.');reconciled.add(file);},
    fingerprintReferences(){need(reconciled.size===byPath.size,'INSERTION_DAG_UNRECONCILED','Every node requires actual schema-specific dependency reconciliation, including leaves.');return normalized([...byPath.values()]);},
    consumedReferences(){return normalized([...consumed].map(file=>byPath.get(file)));}
  });
}

// Version 1 preserves the original atomic-only view. Version 2 additionally
// validates the original shared source-semantic/exclusion and line pipeline.
// Neither version composes a successor or renews proof.
export function loadValidatedInsertionAtomicBase(descriptor,{readFile=readAtomicEvidenceBytes}={}){
  const snapshot=JSON.parse(canonical(descriptor));
  keys(snapshot,['schema','source','specificationManifest','requirementEvidenceBindings','view'],'INSERTION_BASE_DESCRIPTOR');
  need(['closed-loop-insertion-atomic-base/1','closed-loop-insertion-atomic-base/2'].includes(snapshot.schema),'INSERTION_BASE_VERSION','Unknown original-base view version.');
  const roots=[snapshot.source,snapshot.specificationManifest,snapshot.requirementEvidenceBindings];
  const rootPaths=['specification/closed-loop-reliability-controlling-implementation-specification.txt','specification/closed-loop-specification-manifest.json','specification/requirement-evidence-bindings.json'];
  roots.forEach((ref,index)=>{keys(ref,['path','sha256'],'INSERTION_BASE_ROOT_FIELDS');need(ref.path===rootPaths[index]&&digest(ref.sha256),'INSERTION_BASE_ROOT','Original logical root identity is invalid.');});
  need(Array.isArray(snapshot.view)&&snapshot.view.length>=roots.length,'INSERTION_BASE_VIEW','Complete explicit logical-to-physical inventory required.');
  const logical=new Map(),physical=new Map();
  for(const item of snapshot.view){
    keys(item,['logicalPath','storagePath','sha256'],'INSERTION_BASE_VIEW_FIELDS');
    need(isAtomicEvidencePath(item.logicalPath)&&isAtomicEvidencePath(item.storagePath)&&digest(item.sha256),'INSERTION_BASE_VIEW_PATH','Invalid original logical/storage identity.');
    need(!logical.has(item.logicalPath),'INSERTION_BASE_DUPLICATE_LOGICAL','Duplicate logical declaration.');
    need(!physical.has(item.storagePath)||physical.get(item.storagePath)===item.sha256,'INSERTION_BASE_PHYSICAL_CONFLICT','Shared physical storage has conflicting digests.');
    logical.set(item.logicalPath,item);physical.set(item.storagePath,item.sha256);
  }
  for(const item of logical.values()){
    const target=logical.get(item.storagePath);
    need(!target||target.storagePath===item.storagePath,'INSERTION_BASE_ALIAS_CHAIN','Storage paths name physical bytes, never another remapped logical alias.');
    if(target)need(target.sha256===item.sha256,'INSERTION_BASE_ALIAS_CONFLICT','Logical/physical identity conflicts at one path.');
  }
  for(const ref of roots)need(logical.get(ref.path)?.sha256===ref.sha256,'INSERTION_BASE_ROOT_VIEW','Pinned original root is absent from the view.');
  const buffers=new Map();
  for(const [file,expected] of physical){
    const returned=readFile(file);need(Buffer.isBuffer(returned),'INSERTION_BASE_BYTES','Physical reader must return exact bytes.');
    const bytes=Buffer.from(returned);identity(bytes,expected,'INSERTION_BASE_PHYSICAL_HASH');buffers.set(file,bytes);
  }
  const consumed=new Set();
  const readOriginal=file=>{
    const item=logical.get(file);need(item,'INSERTION_BASE_UNDECLARED_READ','Original loader consumed an undeclared logical dependency.');
    consumed.add(file);return Buffer.from(buffers.get(item.storagePath));
  };
  const bytes=readOriginal(snapshot.source.path),original=source(bytes),manifest=JSON.parse(readOriginal(snapshot.specificationManifest.path)),bindings=JSON.parse(readOriginal(snapshot.requirementEvidenceBindings.path));
  need(manifest.schema==='closed-loop-specification-manifest/1'&&manifest.repositoryPath===snapshot.source.path&&manifest.sha256===snapshot.source.sha256&&manifest.byteLength===bytes.length&&manifest.physicalLineCount===original.lines.length&&manifest.logicalLineCount===original.lines.length+1&&/^[0-9a-f]{40}$/.test(manifest.sourceCommit??''),'INSERTION_BASE_SOURCE_METADATA','Pinned original specification manifest differs from exact original source.');
  const sections=manifest.sectionInventory;
  need(Array.isArray(sections)&&sections.length>0,'INSERTION_BASE_SECTIONS','Original pinned section inventory is absent.');
  const sectionIds=new Set();let last=0;
  for(const section of sections){
    need(typeof section.sectionId==='string'&&section.sectionId.length>0&&!sectionIds.has(section.sectionId)&&Number.isSafeInteger(section.startLine)&&Number.isSafeInteger(section.endLine)&&section.startLine>last&&section.endLine>=section.startLine&&section.endLine<=manifest.logicalLineCount,'INSERTION_BASE_SECTIONS','Original section inventory is invalid.');
    sectionIds.add(section.sectionId);last=section.endLine;
  }
  need(bindings.schema==='closed-loop-requirement-evidence-bindings/1'&&bindings.specificationSha256===snapshot.source.sha256,'INSERTION_BASE_BINDINGS','Pinned original bindings differ from original source.');
  const semanticReferences=[];
  const typed=ref=>{need(ref&&isAtomicEvidencePath(ref.path)&&digest(ref.sha256)&&logical.get(ref.path)?.sha256===ref.sha256,'INSERTION_BASE_SEMANTIC_REFERENCE','Original typed semantic dependency differs from pinned view.');semanticReferences.push({path:ref.path,sha256:ref.sha256});};
  const semanticState=snapshot.schema==='closed-loop-insertion-atomic-base/2'?prepareOriginalSourceSemantics({bytes,manifest,bindings,specificationPath:snapshot.source.path,readOriginal,typed}):null;
  // Immutable predecessor custody cannot recursively activate a successor.
  need(bindings.atomicExtraction?.schema!=='closed-loop-approved-insertion-atomic-extraction/1','INSERTION_BASE_CONTINUATION_FORBIDDEN','The archived base must use the unchanged ordinary atomic loader.');
  // The descriptor cannot replace atomicExtraction, sections or source traces.
  const base=loadReviewedAtomicExtraction(bindings.atomicExtraction,{sourceBytes:bytes,specificationPath:snapshot.source.path,sections,priorRequirements:semanticState?.sourceRows??null,readFile:readOriginal});
  need(base.established===true,'INSERTION_BASE_PENDING','Missing or pending original atomic evidence does not establish a base.');
  const semanticFacts=semanticState?finishOriginalSourceSemantics(semanticState,base,bytes,snapshot.source.path,manifest):null;
  const references=atomicEvidenceReferences(bindings.atomicExtraction,readOriginal),expected=new Map();
  for(const ref of [...roots,...references,...semanticReferences]){
    need(!expected.has(ref.path)||expected.get(ref.path)===ref.sha256,'INSERTION_BASE_LOGICAL_CONFLICT','Original roots/dependencies conflict at one logical path.');
    need(logical.get(ref.path)?.sha256===ref.sha256,'INSERTION_BASE_REFERENCE','Typed original dependency differs from pinned view.');expected.set(ref.path,ref.sha256);
  }
  need(expected.size===logical.size&&[...logical.keys()].every(file=>expected.has(file)),'INSERTION_BASE_CLOSURE','View contains an undeclared or unused logical node.');
  need(consumed.size===expected.size&&[...consumed].every(file=>expected.has(file)),'INSERTION_BASE_READ_SET','Actual reads and typed original dependency closure differ.');
  const logicalReferences=[...expected].map(([path,sha256])=>({path,sha256})),physicalReferences=[...physical].map(([path,sha256])=>({path,sha256}));
  return Object.freeze({schema:'closed-loop-validated-insertion-atomic-base/1',baseAtomicValidated:true,successorEstablished:false,semanticDeltaValidated:false,identityRetentionAuthorized:false,productionFingerprintIntegrated:false,sourceSemanticValidated:Boolean(semanticFacts),lineMembershipMaterialized:Boolean(semanticFacts),
    viewIdentitySha256:sha(Buffer.from(canonical(snapshot))),sourceSha256:snapshot.source.sha256,entryCount:base.entries.length,
    // The exact view identity and actual archived byte references must be bound
    // by future production fingerprint integration; this function supplies none.
    dependencyIdentity(){return structuredClone({view:snapshot,logicalReferences,physicalReferences});},
    baseData(){return structuredClone(base);},
    originalSemanticFacts(){return structuredClone(semanticFacts);},
    originalSource(){return Buffer.from(bytes);},
    originalSections(){return structuredClone(sections);},
    readOriginalFile(file){return readOriginal(file);}
  });
}

// Version 2 validates the original unamended source pipeline. It deliberately
// cannot supply successor interpretation, current identities or renewed proof.
function prepareOriginalSourceSemantics({bytes,manifest,bindings,specificationPath,readOriginal,typed}){
  const H=globalThis.closedLoopHash,lines=validateSpecificationSource(bytes,manifest,manifest.sourceCommit).split('\n'),sourceSha256=sha(bytes);
  const canon=record=>{const value={...record};delete value.manifestSha256;need(record.manifestSha256===H.sha256Value(value),'INSERTION_BASE_CANONICAL','Original manifest canonical digest differs.');};
  canon(manifest);
  need((bindings.approvedClarifications||[]).length===0&&(bindings.approvedAmendments||[]).length===0,'INSERTION_BASE_ORIGINAL_RANGES','This original-base semantic version requires the pinned unamended original pipeline.');
  const load=ref=>{typed(ref);const data=readOriginal(ref.path);identity(data,ref.sha256,'INSERTION_BASE_SEMANTIC_HASH');return {bytes:data,value:JSON.parse(data)};};
  need(manifest.normativeRequirementManifestPath==='specification/closed-loop-normative-requirements.json','INSERTION_BASE_NORMATIVE_PATH','Original normative root path differs.');
  const normative=load({path:manifest.normativeRequirementManifestPath,sha256:manifest.normativeRequirementManifestSha256}).value;canon(normative);
  need(normative.schema==='closed-loop-normative-requirements/1'&&normative.specificationPath===specificationPath&&normative.specificationSha256===sourceSha256&&normative.specificationByteLength===bytes.length&&normative.sourceCommit===manifest.sourceCommit&&normative.manifestIdentity===manifest.normativeRequirementManifestIdentity&&normative.manifestSha256===manifest.normativeRequirementManifestCanonicalSha256&&normative.generatorVersion===manifest.generatorVersion&&manifest.generatorVersion==='closed-loop-governance-generator/11'&&normative.contractProfileId===manifest.contractProfileId&&manifest.contractProfileId==='closed-loop-completion-profile/1','INSERTION_BASE_NORMATIVE_BINDING','Original normative/specification roots do not cross-bind.');
  const clauseRef=normative.omissionChallenge?.sourceClauseReview;
  need(clauseRef?.path==='specification/source-clause-review.json','INSERTION_BASE_CLAUSE_PATH','Original clause-review root is absent or unexpected.');
  const clauseReview=load({path:clauseRef.path,sha256:clauseRef.sha256}).value;
  const independentDeclaration=bindings.independentSourceReview;
  need(independentDeclaration,'INSERTION_BASE_SEMANTIC_DECLARATION','Original independent source declaration absent.');
  const semanticReview=load({path:independentDeclaration.sourceReviewPath,sha256:independentDeclaration.sourceReviewSha256}).value;
  const semanticReconciliation=load({path:independentDeclaration.reconciliationPath,sha256:independentDeclaration.reconciliationSha256}).value;
  need(semanticReconciliation.sourceReviewPath===independentDeclaration.sourceReviewPath,'INSERTION_BASE_SEMANTIC_REVIEW_PATH','Original reconciliation names a different source review.');
  const relativeRef=(base,ref)=>({path:path.posix.normalize(path.posix.join(path.posix.dirname(base),ref.path)),sha256:ref.sha256});
  const frozen=semanticReconciliation.frozenExtractionInputs||[],seen=new Set();
  for(const ref of frozen){const resolved=relativeRef(independentDeclaration.reconciliationPath,ref);need(!seen.has(resolved.path),'INSERTION_BASE_SEMANTIC_DUPLICATE','Duplicate frozen extraction declaration.');seen.add(resolved.path);load(resolved);}
  const normalization=semanticReview.normalizationProvenance;
  if(normalization?.frozenSourceReviewPath)load(relativeRef(independentDeclaration.sourceReviewPath,{path:normalization.frozenSourceReviewPath,sha256:normalization.frozenSourceReviewSha256}));
  // The original mechanical scanner is replayed in memory, without claiming a
  // new independent source review or reading the live source outside the view.
  const B=reviewSpecificationCoverageBytes(bytes,specificationPath),sections=B.sectionInventory;
  need(canonical(sections)===canonical(manifest.sectionInventory.map(({sectionId,title,startLine,endLine})=>({sectionId,...(title!==undefined?{title}:{}),startLine,endLine}))),'INSERTION_BASE_SECTION_SOURCE','Original section coordinates/titles differ from the source scanner.');
  const start=new Map(sections.map(x=>[x.startLine,x])),at=[];let cur=null;for(let n=1;n<=lines.length;n++){cur=start.get(n)||cur;at[n]=cur;}
  const A=generatorMechanicalCandidates(lines,start,at),by=mergeGeneratorMechanicalCandidates(A,B),reviewedLines=applyGeneratorSourceClauses(clauseReview,sourceSha256,lines,at,by);
  const clarificationLines=new Map,amendmentLines=new Map,approvedAmendmentClassification=()=>null;
  const requirementIdentity=x=>'NREQ-'+H.sha256Text(H.stableStringify({sourceSha256,line:x.line,lineSha256:x.lineSha256})).slice(0,32);
  const logicalFile=file=>{const logical=path.relative(process.cwd(),file).split(path.sep).join('/');need(isAtomicEvidencePath(logical),'INSERTION_BASE_EXCLUSION_PATH','Original exclusion dependency escapes first-party logical custody.');return logical;};
  const exclusionOptions={readFile:file=>readOriginal(logicalFile(file)),onRead:ref=>typed({path:logicalFile(ref.path),sha256:ref.sha256})};
  const state=applyGeneratorSourceSemantics({semanticReview,semanticReconciliation,independentDeclaration,sourceSha256,bytes,lines,by,clarificationLines,amendmentLines,approvedAmendmentClassification,requirementIdentity,reviewedLines,at,exclusionOptions});
  const sourceRows=[...by.values()].sort((a,b)=>a.line-b.line).map(x=>({normativeRequirementId:requirementIdentity(x),sectionId:x.sectionId,sourceLocation:{path:specificationPath,startLine:x.line,endLine:x.line,lineSha256:x.lineSha256},controllingText:x.text,...(state.sourceReviewAddedLines.has(x.line)?{sourceReviewAdded:true}:{})}));
  validateGeneratorMandatorySourceTraces(sourceRows,state.reviewedExclusions,semanticReconciliation);
  const ids=new Set(sourceRows.map(row=>row.normativeRequirementId));need(ids.size===sourceRows.length,'INSERTION_BASE_TRACE_DUPLICATE','Original regenerated source trace repeats an identity.');
  validateGeneratorSemanticTraceReferences(ids,state.observationResolutions,state.semanticSourceLines);
  const coverageArguments={lines,at,start,clarificationLines,amendmentLines,approvedAmendmentClassification,semanticSourceLines:state.semanticSourceLines,independentDeclaration};
  const {coverage:sourceCoverage}=materializeGeneratorSourceCoverage({req:sourceRows,...coverageArguments});validateGeneratorResolvedSourceCoverage(sourceCoverage);
  const sourceLines=new Set(sourceRows.map(row=>row.sourceLocation.startLine));
  need(B.candidateLines.every(row=>sourceLines.has(row.line)||state.excludedCandidateLines.has(row.line)),'INSERTION_BASE_REVIEWER_OMISSION','Original reviewer candidate omitted from reconciled traces.');
  return {normative,sourceRows,sourceCoverage,coverageArguments,sections,semanticReview,semanticReconciliation,independentDeclaration,clauseRef,reviewedExclusions:state.reviewedExclusions};
}
function finishOriginalSourceSemantics(state,base,bytes,specificationPath,manifest){
  const {normative,sourceRows,sourceCoverage,coverageArguments,sections,independentDeclaration,semanticReconciliation,clauseRef}=state;
  const priorCanonical={...base.sourcePrior};delete priorCanonical.manifestSha256;
  need(base.sourcePrior.manifestSha256===globalThis.closedLoopHash.sha256Value(priorCanonical),'INSERTION_BASE_SOURCE_TRACE_CANONICAL','Pinned original source trace canonical digest differs.');
  need(base.sourcePrior.requirements.every((row,index)=>Boolean(row.sourceReviewAdded)===Boolean(sourceRows[index]?.sourceReviewAdded)),'INSERTION_BASE_SOURCE_ADDITION','Pinned original source trace misreports an independent addition.');
  const coverageIdentity=rows=>rows.map(({line,sectionId,status,normativeRequirementIds,lineSha256})=>({line,sectionId,status,normativeRequirementIds,lineSha256}));
  need(Array.isArray(base.sourcePrior.sourceLineCoverage)&&canonical(coverageIdentity(base.sourcePrior.sourceLineCoverage))===canonical(coverageIdentity(sourceCoverage)),'INSERTION_BASE_SOURCE_TRACE_COVERAGE','Pinned original source-trace line membership/classification differs from shared source materialization.');
  need(Array.isArray(normative.requirements)&&normative.requirements.length===base.entries.length,'INSERTION_BASE_NORMATIVE_POPULATION','Pinned normative atomic population differs.');
  const entries=new Map(normative.requirements.map(row=>[row.normativeRequirementId,row]));
  need(entries.size===base.entries.length,'INSERTION_BASE_NORMATIVE_POPULATION','Pinned normative identities repeat.');
  for(const original of base.entries){const current=entries.get(original.normativeRequirementId);need(current&&Object.keys(original).every(key=>canonical(current[key])===canonical(original[key])),'INSERTION_BASE_NORMATIVE_ENTRY','Pinned normative entry differs from unchanged original loader.');}
  const projected=projectAtomicSectionInventory(sections,base.reconciliation.sections);
  need(canonical(manifest.sectionInventory)===canonical(projected)&&canonical(normative.sectionInventory)===canonical(projected),'INSERTION_BASE_ATOMIC_SECTIONS','Pinned atomic section coverage differs from its reviewed projection.');
  const {reqLine,coverage}=materializeGeneratorSourceCoverage({req:base.entries,...coverageArguments});
  materializeGeneratorAtomicMembership(base.entries,coverage,bytes,specificationPath,sections,reqLine);validateGeneratorResolvedSourceCoverage(coverage);
  validateAtomicLineMembership(normative.requirements,normative.sourceLineCoverage,bytes,specificationPath,sections);
  need(canonical(coverageIdentity(normative.sourceLineCoverage))===canonical(coverageIdentity(coverage)),'INSERTION_BASE_ATOMIC_COVERAGE','Pinned atomic line classification differs from original materialization.');
  const omission=normative.omissionChallenge;
  need(omission&&Object.entries(independentDeclaration).every(([key,value])=>omission.independentSourceReview?.[key]===value)&&omission.sourceClauseReview?.sha256===clauseRef.sha256&&canonical(omission.unresolvedContractFindings||[])===canonical(semanticReconciliation.unresolvedContractFindings||[])&&omission.contractAcceptanceStatus===(semanticReconciliation.contractAcceptanceStatus||'NOT_ESTABLISHED'),'INSERTION_BASE_SEMANTIC_MANIFEST','Pinned normative review/source findings do not retain the exact original declaration.');
  const summary=sourceInventorySummary(normative.requirements);
  need(Object.entries(summary).every(([key,value])=>manifest[key]===value&&normative[key]===value),'INSERTION_BASE_COUNTS','Pinned manifest populations differ from validated original entries.');
  need(canonical(omission.reconciliationEvidence?.reviewedMechanicalCandidateExclusions||[])===canonical(state.reviewedExclusions.exclusions)&&canonical(omission.reconciliationEvidence?.mandatoryPreservedSourceLines||[])===canonical(state.reviewedExclusions.mandatoryPreservedLines),'INSERTION_BASE_EXCLUSION_MANIFEST','Pinned manifest exclusion/preservation inventory differs.');
  return {sourceTraceCount:sourceRows.length,sourceLineCount:sourceCoverage.length,atomicLineCount:coverage.length,sourceContractFindings:structuredClone(semanticReconciliation.unresolvedContractFindings||[]),originalSourceTrace:structuredClone(sourceRows),originalSourceLineCoverage:structuredClone(sourceCoverage),originalAtomicLineCoverage:structuredClone(coverage)};
}

// Versioned, inactive base-plus-source-delta composition. The ordinary atomic
// loader and its identity birth rules are not used to relabel old reviewers.
export const insertionCompositionVersion='closed-loop-approved-insertion-atomic-continuation/1';
const valueSha=value=>sha(Buffer.from(canonical(value)));
const nreq=value=>typeof value==='string'&&/^NREQ-[0-9a-f]{32}$/.test(value);
const nonblank=value=>typeof value==='string'&&value.trim().length>0;
function pointerValue(value,pointer){
  need(typeof pointer==='string'&&(pointer===''||pointer.startsWith('/')),'INSERTION_DELTA_POINTER','Invalid evidence pointer.');
  for(const part of pointer.slice(1).split('/')){if(pointer==='')break;const key=part.replaceAll('~1','/').replaceAll('~0','~');need(value!==null&&typeof value==='object'&&Object.hasOwn(value,key),'INSERTION_DELTA_POINTER','Evidence pointer is absent.');value=value[key];}
  return value;
}
function compositionCustody(view,baseView,base,readFile){
  need(Array.isArray(view)&&Array.isArray(baseView),'INSERTION_DELTA_VIEW','Explicit provenance-to-custody inventories required.');
  const declarations=new Map(),physical=new Map(),cache=new Map(),used=new Set(),parsed=new Map(),baseBuffers=new Map();
  for(const item of view){
    keys(item,['provenancePath','storagePath','sha256'],'INSERTION_DELTA_VIEW_FIELDS');
    need(nonblank(item.provenancePath)&&isAtomicEvidencePath(item.storagePath)&&digest(item.sha256)&&!declarations.has(item.provenancePath),'INSERTION_DELTA_VIEW_PATH','Duplicate or unsafe custody declaration.');
    need(!physical.has(item.storagePath)||physical.get(item.storagePath)===item.sha256,'INSERTION_DELTA_ALIAS_CONFLICT','Physical aliases disagree.');
    declarations.set(item.provenancePath,{...item,kind:'STORAGE'});physical.set(item.storagePath,item.sha256);
  }
  const basePins=new Map(base.dependencyIdentity().logicalReferences.map(ref=>[ref.path,ref.sha256]));
  for(const item of baseView){
    keys(item,['provenancePath','logicalPath','sha256'],'INSERTION_DELTA_BASE_VIEW_FIELDS');
    need(nonblank(item.provenancePath)&&!declarations.has(item.provenancePath)&&basePins.get(item.logicalPath)===item.sha256,'INSERTION_DELTA_BASE_VIEW','Base alias is absent, conflicting or duplicated.');
    declarations.set(item.provenancePath,{...item,kind:'BASE'});
  }
  for(const item of declarations.values())if(item.kind==='STORAGE'){
    const target=declarations.get(item.storagePath);
    need(!target||target.kind==='STORAGE'&&target.storagePath===item.storagePath&&target.sha256===item.sha256,'INSERTION_DELTA_ALIAS_CHAIN','Physical storage cannot alias another logical custody entry.');
  }
  for(const [file,expected] of physical){const returned=readFile(file);need(Buffer.isBuffer(returned),'INSERTION_DELTA_BYTES','Custody reader must return Buffer.');const bytes=Buffer.from(returned);identity(bytes,expected,'INSERTION_DELTA_HASH');cache.set(file,bytes);}
  // JSON stays inside this custody owner; only public byte reads need copies.
  const resolve=ref=>{
    need(ref&&nonblank(ref.path)&&digest(ref.sha256),'INSERTION_DELTA_REFERENCE','Exact source-evidence reference required.');
    const item=declarations.get(ref.path);need(item&&item.sha256===ref.sha256,'INSERTION_DELTA_UNDECLARED','Missing or conflicting provenance/custody identity.');
    if(item.kind==='BASE'&&!baseBuffers.has(item.logicalPath)){
      // The base owner already holds an immutable, hash-validated snapshot.
      // Keep one private copy per exact logical identity for this invocation.
      const returned=base.readOriginalFile(item.logicalPath);need(Buffer.isBuffer(returned),'INSERTION_DELTA_BYTES','Base custody reader must return Buffer.');
      const bytes=Buffer.from(returned);identity(bytes,item.sha256,'INSERTION_DELTA_HASH');baseBuffers.set(item.logicalPath,bytes);
    }
    const bytes=item.kind==='BASE'?baseBuffers.get(item.logicalPath):cache.get(item.storagePath);
    need(ref.byteLength===undefined||ref.byteLength===bytes.length,'INSERTION_DELTA_LENGTH','Evidence byte length differs.');used.add(ref.path);return bytes;
  };
  const read=ref=>Buffer.from(resolve(ref));
  const json=ref=>{const bytes=resolve(ref);if(!parsed.has(ref.path))parsed.set(ref.path,JSON.parse(bytes.toString('utf8')));return parsed.get(ref.path);};
  return {read,json,selected(ref,pointer){return pointerValue(json(ref),pointer);},pins(){return [...used].sort().map(file=>{const item=declarations.get(file);return {provenancePath:file,sha256:item.sha256,...(item.kind==='BASE'?{logicalPath:item.logicalPath}:{storagePath:item.storagePath})};});},assertClosure(){if(used.size!==declarations.size){const error=new Error('INSERTION_DELTA_UNUSED_CUSTODY: Declared custody contains unconsumed evidence.');error.code='INSERTION_DELTA_UNUSED_CUSTODY';error.actualLogicalReadPins=[...used].sort().map(file=>{const item=declarations.get(file);return {provenancePath:file,sha256:item.sha256,...(item.kind==='BASE'?{logicalPath:item.logicalPath}:{storagePath:item.storagePath})};});throw error;}}};
}
function sourcePassage(ref,map){
  need(ref&&typeof ref==='object','INSERTION_DELTA_SOURCE_REFERENCE','Source occurrence required.');
  const {base,current}=mapData(map),role=ref.role??ref.sourceRole;
  const isBase=role==='BASE_SOURCE'||role==='BASE',src=isBase?base:current,expected=isBase?map.baseSha256:map.currentSha256;
  need(isBase||role==='SUCCESSOR_SOURCE'||role==='SUCCESSOR','INSERTION_DELTA_SOURCE_ROLE','Source role must be explicit.');
  need(ref.sourceSha256===undefined||ref.sourceSha256===expected,'INSERTION_DELTA_SOURCE_IDENTITY','Source occurrence has another source identity.');
  const a=ref.startLine,b=ref.endLine;need(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>=1&&a<=b&&b<=src.lines.length,'INSERTION_DELTA_SOURCE_RANGE','Occurrence line range is outside the physical source.');
  const raw=src.lines.slice(a-1,b),hashes=raw.map(line=>sha(Buffer.from(line)));
  if(ref.lineSha256!==undefined)need(equal(ref.lineSha256,a===b?hashes[0]:hashes),'INSERTION_DELTA_SOURCE_LINES','Exact line digest differs.');
  let startByte=src.starts[a-1],endByte=src.starts[b-1]+Buffer.byteLength(src.lines[b-1]);
  if(ref.startByte!==undefined||ref.endByte!==undefined){
    need(integer(ref.startByte)&&integer(ref.endByte)&&ref.startByte===startByte&&(ref.endByte===endByte||ref.endByte===endByte+1),'INSERTION_DELTA_SOURCE_BYTES','Source passage byte boundaries differ.');startByte=ref.startByte;endByte=ref.endByte;
    if(ref.sha256!==undefined)need(ref.sha256===sha(src.bytes.subarray(startByte,endByte)),'INSERTION_DELTA_SOURCE_HASH','Passage digest differs.');
    if(ref.text!==undefined)need(ref.text===src.bytes.subarray(startByte,endByte).toString('utf8'),'INSERTION_DELTA_SOURCE_TEXT','Passage text differs.');
  }
  // The original validators permit controllingText.trim(); lineSha256 always
  // binds the untrimmed line. Preserve supplied text rather than restamping it.
  if(ref.controllingText!==undefined)need(ref.controllingText===raw.join('\n')||ref.controllingText===raw.join('\n').trim(),'INSERTION_DELTA_SOURCE_TEXT','Controlling text differs.');
  return {role:isBase?'BASE_SOURCE':'SUCCESSOR_SOURCE',sourceSha256:expected,startLine:a,endLine:b,startByte,endByte,lineSha256:hashes,originalRecord:structuredClone(ref)};
}
function exactOccurrenceTransport(entry,bindings,occurrences,map){
  need(Array.isArray(bindings)&&bindings.length>0,'INSERTION_DELTA_OCCURRENCES','Original occurrence inventory is missing.');
  const seen=new Set(),result=[];
  for(const binding of bindings){
    keys(binding,['entryJsonPointer','occurrenceId'],'INSERTION_DELTA_OCCURRENCE_BINDING');need(!seen.has(binding.entryJsonPointer),'INSERTION_DELTA_OCCURRENCE_DUPLICATE','One original pointer has multiple occurrence bindings.');seen.add(binding.entryJsonPointer);
    const value=pointerValue(entry,binding.entryJsonPointer),occurrence=occurrences.get(binding.occurrenceId);need(occurrence,'INSERTION_DELTA_OCCURRENCE_MISSING','Bound occurrence is missing.');
    if(occurrence.kind==='LINES'){
      const a=Array.isArray(value)?value[0]:value.startLine,b=Array.isArray(value)?value[1]:value.endLine;
      need(a===occurrence.baseStartLine&&b===occurrence.baseEndLine,'INSERTION_DELTA_OCCURRENCE_POINTER','Line occurrence does not name its original pointer.');
      const fragments=map.forwardLineRange(a,b),{base,current}=mapData(map);let old=a;
      const checked=fragments.map(([startLine,endLine])=>{const count=endLine-startLine+1,oldEnd=old+count-1,raw=base.lines.slice(old-1,oldEnd).join('\n');need(raw===current.lines.slice(startLine-1,endLine).join('\n'),'INSERTION_DELTA_OCCURRENCE_BYTES','Transport changes original line bytes.');const fragment={baseStartLine:old,baseEndLine:oldEnd,successorStartLine:startLine,successorEndLine:endLine,lineCount:count,sha256:sha(Buffer.from(raw))};old=oldEnd+1;return fragment;});
      need(occurrence.baseContentSha256===sha(Buffer.from(base.lines.slice(a-1,b).join('\n')))&&equal(checked,occurrence.successorFragments)&&occurrence.insertedOccurrencesIncluded===false,'INSERTION_DELTA_OCCURRENCE_FRAGMENTS','Range transport absorbs inserted lines or changes occurrence multiplicity.');
      result.push({...binding,kind:'LINES',originalValue:structuredClone(value),fragments:checked});
    }else{
      need(occurrence.kind==='BYTES','INSERTION_DELTA_OCCURRENCE_KIND','Unknown occurrence kind.');
      const a=value.startByte,b=value.endByte;need(a===occurrence.baseStartByte&&b===occurrence.baseEndByte,'INSERTION_DELTA_OCCURRENCE_POINTER','Byte occurrence does not name its original pointer.');
      const fragments=map.forwardByteRange(a,b),{base,current}=mapData(map);let offset=a;const checked=fragments.map(fragment=>{const size=fragment.endByte-fragment.startByte,originalBytes=base.bytes.subarray(offset,offset+size);need(originalBytes.equals(current.bytes.subarray(fragment.startByte,fragment.endByte)),'INSERTION_DELTA_OCCURRENCE_BYTES','Transport changes original byte span.');const next={baseStartByte:offset,baseEndByte:offset+size,successorStartByte:fragment.startByte,successorEndByte:fragment.endByte,sha256:sha(originalBytes)};offset+=size;return next;});need(equal(checked,occurrence.successorFragments)&&occurrence.baseContentSha256===sha(base.bytes.subarray(a,b))&&occurrence.insertedOccurrencesIncluded===false,'INSERTION_DELTA_OCCURRENCE_FRAGMENTS','Byte occurrence transport differs.');result.push({...binding,kind:'BYTES',originalValue:structuredClone(value),fragments:checked});
    }
  }
  // The closed original scope supplies the authoritative required pointers.
  const required=[];
  const visit=(value,pointer)=>{if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&'startLine' in value&&'endLine' in value&&'path' in value)required.push(pointer);if(!Array.isArray(value)&&['startByte','endByte','text','sha256'].every(key=>key in value))required.push(pointer);for(const [key,child] of Object.entries(value)){if(key==='birthIdentity')continue;if(key==='governingSourceRanges'){child.forEach((_,i)=>required.push(pointer+'/'+key+'/'+i));continue;}visit(child,pointer+'/'+key.replaceAll('~','~0').replaceAll('/','~1'));}};visit(entry,'');
  need(required.every(p=>seen.has(p))&&required.length===seen.size,'INSERTION_DELTA_OCCURRENCE_COVERAGE','Original scope occurrence coverage is incomplete or invented.');return result;
}
function verifiedNewIdentity(row,currentSha){
  const original=structuredClone(row);for(const key of ['normativeRequirementId','identityPreimageSha256','identityStatus','originalReviewInheritance'])delete original[key];
  const preimage={version:'closed-loop-v4-source-reconciliation-new-identity/1',sourceSha256:currentSha,kind:row.entryKind,sourceSemanticEntry:original},birth=valueSha(preimage);
  need(row.normativeRequirementId==='NREQ-'+birth.slice(0,32),'INSERTION_DELTA_NEW_ID','New source duty birth identity differs.');
  // The frozen writer computed its named digest after adding the issued ID.
  const historicalPostId=valueSha({...preimage,sourceSemanticEntry:{...original,normativeRequirementId:row.normativeRequirementId}});
  need(row.identityPreimageSha256===historicalPostId&&row.originalReviewInheritance===false&&row.proofInheritance===false,'INSERTION_DELTA_NEW_PREIMAGE','Frozen birth/post-ID history or inheritance differs.');
  return {scheme:preimage.version,birthPreimage:preimage,birthPreimageSha256:birth,historicalPostIdDigest:historicalPostId};
}
function verifiedContextAlias(row,currentSha){
  const original=structuredClone(row);for(const key of ['sourceContextIdentity','identityStatus','originalReviewInheritance'])delete original[key];
  const birthPreimage={version:'closed-loop-v4-source-reconciliation-context-identity/1',sourceSha256:currentSha,contextEntry:original},birth=valueSha(birthPreimage);
  need(row.sourceContextIdentity==='CTX-'+birth.slice(0,32)&&row.originalReviewInheritance===false&&row.proofInheritance===false,'INSERTION_DELTA_CONTEXT_ID','Context source identity/history differs.');
  const aliasPayload={schema:'closed-loop-insertion-context-row-alias/1',sourceSha256:currentSha,sourceContextIdentity:row.sourceContextIdentity,sourceIdentityPreimageSha256:birth};
  return {normativeRequirementId:'NREQ-'+valueSha(aliasPayload).slice(0,32),birthPreimage,birthPreimageSha256:birth,aliasPayload};
}
function oneRef(list,suffix,required=true){const found=(list||[]).filter(ref=>ref.path?.endsWith('/'+suffix));need(found.length===(required?1:Math.min(found.length,1)),'INSERTION_DELTA_ARTIFACT_ROLE','Missing or ambiguous typed artifact '+suffix);return found[0];}
function sameRef(a,b){return a?.path===b?.path&&a?.sha256===b?.sha256;}
function reviewInput(ref,custody){const row=custody.json(ref);need(row&&typeof row==='object'&&!Array.isArray(row),'INSERTION_DELTA_REVIEW_RECORD','Review record required.');return row;}
function semanticPreId(row,context=false){const copy=structuredClone(row);for(const key of context?['sourceContextIdentity','identityStatus','originalReviewInheritance']:['normativeRequirementId','identityPreimageSha256','identityStatus','originalReviewInheritance'])delete copy[key];return copy;}
const mappedBlockers=xs=>(xs??[]).map(x=>x==='COUNT-BLOCK-DECODER'?'SRC-GAP-DECODER-SUBSET':x);
function validateCandidateTargets(decision,candidate,duties,contexts,custody,reconciliation){
  const dutyOnly=['ACCEPTED_SOURCE_DUTY','MERGED_EQUIVALENT_CANDIDATE','ACCEPTED_DISTINCT_SOURCE_DUTY','SPLIT_SOURCE_DUTIES','ACCEPTED_WITH_CONTEXTUAL_CORRECTION','COVERED_BY_DISTINCT_SOURCE_DUTIES'];
  const contextOnly=['REPRESENTED_AS_SCOPE_OR_PROVENANCE_CONTEXT','REPRESENTED_AS_GOVERNING_CONTEXT'];
  if(decision.countingDecision){
    need(sameRef(decision.countingDecision,reconciliation.countingAdjudication),'INSERTION_DELTA_CANDIDATE_DECISION','Counting mapping lacks frozen adjudication.');
    const m=custody.selected(decision.countingDecision,decision.countingDecision.jsonPointer);
    need(['MERGED','EQUIVALENT','SPLIT','UNSUPPORTED'].includes(m.decision)&&m.decision===decision.disposition&&m.candidateId===candidate.localId&&m.candidateStatement===candidate.statement&&m.candidatePointer?.jsonPointer===decision.candidate.jsonPointer&&(m.origin==='DRAFT'?'AUTHOR':'REVIEWER')===decision.candidate.inputRole&&equal(decision.canonicalIds,[...m.canonicalIds,...m.contextIds])&&m.canonicalIds.every(id=>duties.has(id))&&m.contextIds.every(id=>contexts.has(id))&&m.rationale===decision.reason&&equal(mappedBlockers(m.blockerIds),decision.unresolvedSourceEffects??[]),'INSERTION_DELTA_CANDIDATE_DECISION','Counting disposition, candidate, target kind or qualifiers differ.');
  }else need(dutyOnly.includes(decision.disposition)?decision.canonicalIds.every(id=>duties.has(id)):contextOnly.includes(decision.disposition)&&decision.canonicalIds.every(id=>contexts.has(id)),'INSERTION_DELTA_CANDIDATE_TARGET_KIND','Unknown disposition or incorrect duty/context target kind.');
  need(decision.sourceDecisionId==='LINE-'+candidate.primarySourceLocation.startLine,'INSERTION_DELTA_CANDIDATE_LINE','Candidate decision does not name its exact primary line.');
}
function validateCanonicalAmendmentPayloads(duties,contexts,{draft,review,reconciliation,candidateLinks,contextDecisions,custody,map,lineMap}){
  const roleDoc=role=>role==='AUTHOR'?draft:role==='REVIEWER'?review:null;
  for(const row of duties){
    const actual=semanticPreId(row);let expected;
    if(row.sourceDecision){
      need(sameRef(row.sourceDecision,reconciliation.countingAdjudication)&&/^\/canonicalObligations\/\d+$/.test(row.sourceDecision.jsonPointer),'INSERTION_DELTA_CANONICAL_AUTHORITY','Canonical duty names another adjudication/role.');
      const selected=structuredClone(custody.selected(row.sourceDecision,row.sourceDecision.jsonPointer));expected={...selected};expected.canonicalId=expected.localId;delete expected.localId;expected.entryKind='ATOMIC_OBLIGATION';expected.unresolvedSourceEffects=mappedBlockers(expected.blockerIds);delete expected.blockerIds;expected.sourceStatus=expected.unresolvedSourceEffects.length?'DETERMINATE_DUTY_WITH_BLOCKED_EFFECT':'DETERMINATE_SOURCE_DUTY';expected.proofInheritance=false;expected.sourceDecision=structuredClone(row.sourceDecision);
    }else{
      const ref=row.selectedCandidate,doc=roleDoc(ref?.inputRole);need(doc,'INSERTION_DELTA_SELECTED_CANDIDATE','Non-counting duty lacks its selected contributor.');
      const candidate=pointerValue(doc,ref.jsonPointer),link=candidateLinks.get(ref.inputRole+ref.jsonPointer);need(candidate.localId===ref.localId&&valueSha(candidate)===ref.candidateSha256&&link&&link.decision.canonicalIds.includes(row.canonicalId),'INSERTION_DELTA_SELECTED_CANDIDATE','Selected candidate/hash/target differs.');
      let statement=candidate.statement;
      if(link.decision.disposition==='ACCEPTED_WITH_CONTEXTUAL_CORRECTION'){
        const counterpart=[...candidateLinks.values()].filter(x=>x.decision.candidate.inputRole==='REVIEWER'&&x.decision.canonicalIds.length===1&&x.decision.canonicalIds[0]===row.canonicalId);
        need(candidate.primarySourceLocation.startLine===2057&&/^AMEND-L2057-A[678]$/.test(row.canonicalId)&&counterpart.length===1&&link.decision.reason==='Correct the author phrase "other domains are not accepted": it excludes types outside the total allowed union, not the other two explicitly allowed COUNT domains.','INSERTION_DELTA_CANONICAL_NORMALIZATION','No exact frozen normalization authorizes altered statement.');statement=counterpart[0].candidate.statement+' COUNT accepts no input type outside the union of string, array, and bytes.';
      }
      const line=candidate.primarySourceLocation.startLine,location=lineMap.get(line)?.source;need(location,'INSERTION_DELTA_CANONICAL_LINE','Canonical primary lacks a reconciled source line.');
      const blockers=[];if([1195,1199].includes(line))blockers.push('SRC-GAP-DEFERRED-BINDING');if(line===2073&&row.canonicalId.endsWith('A2')||line===2080&&/A[47]$/.test(row.canonicalId))blockers.push('SRC-AMBIGUITY-XML-SUBNODE-ROOT');
      expected={canonicalId:row.canonicalId,entryKind:'ATOMIC_OBLIGATION',statement,requirementKind:candidate.requirementKind,primarySourceLocation:structuredClone(location),sourceSpans:structuredClone(candidate.sourceSpans),contextSourceLocations:structuredClone(candidate.contextSourceLocations),conditions:structuredClone(candidate.conditions),selectedCandidate:structuredClone(ref),sourceDecisionId:link.decision.sourceDecisionId,unresolvedSourceEffects:blockers,proofInheritance:false,sourceStatus:blockers.length?'DETERMINATE_DUTY_WITH_BLOCKED_EFFECT':'DETERMINATE_SOURCE_DUTY'};
    }
    need(equal(actual,expected),'INSERTION_DELTA_CANONICAL_PAYLOAD','Canonical duty differs from its full adjudicated source payload.');
    need([...candidateLinks.values()].some(x=>x.decision.canonicalIds.includes(row.canonicalId)),'INSERTION_DELTA_CANONICAL_UNUSED','Canonical duty has no reviewed candidate relation.');
  }
  for(const row of contexts){
    if(row.sourceDecision){
      need(sameRef(row.sourceDecision,reconciliation.countingAdjudication)&&/^\/(sourceContexts|governingContextContracts)\/\d+$/.test(row.sourceDecision.jsonPointer),'INSERTION_DELTA_CONTEXT_AUTHORITY','Context names another typed adjudication.');
      const selected=structuredClone(custody.selected(row.sourceDecision,row.sourceDecision.jsonPointer)),expected={...selected};expected.canonicalId=expected.contextId;delete expected.contextId;expected.entryKind=row.sourceDecision.jsonPointer.startsWith('/sourceContexts/')?'SOURCE_CONTEXT':'GOVERNING_CONTEXT_CONTRACT';expected.proofInheritance=false;expected.sourceDecision=structuredClone(row.sourceDecision);
      need(equal(semanticPreId(row,true),expected),'INSERTION_DELTA_CONTEXT_PAYLOAD','Context classification, range, governor or qualifier differs from adjudication.');continue;
    }
    const links=contextDecisions.filter(x=>(x.canonicalIds??[x.canonicalId]).includes(row.canonicalId)),fragmentLinks=[...candidateLinks.values()].filter(x=>x.decision.disposition==='REPRESENTED_AS_SCOPE_OR_PROVENANCE_CONTEXT'&&x.decision.canonicalIds.includes(row.canonicalId));
    need(links.length>0||fragmentLinks.length>0,'INSERTION_DELTA_CONTEXT_UNUSED','Context lacks an original candidate relation.');
    if(fragmentLinks.length){
      const selected=fragmentLinks.find(x=>x.decision.candidate.inputRole==='AUTHOR')??fragmentLinks[0],line=selected.candidate.primarySourceLocation.startLine;
      const expected={canonicalId:row.canonicalId,classification:[1195,1201].includes(line)?'HISTORICAL_NONNORMATIVE_CONTEXT':'STRUCTURAL_REQUIREMENT_CONTEXT',sourceLocation:structuredClone(lineMap.get(line)?.source),selectedText:selected.candidate.statement,reason:selected.decision.reason,governingOccurrenceSets:[],proofInheritance:false};
      need(equal(semanticPreId(row,true),expected),'INSERTION_DELTA_CONTEXT_FRAGMENT','Fragment does not preserve the full reviewed scope-only decision.');continue;
    }
    const author=links.find(x=>x.inputRole==='AUTHOR'),candidate=author?pointerValue(draft,author.jsonPointer):pointerValue(review,links[0].jsonPointer),location=candidate.sourceLocation,role=location.role;
    const normalized=loc=>loc.role==='EXACT_APPROVED_V4'&&loc.startLine>=206?[206,216]:[loc.startLine,loc.endLine];
    need(links.every(link=>{const c=pointerValue(roleDoc(link.inputRole),link.jsonPointer);return c.classification===row.classification&&c.sourceLocation.role===role&&equal(normalized(c.sourceLocation),normalized(location));})&&equal(normalized(location),[row.sourceLocation.startLine,row.sourceLocation.endLine]),'INSERTION_DELTA_CONTEXT_PAYLOAD','Context classification/source differs from frozen contributor reconciliation.');
    // Exact documented builder projection; these named heading ranges are
    // adjudicated scopes, never a blanket endpoint expansion of old ranges.
    const headings={1637:[[1639,1650]],2041:[[2043,2050]],2052:[[2054,2086]],2056:[[2057,2059]],2061:[[2062,2069]],2071:[[2072,2073]],2075:[[2076,2083]],2085:[[2086,2086]],4055:[[4057,4065]],1187:[[1189,1201]],1189:[[1191,1201]],2524:[[2526,2551]],2526:[[2527,2543],[2545,2545],[2549,2549],[2551,2551]]};
    const selectedText=location.selectedText??null,expected={canonicalId:row.canonicalId,classification:candidate.classification,sourceLocation:structuredClone(row.sourceLocation),selectedText,governingOccurrenceSets:[],reason:candidate.reason,proofInheritance:false,sourceRole:role==='BASE_SOURCE'?'RETAINED_SOURCE_REFERENCE':'AMENDMENT_OR_AUTHORITY_CONTEXT'};
    if(selectedText)expected.reason='Only the quoted historical fragment is nonnormative; adjacent operative limitations on the same physical line remain normative.';
    else if(role==='EXACT_APPROVED_V4')expected.reason='Original proposal framing and post-insertion review/history references are historical context. The subsequent exact approval establishes source-choice adoption; it grants no current implementation or proof acceptance.';
    else if(role==='BASE_SOURCE'){
      let at=location.startLine;expected.governingOccurrenceSets=map.forwardLineRange(location.startLine,location.endLine).map(([a,b])=>{const end=at+b-a,result={baseStartLine:at,baseEndLine:end,successorStartLine:a,successorEndLine:b,lineCount:end-at+1,sha256:sha(Buffer.from(mapData(map).base.lines.slice(at-1,end).join('\n')))};at=end+1;return result;});
      expected.reason='This exact retained source passage supplies context for the amendment. Its original occurrence set is transported without inserted clauses. This reference does not decide every predecessor entry in the passage unaffected.';
    }else if(role==='SUCCESSOR_SOURCE'){
      if(headings[location.startLine]){expected.governingOccurrenceSets=headings[location.startLine].map(([startLine,endLine])=>({role:'SUCCESSOR_SOURCE',startLine,endLine}));expected.reason='Exact named subsection scope, excluding adjacent independent insertions and excluding the heading itself as a duplicate atomic command. The same-line/table clauses remain operative.';}
      else expected.governingOccurrenceSets=structuredClone(candidate.exactGoverningSourceRanges);
    }
    need(equal(semanticPreId(row,true),expected),'INSERTION_DELTA_CONTEXT_PAYLOAD','Complete context scope, selected fragment, role or qualifier differs from deterministic frozen adjudication.');
  }
}
function effectiveGovernorOccurrences(references,map){
  need(Array.isArray(references),'INSERTION_DELTA_PROPOSAL_GOVERNORS','Effective governor inventory is absent.');
  const occurrences=new Map;
  for(const ref of references){const checked=sourcePassage(ref,map);need(checked.role==='SUCCESSOR_SOURCE','INSERTION_DELTA_PROPOSAL_GOVERNORS','Effective governor is not current-source authority.');for(let line=checked.startLine;line<=checked.endLine;line++)occurrences.set(line,{sourceSha256:map.currentSha256,line,lineSha256:sha(Buffer.from(mapData(map).current.lines[line-1]))});}
  return [...occurrences.values()].sort((a,b)=>a.line-b.line);
}
function decodeCompactProposal(candidate,rows,summary,summaryRef,proposalFreeze,ref,custody,original,map,reconciler,record,checkedOccurrences){
  const versions={'closed-loop-incremental-retained-impact-proposal/2':2,'closed-loop-incremental-retained-impact-proposal/3':3,'closed-loop-incremental-retained-impact-proposal/4':4},version=versions[summary.schema],dir=ref.path.slice(0,ref.path.lastIndexOf('/')+1);
  need(version&&proposalFreeze.schema==='closed-loop-incremental-retained-impact-freeze/2'&&proposalFreeze.status==='FROZEN_PENDING_DISTINCT_RECONCILIATION'&&summary.status==='FROZEN_PROPOSAL_PENDING_DISTINCT_RECONCILIATION','INSERTION_DELTA_PROPOSAL_VERSION','Unknown or mismatched compact proposal/freeze version.');
  const file=name=>{const matches=proposalFreeze.files.filter(value=>value.path===dir+name);need(matches.length===1,'INSERTION_DELTA_PROPOSAL_COMPACT_CUSTODY','Compact support file is not uniquely freeze-pinned.');return matches[0];};
  need(proposalFreeze.files.some(value=>sameRef(value,ref))&&proposalFreeze.files.some(value=>sameRef(value,summaryRef))&&summary.completedMemberCount===rows.length&&Array.isArray(summary.exactCompletedIds)&&summary.exactCompletedIds.length===rows.length&&new Set(summary.exactCompletedIds).size===rows.length&&new Set(rows.map(value=>value.predecessorNormativeRequirementId)).size===rows.length&&rows.every(value=>summary.exactCompletedIds.includes(value.predecessorNormativeRequirementId)),'INSERTION_DELTA_PROPOSAL_ACTOR','Compact proposal exact population or frozen outputs differ.');
  const actorReference=file('actual-read-inventory.json'),inventory=custody.json(actorReference);
  need(inventory.schema==='source-only-actual-read-inventory/2'&&nonblank(inventory.actorId)&&inventory.actorId!==reconciler&&(summary.actorId===undefined||summary.actorId===inventory.actorId)&&inventory.implementationRead===false&&inventory.testImplementationRead===false&&inventory.runtimeOrProofResultsRead===false&&equal(inventory.unexpectedInputs,[]),'INSERTION_DELTA_PROPOSAL_ACTOR','Compact proposal lacks its exact independent source-only actor inventory.');
  need(Array.isArray(inventory.selectedPredecessorIds)&&Array.isArray(inventory.selectedPredecessorIndexes)&&inventory.selectedPredecessorIds.length===rows.length&&inventory.selectedPredecessorIndexes.length===rows.length&&new Set(inventory.selectedPredecessorIds).size===rows.length&&new Set(inventory.selectedPredecessorIndexes).size===rows.length&&rows.every(value=>inventory.selectedPredecessorIds.includes(value.predecessorNormativeRequirementId)&&inventory.selectedPredecessorIndexes.includes(value.predecessorIndex)),'INSERTION_DELTA_PROPOSAL_POPULATION','Compact actor inventory names another member population.');
  const input=(role,filePath)=>{const matches=inventory.inputs.filter(value=>(role===null||value.role===role)&&(filePath===undefined||value.path===filePath));need(matches.length===1,'INSERTION_DELTA_PROPOSAL_COMPACT_CUSTODY','Compact input authority is missing or ambiguous.');return matches[0];};
  need(input('BASE_SOURCE').sha256===map.baseSha256&&input('SUCCESSOR_SOURCE').sha256===map.currentSha256,'INSERTION_DELTA_PROPOSAL_SOURCE','Compact proposal actor read another source version.');
  const predecessor=input('PREDECESSOR');
  need(candidate.originalEvidence?.inputRole==='PREDECESSOR'&&candidate.originalEvidence.frozenArtifactSha256===predecessor.sha256&&candidate.originalEvidence.jsonPointer==='/entries/'+record.predecessorIndex,'INSERTION_DELTA_PROPOSAL_SCOPE','Compact original evidence selects another immutable predecessor.');
  const resolve=(pointer,kind)=>{
    need(pointer&&nonblank(pointer.path)&&nonblank(pointer.jsonPointer)&&digest(pointer.sha256),'INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Exact compact selected-value reference required.');
    let artifact;
    if(kind==='TABLE'){need(pointer.path==='source-reference-table.json'&&pointer.jsonPointer==='/references/REF-'+pointer.sha256,'INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Table selector/hash role differs.');artifact=file(pointer.path);}
    else if(kind==='PACKET'){need(pointer.path==='review-read-packet.json'&&pointer.jsonPointer==='/members/'+record.candidateIndex+'/fullOriginal','INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Reading packet selector differs.');artifact=file(pointer.path);}
    else if(kind==='PREDECESSOR'){need(pointer.path===predecessor.path&&pointer.artifactSha256===predecessor.sha256&&pointer.jsonPointer==='/entries/'+record.predecessorIndex,'INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Original entry artifact/selector differs.');artifact=predecessor;}
    else{need(kind==='QUEUE'&&/^\/\d+\/exactOriginalContextAndSpanBindings$/.test(pointer.jsonPointer),'INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Original binding-set selector differs.');artifact=input(null,pointer.path);}
    const doc=custody.json(artifact),value=pointerValue(doc,pointer.jsonPointer);need(valueSha(value)===pointer.sha256,'INSERTION_DELTA_PROPOSAL_COMPACT_VALUE','Compact selected-value digest differs from its frozen artifact.');
    if(kind==='TABLE')need(doc.schema==='source-only-exact-reference-table/1','INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Unknown source reference table.');
    if(kind==='PACKET'){const member=doc.members[record.candidateIndex];need(member.index===record.predecessorIndex&&member.id===original.normativeRequirementId&&member.entrySha256===valueSha(original),'INSERTION_DELTA_PROPOSAL_SCOPE','Reading packet member identity differs.');}
    if(kind==='QUEUE'){const member=pointerValue(doc,pointer.jsonPointer.slice(0,pointer.jsonPointer.lastIndexOf('/')));need(member.predecessorIndex===record.predecessorIndex&&member.predecessorNormativeRequirementId===original.normativeRequirementId&&member.predecessorEntrySha256===valueSha(original),'INSERTION_DELTA_PROPOSAL_SCOPE','Original binding queue selects another predecessor.');}
    return value;
  };
  need(!Object.hasOwn(candidate,'originalSemanticPayload')&&!Object.hasOwn(candidate,'newGoverningSourceReferences')&&!Object.hasOwn(candidate,'exactOldToNewOccurrenceBindings'),'INSERTION_DELTA_PROPOSAL_VERSION','Compact proposal mixes inline and referenced semantic forms.');
  const full=resolve(candidate.originalSemanticPayloadRef,version===4?'PREDECESSOR':'PACKET');need(equal(full,original),'INSERTION_DELTA_PROPOSAL_SCOPE','Compact full original semantic entry differs.');
  const semanticKeys=['normativeRequirementId','sectionId','sourceLocation','controllingText','entryKind',original.entryKind==='ATOMIC_OBLIGATION'?'atomicObligation':'contextClassification',...(Object.hasOwn(original,'birthIdentity')?['birthIdentity']:[])],semantic=Object.fromEntries(semanticKeys.map(key=>[key,full[key]]));
  need(Array.isArray(candidate.newGoverningSourceReferencePointers),'INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Compact governor references absent.');const governors=candidate.newGoverningSourceReferencePointers.map(pointer=>resolve(pointer,'TABLE'));
  let bindings;
  if(version===2){need(Array.isArray(candidate.exactOldToNewOccurrenceBindingRefs)&&!Object.hasOwn(candidate,'exactOldOccurrenceBindingSetRef')&&!Object.hasOwn(candidate,'orderedTransportReferenceIds'),'INSERTION_DELTA_PROPOSAL_VERSION','Version2 occurrence representation differs.');bindings=candidate.exactOldToNewOccurrenceBindingRefs.map(value=>({...value.exactOriginalBinding,...resolve(value.transportedSourceRef,'TABLE')}));}
  else{need(!Object.hasOwn(candidate,'exactOldToNewOccurrenceBindingRefs')&&candidate.transportReferenceTablePath==='source-reference-table.json'&&Array.isArray(candidate.orderedTransportReferenceIds),'INSERTION_DELTA_PROPOSAL_VERSION','Version3/4 occurrence representation differs.');const originals=resolve(candidate.exactOldOccurrenceBindingSetRef,'QUEUE');need(Array.isArray(originals)&&originals.length===candidate.orderedTransportReferenceIds.length,'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','Original binding and ordered transport populations differ.');bindings=originals.map((binding,index)=>{const id=candidate.orderedTransportReferenceIds[index];need(typeof id==='string'&&/^REF-[0-9a-f]{64}$/.test(id),'INSERTION_DELTA_PROPOSAL_COMPACT_REFERENCE','Transport reference identity differs.');return {...binding,...resolve({path:candidate.transportReferenceTablePath,jsonPointer:'/references/'+id,sha256:id.slice(4)},'TABLE')};});}
  need(equal(bindings.map(({entryJsonPointer,occurrenceId})=>({entryJsonPointer,occurrenceId})),checkedOccurrences.map(({entryJsonPointer,occurrenceId})=>({entryJsonPointer,occurrenceId}))),'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','Compact occurrence pointers, identities, order or coverage differ from the checked original scope.');
  const {base,current}=mapData(map);
  bindings.forEach((binding,index)=>{
    const checked=checkedOccurrences[index],selected=pointerValue(original,binding.entryJsonPointer),old=binding.original;
    need(equal(selected,checked.originalValue)&&old&&Array.isArray(binding.successorExactFragments)&&binding.successorExactFragments.length===checked.fragments.length,'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','Compact transport does not bind the exact original occurrence.');
    if(checked.kind==='LINES'){
      need(Number.isSafeInteger(old.startLine)&&Number.isSafeInteger(old.endLine),'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','A line occurrence cannot consume a byte-only transport.');
      const originalPassage=sourcePassage(old,map),a=Array.isArray(selected)?selected[0]:selected.startLine,b=Array.isArray(selected)?selected[1]:selected.endLine;
      need(originalPassage.role==='BASE_SOURCE'&&originalPassage.startLine===a&&originalPassage.endLine===b,'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','Compact line source selects another occurrence.');
      binding.successorExactFragments.forEach((fragment,i)=>{const expected=checked.fragments[i],from=sourcePassage(fragment.originalFragment,map),to=sourcePassage(fragment.successorFragment,map);need(from.role==='BASE_SOURCE'&&to.role==='SUCCESSOR_SOURCE'&&equal([from.startLine,from.endLine,to.startLine,to.endLine],[expected.baseStartLine,expected.baseEndLine,expected.successorStartLine,expected.successorEndLine]),'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','Compact line fragments differ from exact insertion transport.');});
    }else{
      need(old.role==='BASE_SOURCE'&&old.sourceSha256===map.baseSha256&&old.startByte===selected.startByte&&old.endByte===selected.endByte&&old.sha256===sha(base.bytes.subarray(old.startByte,old.endByte))&&old.text===base.bytes.subarray(old.startByte,old.endByte).toString('utf8'),'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','Compact byte source differs from exact original span.');
      binding.successorExactFragments.forEach((fragment,i)=>{const expected=checked.fragments[i],text=base.bytes.subarray(expected.baseStartByte,expected.baseEndByte).toString('utf8');need(equal(fragment,{...expected,text})&&current.bytes.subarray(expected.successorStartByte,expected.successorEndByte).equals(base.bytes.subarray(expected.baseStartByte,expected.baseEndByte)),'INSERTION_DELTA_PROPOSAL_COMPACT_OCCURRENCES','Compact byte fragment differs from exact insertion transport.');});
    }
  });
  return {actor:inventory.actorId,semantic,governors,bindings,referenceEvidence:{proposalVersion:summary.schema,freezeVersion:proposalFreeze.schema,actorInventory:structuredClone(actorReference),originalSemanticPayloadRef:structuredClone(candidate.originalSemanticPayloadRef),newGoverningSourceReferencePointers:structuredClone(candidate.newGoverningSourceReferencePointers)}};
}

function validateAdditiveOrigin(record,freeze,custody,original,map,reconciler,checkedOccurrences){
  const id=original.normativeRequirementId,index=record.predecessorIndex;
  if(record.distinctReview){
    const ref=record.distinctReview.artifact,review=custody.json(ref),decision=pointerValue(review,record.distinctReview.jsonPointer);
    need(review.schema==='closed-loop-focused-source-status-field-judgment/1'&&review.status==='SOURCE_ONLY_TWO_RESOLVED_ONE_PRECISE_SOURCE_AMBIGUITY'&&nonblank(review.reviewer)&&review.reviewer!==reconciler&&review.frozen===true&&review.effects?.proofPromotion===false&&decision.predecessorId===id&&decision.originalEntrySha256===valueSha(original)&&decision.originalEvidence?.jsonPointer==='/entries/'+index&&decision.originalFullStatement===(original.atomicObligation?.statement??original.controllingText)&&['ACCEPTED_WITH_SCOPE_EXPLICIT','ACCEPTED_UNRESOLVED_SOURCE_DISTINCTION'].includes(record.reviewAdjudication),'INSERTION_DELTA_DISTINCT_REVIEW','Distinct source judgment identity, actor, acceptance or scope differs.');
    need((record.successorDisposition==='BLOCKED'&&decision.effectiveContextDisposition==='UNRESOLVED_SOURCE_POPULATION_AMBIGUITY')||decision.effectiveContextDisposition===record.successorDisposition,'INSERTION_DELTA_DISTINCT_REVIEW','Review judgment does not support successor disposition.');
    need(review.pins?.BASE?.sha256===map.baseSha256&&review.pins?.SUCCESSOR?.sha256===map.currentSha256,'INSERTION_DELTA_DISTINCT_REVIEW','Distinct source review source differs.');
    for(const key of record.sourceEvidencePointers??[]){const evidence=review.evidence?.[key];need(evidence,'INSERTION_DELTA_DISTINCT_REVIEW','Distinct source evidence selector is absent.');for(const passage of Object.values(evidence))if(passage&&typeof passage==='object'&&passage.startLine)sourcePassage(passage,map);}
    return {kind:'DISTINCT_SOURCE_JUDGMENT',reference:structuredClone(record.distinctReview),reviewer:review.reviewer,judgment:structuredClone(decision)};
  }
  if(record.effectiveGovernorLink)return {kind:'ATTRIBUTED_TECHNICAL_GOVERNOR',reference:structuredClone(record.effectiveGovernorLink)};
  need(Number.isSafeInteger(record.candidateIndex)&&record.candidateIndex>=0&&nonblank(record.batch),'INSERTION_DELTA_PROPOSAL_SELECTOR','Additive decision lacks exact proposal index/batch.');
  const inputs=freeze.inputs??[],candidates=inputs.filter(ref=>ref.path.endsWith('/per-id-decisions.json')&&ref.path.includes('/batch-'+record.batch+'/'));
  need(candidates.length===1,'INSERTION_DELTA_PROPOSAL_CUSTODY','Proposal candidate array is not uniquely pinned by layer freeze.');const ref=candidates[0],rows=custody.json(ref),candidate=rows[record.candidateIndex];
  need(candidate&&valueSha(candidate)===(record.candidateEvidence?.candidateSha256??record.candidateSha256)&&(!record.candidateEvidence||sameRef(record.candidateEvidence,ref)&&record.candidateEvidence.jsonPointer==='/'+record.candidateIndex)&&candidate.predecessorNormativeRequirementId===id&&candidate.predecessorIndex===index&&candidate.predecessorEntrySha256===valueSha(original)&&candidate.proposedDisposition===record.proposalDisposition&&candidate.runtimeProofInheritance===false&&candidate.acceptanceClaim===false,'INSERTION_DELTA_PROPOSAL_CANDIDATE','Exact proposal candidate/hash/index/predecessor/disposition differs.');
  const dir=ref.path.slice(0,ref.path.lastIndexOf('/')+1),freezeRef=inputs.find(x=>x.path===dir+'freeze-manifest.json'),summaryRef=inputs.find(x=>x.path===dir+'summary.json');need(freezeRef&&summaryRef,'INSERTION_DELTA_PROPOSAL_CUSTODY','Proposal freeze/actor summary is absent.');const proposalFreeze=custody.json(freezeRef),summary=custody.json(summaryRef);
  let compact=null,proposalActor=summary.actorId,proposalGovernors=candidate.newGoverningSourceReferences,proposalBindings=candidate.exactOldToNewOccurrenceBindings;
  if(summary.schema==='closed-loop-incremental-retained-impact-proposal/1'){
  need(proposalFreeze.schema==='closed-loop-incremental-retained-impact-freeze/1'&&proposalFreeze.status==='FROZEN_PENDING_DISTINCT_RECONCILIATION'&&proposalFreeze.files.some(x=>sameRef(x,ref))&&proposalFreeze.files.some(x=>sameRef(x,summaryRef))&&summary.schema==='closed-loop-incremental-retained-impact-proposal/1'&&summary.status==='FROZEN_PROPOSAL_PENDING_DISTINCT_RECONCILIATION'&&nonblank(summary.actorId)&&summary.actorId!==reconciler&&summary.exactCompletedIds?.includes(id)&&summary.completedMemberCount===rows.length,'INSERTION_DELTA_PROPOSAL_ACTOR','Proposal freeze, population or distinct actor differs.');
  const semantic=candidate.originalSemanticPayload,semanticKeys=['normativeRequirementId','sectionId','sourceLocation','controllingText','entryKind',original.entryKind==='ATOMIC_OBLIGATION'?'atomicObligation':'contextClassification',...(Object.hasOwn(original,'birthIdentity')?['birthIdentity']:[])];need(semantic&&equal(Object.keys(semantic).sort(),semanticKeys.sort())&&Object.keys(semantic).every(key=>equal(semantic[key],original[key])),'INSERTION_DELTA_PROPOSAL_SCOPE','Proposal original semantic payload differs.');
  }else{compact=decodeCompactProposal(candidate,rows,summary,summaryRef,proposalFreeze,ref,custody,original,map,reconciler,record,checkedOccurrences);proposalActor=compact.actor;proposalGovernors=compact.governors;proposalBindings=compact.bindings;}
  need(['ACCEPTED','REJECTED_AS_PROPOSED_CORRECTED','BLOCKED_UNSUPPORTED_IDENTITY_DISPOSITION'].includes(record.proposalAdjudication)&&(record.proposalAdjudication!=='ACCEPTED'||record.successorDisposition===candidate.proposedDisposition)&&(record.proposalAdjudication!=='BLOCKED_UNSUPPORTED_IDENTITY_DISPOSITION'||record.successorDisposition==='BLOCKED'),'INSERTION_DELTA_PROPOSAL_ADJUDICATION','Unsupported or inconsistent proposal adjudication.');
  const walk=value=>{if(!value||typeof value!=='object')return;if(value.role&&value.startLine!==undefined)sourcePassage(value,map);for(const child of Object.values(value))walk(child);};walk(proposalGovernors);walk(proposalBindings);
  return {kind:'FROZEN_SOURCE_PROPOSAL_AND_DISTINCT_RECONCILIATION',candidateReference:{path:ref.path,sha256:ref.sha256,jsonPointer:'/'+record.candidateIndex},candidateSha256:valueSha(candidate),proposalActor,proposalFreeze:structuredClone(freezeRef),proposalAdjudication:record.proposalAdjudication,proposalGovernorOccurrences:effectiveGovernorOccurrences(proposalGovernors,map),...(compact?{compactReferenceEvidence:compact.referenceEvidence}:{})};
}
function technicalGovernor(ref,custody,map,predecessorId,predecessorIndex,newDutySubject=null){
  const link=reviewInput(ref,custody);
  if(link.schema==='closed-loop-attributed-composite-source-resolution-custody-link/1'){
    need(!newDutySubject&&link.status==='LINKED_IN_ADDITIVE_CANDIDATE_SOURCE_GOVERNOR_SET_PENDING_EXPLICIT_COMPOSITE_CONSUMER_SUPPORT'&&link.sourceLedgerActivated===false&&link.implementationAcceptance===false&&link.proofPromoted===false&&equal(link.governedPredecessorIndexes,[predecessorIndex])&&nonblank(link.actorId)&&nonblank(link.scopeRule)&&nonblank(link.identityRule)&&Array.isArray(link.componentGovernors)&&link.componentGovernors.length>1,'INSERTION_CURRENT_COMPOSITE','Composite authority, exact subject or components differ.');
    const issues=new Set,paths=new Set,components=link.componentGovernors.map(component=>{
      need(nonblank(component.issueId)&&!issues.has(component.issueId)&&!paths.has(component.governorLink?.path),'INSERTION_CURRENT_COMPOSITE','Composite component is absent or repeated.');issues.add(component.issueId);paths.add(component.governorLink.path);
      const child=reviewInput(component.governorLink,custody);need(child.schema==='closed-loop-attributed-source-resolution-custody-link/1'&&child.actorId===link.actorId&&child.issueResolution?.issueId===component.issueId&&sameRef(child.individualEffectiveScopeDecisions,link.individualEffectiveScopeDecisions),'INSERTION_CURRENT_COMPOSITE','Composite component role, actor, issue or scope custody differs.');
      return technicalGovernor(component.governorLink,custody,map,predecessorId,predecessorIndex);
    });
    const scopes=custody.json(link.individualEffectiveScopeDecisions),matching=scopes.filter(row=>row.predecessorIndex===predecessorIndex&&row.predecessorId===predecessorId);
    need(matching.length===1&&equal(matching[0].edges.filter(row=>row.decision==='ACTUAL_REFERENCE_GOVERNS_CURRENT_SCOPE').map(row=>row.issueId).sort(),[...issues].sort()),'INSERTION_CURRENT_COMPOSITE_SCOPE','Composite loses or invents an independently scoped actual issue.');
    return {reference:structuredClone(ref),link:structuredClone(link),components,meaning:structuredClone(matching[0]),acceptance:components.map(row=>row.acceptance)};
  }
  need(link.schema==='closed-loop-attributed-source-resolution-custody-link/1'&&link.status==='LINKED_IN_ADDITIVE_CANDIDATE_SOURCE_GOVERNOR_SET'&&(link.statuses?link.statuses.technicalReviewAccepted===true&&link.statuses.candidateGovernorLinked===true&&link.statuses.blindSourceOriginClaim===false&&link.statuses.proofPromoted===false:link.sourceLedgerActivated===false&&link.proofPromoted===false&&link.originalReviewInheritance===false),'INSERTION_DELTA_TECHNICAL_ROLE','Technical governor is not a linked, separately attributed reviewed interpretation.');
  const basis=link.sourceBasis,sourceRoles=basis&&['BASE_SOURCE','SUCCESSOR_SOURCE','EXACT_APPROVED_V4'].every(k=>Object.hasOwn(basis,k))?['BASE_SOURCE','SUCCESSOR_SOURCE','EXACT_APPROVED_V4']:['baseSource','successorSource','ownerApprovedV4'];need(basis&&Object.keys(basis).length===3&&sourceRoles.every((role,i)=>basis[role]?.sha256===[map.baseSha256,map.currentSha256,map.proposalSha256][i]&&(basis[role].role===undefined||basis[role].role===['BASE_SOURCE','SUCCESSOR_SOURCE','EXACT_APPROVED_V4'][i])),'INSERTION_DELTA_TECHNICAL_SOURCE','Technical governor explicit source roles/proposal differ.');
  for(const pin of Object.values(basis))custody.read(pin);
  const t=link.technicalResolution;need(t&&nonblank(t.relationship),'INSERTION_DELTA_TECHNICAL_MEANING','Typed technical relationship is absent.');
  let content,acceptance;
  if(t.jsonPointer){
    need(t.relationship==='ADDITIONAL_EXPLICIT_POPULATION_GOVERNOR'&&t.scope?.predecessorId===predecessorId,'INSERTION_DELTA_TECHNICAL_SCOPE','Population governor applies to another identity.');
    content=custody.selected(t.artifact,t.jsonPointer);acceptance=reviewInput(link.distinctTechnicalAcceptance,custody);
    need(acceptance.schema==='closed-loop-independent-stage14-population-resolution-review/1'&&acceptance.status==='ACCEPT_NARROW_ATTRIBUTED_TECHNICAL_RESOLUTION_INPUT'&&sameRef(acceptance.record,t.artifact)&&acceptance.scope?.predecessorId===predecessorId&&nonblank(acceptance.reviewer)&&acceptance.reviewer!==link.actorId,'INSERTION_DELTA_TECHNICAL_REVIEW','Population acceptance is missing, mismatched or not distinct.');
  }else{
    const acceptedRelationships=['SELECTS_PREVIOUSLY_AMBIGUOUS_SEMANTICS_WITHIN_DELEGATED_TECHNICAL_AUTHORITY','CLARIFIES_INHERITED_DENOTATION','CLARIFIES_PRESERVED_HISTORICAL_MEANINGS_UNDER_CURRENT_SOURCE_PRECEDENCE'];
    const subjectMatches=newDutySubject?newDutySubject.original.normativeRequirementId===predecessorId&&newDutySubject.edge.originalNewDutyIndex===predecessorIndex&&sameRef(newDutySubject.edge.resolutionEvidenceReference.governor,ref)&&(link.governedNewDutyIndices?newDutySubject.edge.successorDisposition==='RETAINED'&&newDutySubject.edge.effectiveGovernorLink===null||link.governedNewDutyIndices.includes(predecessorIndex):Array.isArray(link.governedPredecessorIndexes)):Array.isArray(link.governedPredecessorIndexes)&&new Set(link.governedPredecessorIndexes).size===link.governedPredecessorIndexes.length&&link.governedPredecessorIndexes.includes(predecessorIndex);
    need(acceptedRelationships.includes(t.relationship)&&subjectMatches,'INSERTION_DELTA_TECHNICAL_SCOPE','Unexpected technical scope or relationship.');
    const bytes=custody.read(t.artifact),span=t.span;
    need(span?.artifactSha256===t.artifact.sha256&&integer(span.startByte)&&integer(span.endByteExclusive)&&span.endByteExclusive>span.startByte&&span.endByteExclusive<=bytes.length,'INSERTION_DELTA_TECHNICAL_SPAN','Technical span is invalid.');
    content=bytes.subarray(span.startByte,span.endByteExclusive).toString('utf8');need(sha(Buffer.from(content))===span.spanSha256IncludingLineTerminators&&content===t.text,'INSERTION_DELTA_TECHNICAL_BYTES','Technical meaning bytes differ.');
    const wrapper=reviewInput(t.wrapper,custody),binding=pointerValue(wrapper,t.wrapperIssuePointer),scopeReview=reviewInput(t.technicalReview,custody);acceptance=reviewInput(t.laterWrapperAcceptance,custody);
    need(binding.issueId===link.issueResolution?.issueId&&binding.relationshipType===t.relationship&&equal(binding.proposalSpan,t.span)&&binding.proposalSpan.artifactPath===t.artifact.path&&nonblank(binding.resolutionId)&&nonblank(wrapper.attribution?.independentTechnicalReviewer)&&wrapper.attribution.independentTechnicalReviewer!==link.actorId&&wrapper.attribution.independentTechnicalReviewer!==wrapper.attribution.recordPreparer&&wrapper.technicalResolution?.independentReview?.sha256===t.technicalReview.sha256&&scopeReview.schema==='closed-loop-independent-v4-reference-resolution-successor-review/1'&&scopeReview.status==='ACCEPT_NARROW_TECHNICAL_REFERENCE_RESOLUTION_SCOPE'&&scopeReview.proposalSha256===t.artifact.sha256&&acceptance.schema==='closed-loop-independent-technical-input-composition-boundary-review/1'&&acceptance.status==='ACCEPT_ADDITIVE_TECHNICAL_INPUT_AND_DEPENDENCY_READY_PREPARATION'&&acceptance.recordSha256===t.wrapper.sha256,'INSERTION_DELTA_TECHNICAL_REVIEW','Technical scope/wrapper acceptance does not bind this meaning.');
  }
  return {reference:structuredClone(ref),link:structuredClone(link),meaning:structuredClone(content),acceptance:structuredClone(acceptance)};
}
function impactDecision(record,original,map,environment){
  const {custody,actorId,shared,mechanism,initial,reference}=environment;
  const originalId=original.normativeRequirementId,index=record.predecessorIndex,id=record.predecessorNormativeRequirementId??record.predecessorId;
  need(id===originalId&&(record.predecessorEntrySha256??record.originalEntrySha256)===valueSha(original),'INSERTION_DELTA_PREDECESSOR','Disposition is not bound to the complete immutable predecessor.');
  const disposition=record.successorDisposition??record.disposition;
  need(['RETAINED','CHANGED','BLOCKED'].includes(disposition)&&record.proofInheritance===false&&(record.implementationAcceptance===undefined||record.implementationAcceptance===false),'INSERTION_DELTA_DISPOSITION','Unknown disposition or proof promotion.');
  const recordActor=record.actorId??record.reconciliationActorId;need(initial||recordActor===undefined||recordActor===actorId,'INSERTION_DELTA_ACTOR','Additive decision has another actor.');
  const statement=original.atomicObligation?.statement??original.controllingText;
  if(record.exactOriginalStatement!==undefined)need(record.exactOriginalStatement===statement,'INSERTION_DELTA_STATEMENT','Original full statement differs.');
  if(record.statementSha256!==undefined)need(record.statementSha256===sha(Buffer.from(statement)),'INSERTION_DELTA_STATEMENT','Original full statement digest differs.');
  if(record.originalStatement!==undefined)need(record.originalStatement===statement,'INSERTION_DELTA_STATEMENT','Attributed original statement differs.');
  let governors=record.newGoverningSourceRanges??record.addedGoverningSourceReferences??record.governingAddedSpans??record.identityPreimage?.governingSourceSpans??(record.identityPreimage?.governingF2Span?[record.identityPreimage.governingF2Span]:[]);
  if(record.addedGoverningPassageIds){need(shared?.sourcePassages&&mechanism?.decisions,'INSERTION_DELTA_SHARED_GRAPH','Shared governor/decision table is missing.');governors=record.addedGoverningPassageIds.map(id=>{const ref=shared.sourcePassages[id];need(ref,'INSERTION_DELTA_GOVERNOR_ID','Governor passage ID is unresolved.');return ref;});}
  const decision=record.sourceDecisionKey?mechanism?.decisions[record.sourceDecisionKey]:record.sourceDecision??record.independentReason??record.reason;
  need(nonblank(decision),'INSERTION_DELTA_SOURCE_DECISION','An exact source decision is required.');
  const checkedGovernors=governors.map(ref=>sourcePassage(ref,map));
  need(checkedGovernors.every(ref=>ref.role==='SUCCESSOR_SOURCE'),'INSERTION_DELTA_GOVERNOR_ROLE','Added governors must be current source occurrences.');
  const technical=record.effectiveGovernorLink?technicalGovernor(record.effectiveGovernorLink,custody,map,originalId,index):null;
  const currentId=record.successorNormativeRequirementId??null,blocked=record.blockedInheritedReferenceDetails??record.unresolvedSourceEffects??record.blockedBy??[];
  let birth=null;
  if(disposition==='RETAINED')need(currentId===originalId&&governors.length===0&&!technical,'INSERTION_DELTA_RETAINED_GOVERNOR','Identity retention lacks an explicit no-new-governor decision.');
  if(disposition==='BLOCKED')need(currentId===null||currentId===undefined,'INSERTION_DELTA_BLOCKED_ID','Unresolved source disposition cannot claim a current identity.');
  if(disposition==='CHANGED'){
    need(nreq(currentId)&&currentId!==originalId,'INSERTION_DELTA_CHANGED_ID','Changed source requires its issued fresh identity.');
    if(record.identityPreimage){
      birth=structuredClone(record.identityPreimage);
      need(birth.schema==='closed-loop-attributed-source-impact-identity/1'&&birth.successorSourceSha256===map.currentSha256&&birth.predecessorId===originalId&&birth.predecessorEntrySha256===valueSha(original)&&birth.statement===statement&&sameRef(birth.explicitTechnicalGovernor,record.effectiveGovernorLink)&&technical,'INSERTION_DELTA_ATTRIBUTED_PREIMAGE','Attributed identity loses its exact technical governor.');
      need((birth.sourceDecision??birth.decision)===decision&&equal(birth.governingSourceSpans??(birth.governingF2Span?[birth.governingF2Span]:[]),governors),'INSERTION_DELTA_ATTRIBUTED_PREIMAGE','Attributed decision or exact governing source occurrences differ.');for(const ref of governors)sourcePassage(ref,map);
    }else if(initial){birth={version:'closed-loop-v4-source-reconciliation-identity/1',sourceSha256:map.currentSha256,predecessorId:originalId,predecessorEntrySha256:valueSha(original),originalStatement:original.atomicObligation?.statement??original.contextClassification,governors,decision};}
    else birth={schema:'closed-loop-additive-source-impact-identity/1',sourceSha256:map.currentSha256,predecessorId:originalId,predecessorEntrySha256:valueSha(original),statement,sourceDecision:decision,addedGovernors:governors,blockedDetails:record.blockedInheritedReferenceDetails??[]};
    const digest=valueSha(birth);need(record.identityPreimageSha256===digest&&currentId==='NREQ-'+digest.slice(0,32),'INSERTION_DELTA_CHANGED_PREIMAGE','Issued changed identity preimage differs.');
  }
  return {predecessorIndex:index,predecessorId:originalId,disposition,currentId,sourceDecision:decision,addedGovernors:checkedGovernors,technicalGovernor:technical,qualifiers:{blockedInheritedReferenceDetails:structuredClone(blocked),historicalReferenceQualifierPreserved:record.historicalReferenceQualifierPreserved??null,addedReferenceQualifier:record.addedReferenceQualifier??null,newBlockedBy:structuredClone(record.newBlockedBy??[])},birthPreimage:birth,record:structuredClone(record),reference:structuredClone(reference)};
}
function sourceGraphForNew(row,custody,map){
  const sources=(row.primarySourceLocation?[row.primarySourceLocation]:row.sourceLocations??[]).map(ref=>sourcePassage(ref,map));need(sources.length>0,'INSERTION_DELTA_NEW_SOURCE','New duty primary source is absent.');
  const contexts=(row.contextSourceLocations??[]).map(ref=>sourcePassage(ref,map)),graph=[];
  if(row.sourceDecision){
    const doc=custody.json(row.sourceDecision),selected=pointerValue(doc,row.sourceDecision.jsonPointer);need(selected&&selected.statement===row.statement,'INSERTION_DELTA_NEW_DECISION','Counting source decision statement differs.');
    for(const [field,array,idField] of [['contextIds','sourceContexts','contextId'],['crossReferenceIds','crossReferenceInteractions','interactionId'],['governingContextContractIds','governingContextContracts','contextId']])for(const id of row[field]??[]){
      const found=(doc[array]??[]).filter(value=>value[idField]===id);need(found.length===1,'INSERTION_DELTA_NEW_GRAPH','Counting context/cross-reference/governor is unresolved or repeated.');const value=found[0];for(const ref of value.sourceLocations??[])contexts.push(sourcePassage(ref,map));for(const ref of value.resolvedTargets??[])if(ref.startLine)contexts.push(sourcePassage(ref,map));graph.push({field,id,reference:structuredClone(row.sourceDecision),record:structuredClone(value)});
    }
  }
  need((row.contextIds?.length??0)+(row.crossReferenceIds?.length??0)+(row.governingContextContractIds?.length??0)===graph.length,'INSERTION_DELTA_NEW_GRAPH','New duty graph is incomplete.');
  return {sources,contexts,graph};
}
function reviewedNewDutyContextRelations(record,index,primaryLine,contexts,references,map){
  const relations=[];
  for(const [contextIndex,context] of contexts.entries()){
    const occurrences=context.sourceLocation?[context.sourceLocation]:context.sourceLocations??[];
    // Only an explicit reviewed ordinary structural membership supplies the
    // reciprocal anchor. Graph-only history, fragments and contracts do not.
    if(context.classification!=='STRUCTURAL_REQUIREMENT_CONTEXT'||context.selectedText!==undefined&&context.selectedText!==null||context.sourceRole==='RETAINED_SOURCE_REFERENCE'||Object.hasOwn(context,'appliesTo')&&Object.hasOwn(context,'meaning')||occurrences.some(ref=>['EXACT_APPROVED_V4','APPROVAL_PROVENANCE'].includes(ref.role)))continue;
    const declared=(context.governingOccurrenceSets??[]).map((value,i)=>({selector:'/governingOccurrenceSets/'+i,value}));if(context.governingScope)declared.push({selector:'/governingScope',value:{...context.governingScope,role:'SUCCESSOR_SOURCE'}});
    const selected=declared.filter(({value})=>primaryLine>=value.startLine&&primaryLine<=value.endLine);if(!selected.length)continue;
    need(occurrences.length>0&&occurrences.every(ref=>ref.role==='SUCCESSOR_SOURCE'&&ref.startLine===ref.endLine),'INSERTION_NEW_CONTEXT_RELATION','Required context relation is not an ordinary current-source occurrence.');
    const alias=verifiedContextAlias(context,map.currentSha256),sourceOccurrence=sourcePassage(occurrences[0],map),memberships=selected.map(({selector,value})=>({selector,range:sourcePassage({...value,sourceSha256:map.currentSha256},map),childPrimaryLine:primaryLine}));
    need(memberships.every(member=>member.range.role==='SUCCESSOR_SOURCE'),'INSERTION_NEW_CONTEXT_RELATION','Required structural membership is not current source.');
    relations.push({schema:'closed-loop-reviewed-new-duty-context-relation/1',context:{artifact:structuredClone(references.contexts),jsonPointer:'/'+contextIndex,entrySha256:valueSha(context),sourceContextIdentity:context.sourceContextIdentity,rowAlias:alias,record:structuredClone(context)},child:{artifact:structuredClone(references.duties),jsonPointer:'/'+index,entrySha256:valueSha(record),canonicalId:record.canonicalId,issuedNormativeRequirementId:record.normativeRequirementId},sourceOccurrence,memberships});
  }
  return relations;
}
function projectNewDutySourceOccurrences(record,sources,current,primaryLine){
  need(Array.isArray(record.sourceSpans)&&record.sourceSpans.length>0&&Array.isArray(sources)&&sources.length>0,'INSERTION_NEW_SPAN_SOURCE','New duty exact occurrences are absent.');
  const sourceLines=new Set;
  for(const passage of sources){need(passage.role==='SUCCESSOR_SOURCE'&&Number.isSafeInteger(passage.startLine)&&Number.isSafeInteger(passage.endLine)&&passage.startLine>=1&&passage.endLine>=passage.startLine&&passage.endLine<=current.lines.length,'INSERTION_NEW_SPAN_SOURCE','New duty source occurrence is not current physical source.');for(let line=passage.startLine;line<=passage.endLine;line++)sourceLines.add(line);}
  const seen=new Set,spanOccurrences=record.sourceSpans.map((span,index)=>{
    keys(span,['startByte','endByte','text','sha256'],'INSERTION_SPAN_FIELDS');
    need(integer(span.startByte)&&integer(span.endByte)&&span.endByte>span.startByte&&span.endByte<=current.bytes.length,'INSERTION_NEW_SPAN_LOCATION','New duty span bounds differ.');
    let low=0,high=current.starts.length;while(low<high){const middle=Math.floor((low+high)/2);if(current.starts[middle]<=span.startByte)low=middle+1;else high=middle;}const line=low,end=current.starts[line-1]+Buffer.byteLength(current.lines[line-1]);
    const sourceLocationIndexes=sources.flatMap((passage,i)=>passage.startLine<=line&&passage.endLine>=line&&passage.startByte<=span.startByte&&span.endByte<=passage.endByte?[i]:[]);
    need(span.endByte<=end&&sourceLocationIndexes.length===1,'INSERTION_NEW_SPAN_LOCATION','New duty span leaves its declared physical source occurrence.');
    const signature=span.startByte+':'+span.endByte;need(!seen.has(signature),'INSERTION_SPAN_DUPLICATE','New duty repeats an exact span occurrence.');seen.add(signature);
    const bytes=current.bytes.subarray(span.startByte,span.endByte);need(typeof span.text==='string'&&span.text.trim()&&sha(bytes)===span.sha256&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===span.text,'INSERTION_SPAN_BYTES','New duty exact span bytes/hash/text differ.');
    return {sourceSpanIndex:index,physicalLine:line,sourceLocationIndexes,projection:line===primaryLine?'PRIMARY_SPAN':'SUPPLEMENTAL_SOURCE_QUALIFICATION'};
  });
  const primarySpanIndexes=spanOccurrences.filter(row=>row.physicalLine===primaryLine).map(row=>row.sourceSpanIndex).sort((a,b)=>record.sourceSpans[a].startByte-record.sourceSpans[b].startByte);
  need(primarySpanIndexes.length>0&&sourceLines.has(primaryLine),'INSERTION_NEW_SPAN_PRIMARY','New duty primary occurrence has no exact operative span.');
  return {schema:'closed-loop-insertion-new-duty-source-occurrence-projection/1',primaryLine,primarySpanIndexes,qualifierLines:[...sourceLines].filter(line=>line!==primaryLine).sort((a,b)=>a-b),spanOccurrences,reviewedSpanOrderPreserved:true};
}
function reviewedNewDutyAtLine(row,sources,line){
  return sources.some(passage=>passage.role==='SUCCESSOR_SOURCE'&&passage.startLine<=line&&passage.endLine>=line)&&[row.sourceLocation,...row.atomicObligation.contextSourceLocations].some(location=>location.startLine===line);
}
function compatibilityAtom(id,original,sourceGraph,impact,map,sections){
  const {current}=mapData(map),old=original?.entryKind==='ATOMIC_OBLIGATION'?transportAtomicScopeCoordinates(original,map):null;
  const primary=old?.sourceLocation??{path:map.specificationPath,startLine:sourceGraph.sources[0].startLine,endLine:sourceGraph.sources[0].startLine,lineSha256:sha(Buffer.from(current.lines[sourceGraph.sources[0].startLine-1]))};
  const statement=original?original.atomicObligation.statement:impact.record.statement;
  const sourceOccurrenceProjection=old?null:projectNewDutySourceOccurrences(impact.record,sourceGraph.sources,current,primary.startLine);
  const sourceSpans=old?.atomicObligation.sourceSpans??sourceOccurrenceProjection.primarySpanIndexes.map(index=>structuredClone(impact.record.sourceSpans[index]));
  const contextLines=new Set(old?.atomicObligation.contextSourceLocations.map(x=>x.startLine)??[]);
  for(const passage of [...(sourceGraph?.contexts??[]),...(impact.addedGovernors??[])]){const ranges=passage.role==='BASE_SOURCE'?map.forwardLineRange(passage.startLine,passage.endLine):[[passage.startLine,passage.endLine]];for(const [a,b] of ranges)for(let line=a;line<=b;line++)contextLines.add(line);}
  for(const line of sourceOccurrenceProjection?.qualifierLines??[])contextLines.add(line);
  contextLines.delete(primary.startLine);
  const contexts=[...contextLines].sort((a,b)=>a-b).map(line=>({path:map.specificationPath,startLine:line,endLine:line,lineSha256:sha(Buffer.from(current.lines[line-1])),controllingText:current.lines[line-1].trim()}));
  const payload={schema:'closed-loop-insertion-effective-scope/1',sourceSha256:map.currentSha256,normativeRequirementId:id,originalEntry:original?structuredClone(original):null,originalOccurrenceTransport:impact.occurrenceTransport??[],sourceGraph:sourceGraph??null,...(sourceOccurrenceProjection?{sourceOccurrenceProjection}:{}),sourceDecision:impact.sourceDecision??null,addedGovernors:impact.addedGovernors??[],technicalGovernor:impact.technicalGovernor??null,qualifiers:impact.qualifiers??null,reviewedSourceRecord:impact.record,additiveOrigin:impact.additiveOrigin??null,reviewedBirthIdentity:impact.birthPreimage??null};
  // No generated key or current scope digest is part of its own commitment.
  const payloadSha256=valueSha(payload),scope={key:`insertion.${original?'changed':'new'}.${payloadSha256}`,statement,sourceSpans,contextSourceLocations:contexts};scope.sha256=atomicObligationSha256(scope);
  const section=sections.find(s=>primary.startLine>=s.startLine&&primary.startLine<=s.endLine);
  const row={normativeRequirementId:id,entryKind:'ATOMIC_OBLIGATION',sectionId:section?.sectionId??'preamble',sourceLocation:primary,controllingText:current.lines[primary.startLine-1].trim(),atomicObligation:scope,continuationProvenance:{payload,payloadSha256,birthIdentity:impact.birthPreimage??null,proofInheritance:false,implementationConformance:'UNKNOWN'}};
  scopeEntry(row,current,map.specificationPath);return row;
}
function loadNewDutyResolutions(layers,duties,dutiesRef,inventory,custody,map,reconciler){
  need(Array.isArray(layers),'INSERTION_NEW_EDGE_LAYERS','New-duty resolution layers must be an explicit inventory.');const states=new Map,seenFreezes=new Set;
  for(const layer of layers){
    keys(layer,['freeze','reconciliation'],'INSERTION_NEW_EDGE_LAYER');need(!seenFreezes.has(layer.freeze.path),'INSERTION_NEW_EDGE_DUPLICATE','New-duty layer repeated.');seenFreezes.add(layer.freeze.path);
    const freeze=custody.json(layer.freeze),root=custody.json(layer.reconciliation);need(freeze.schema==='closed-loop-source-edge-reconciliation-freeze/1'&&freeze.status==='FROZEN'&&freeze.actorId===reconciler&&freeze.outputs.some(ref=>sameRef(ref,layer.reconciliation))&&root.schema==='closed-loop-additive-new-duty-technical-reference-resolution/1'&&sameRef(root.originalFreeze,inventory.originalFreeze)&&root.sourceLedgerActivated===false&&root.proofPromoted===false&&root.validation?.newDutyDenominator===duties.length&&root.validation.newDutyDenominatorChange===0&&root.validation.predecessorDenominatorChange===0&&root.validation.blanketDependencyClosureClaim===false&&freeze.outputs.some(ref=>sameRef(ref,root.records))&&freeze.outputs.some(ref=>sameRef(ref,root.exactEvidence)),'INSERTION_NEW_EDGE_AUTHORITY','New-duty resolution freeze/source/population authority differs.');
    const records=custody.json(root.records),evidence=custody.json(root.exactEvidence);need(Array.isArray(records)&&records.length===root.validation.entryCount&&evidence.schema==='closed-loop-source-edge-exact-evidence/1','INSERTION_NEW_EDGE_POPULATION','New-duty edge evidence population differs.');
    for(const edge of records){
      const index=edge.originalNewDutyIndex,original=duties[index],reference=edge.originalEntryEvidence;need(original&&!states.has(index)&&edge.schema==='closed-loop-attributed-new-duty-edge-reconciliation/1'&&edge.actorId===reconciler&&edge.entryKind==='NEW_AMENDMENT_DEPENDENCY'&&edge.canonicalId===original.canonicalId&&edge.originalNewDutyId===original.normativeRequirementId&&sameRef(reference?.artifact,dutiesRef)&&reference.jsonPointer==='/'+index&&reference.entrySha256===valueSha(original)&&edge.originalStatement===original.statement&&equal(edge.historicalUnresolvedSourceEffects,original.unresolvedSourceEffects)&&edge.historicalSourceStatus===original.sourceStatus&&edge.originalReviewInheritance===false&&edge.proofInheritance===false&&edge.sourceLedgerActivated===false&&Array.isArray(edge.currentUnresolvedSourceEffects)&&edge.currentUnresolvedSourceEffects.every(issue=>original.unresolvedSourceEffects.includes(issue)),'INSERTION_NEW_EDGE_SUBJECT','New-duty edge changes or repeats its original identity/payload/history.');
      const occurrence=edge.originalSourceOccurrenceSet;need(sameRef(occurrence?.artifact,dutiesRef),'INSERTION_NEW_EDGE_OCCURRENCES','New-duty occurrence artifact differs.');
      if(occurrence.originalEntryPointer!==undefined){
        need(occurrence.originalEntryPointer==='/'+index&&occurrence.sourceLocationProperty===(original.primarySourceLocation?'primarySourceLocation':'sourceLocations')&&occurrence.atomicSpansPointer==='/'+index+'/sourceSpans'&&occurrence.contextSourceLocationsPointer===(original.contextSourceLocations?'/'+index+'/contextSourceLocations':null),'INSERTION_NEW_EDGE_OCCURRENCES','New-duty exact source selectors differ.');
        const expected=[];if(original.sourceDecision){const doc=custody.json(original.sourceDecision);for(const [field,array,idField] of [['contextIds','sourceContexts','contextId'],['governingContextContractIds','governingContextContracts','contextId'],['crossReferenceIds','crossReferenceInteractions','interactionId']])for(const id of original[field]??[]){const j=doc[array].findIndex(row=>row[idField]===id);need(j>=0,'INSERTION_NEW_EDGE_OCCURRENCES','Original graph reference unresolved.');expected.push({artifact:{path:original.sourceDecision.path,sha256:original.sourceDecision.sha256},jsonPointer:'/'+array+'/'+j,entrySha256:valueSha(doc[array][j])});}}
        const refs=occurrence.contextGraphReferences??[];need(refs.length===expected.length&&refs.every((ref,i)=>sameRef(ref.artifact,expected[i].artifact)&&ref.jsonPointer===expected[i].jsonPointer&&ref.entrySha256===expected[i].entrySha256),'INSERTION_NEW_EDGE_OCCURRENCES','Original counted context/governor/cross-reference graph differs.');
      }else need(occurrence.sourceSpansPointer==='/'+index+'/sourceSpans'&&occurrence.contextSourceLocationsPointer==='/'+index+'/contextSourceLocations'&&occurrence.primarySourceLocationPointer==='/'+index+'/primarySourceLocation','INSERTION_NEW_EDGE_OCCURRENCES','New-duty occurrence selectors differ.');
      need(Array.isArray(edge.verifiedSourcePassageKeys),'INSERTION_NEW_EDGE_EVIDENCE','Source passage occurrence inventory missing.');for(const key of edge.verifiedSourcePassageKeys){const passage=evidence.sourcePassages[key],sourceSha=passage?.artifact?.sha256??passage?.sourceSha256;need(passage&&[map.baseSha256,map.currentSha256].includes(sourceSha),'INSERTION_NEW_EDGE_EVIDENCE','Source passage authority is missing.');sourcePassage({...passage,role:sourceSha===map.baseSha256?'BASE_SOURCE':'SUCCESSOR_SOURCE',sourceSha256:sourceSha},map);}
      const governorRef=edge.resolutionEvidenceReference?.governor;need((root.requiredTypedGovernors??[root.requiredTypedGovernor]).some(ref=>sameRef(governorRef,ref))&&[...freeze.inputs,...freeze.outputs].some(ref=>sameRef(ref,governorRef)),'INSERTION_NEW_EDGE_GOVERNOR','New-duty layer does not pin its exact technical resolution.');
      const governor=technicalGovernor(governorRef,custody,map,original.normativeRequirementId,index,{edge,original}),resolved=original.unresolvedSourceEffects.filter(issue=>!edge.currentUnresolvedSourceEffects.includes(issue));need(resolved.length>0&&resolved.every(issue=>issue===governor.link.issueResolution?.issueId),'INSERTION_NEW_EDGE_ISSUE','Technical resolution discharges another issue.');
      let birth=null,currentId=edge.successorNormativeRequirementId;
      if(edge.successorDisposition==='RETAINED')need(currentId===original.normativeRequirementId&&edge.effectiveGovernorLink===null&&edge.resolutionEvidenceReference.role==='CONFIRMS_EXPLICITLY_PRESERVED_PREDICATE_WITHOUT_SCOPE_EXPANSION'&&!edge.identityPreimage,'INSERTION_NEW_EDGE_RETAINED','Retained edge adds effective scope or changes identity.');
      else{
        need(edge.successorDisposition==='CHANGED'&&sameRef(edge.effectiveGovernorLink,governorRef)&&edge.resolutionEvidenceReference.role==='CONTROLLING_EFFECTIVE_SCOPE','INSERTION_NEW_EDGE_CHANGED','Changed new duty lacks controlling typed governor.');birth=edge.identityPreimage;
        need(birth?.schema==='closed-loop-attributed-new-amendment-scope-identity/1'&&birth.successorSourceSha256===map.currentSha256&&birth.priorNewDutyId===original.normativeRequirementId&&equal(birth.priorEntryEvidence,reference)&&birth.statement===original.statement&&equal(birth.originalSourceOccurrenceSet,occurrence)&&sameRef(birth.explicitTechnicalGovernor,governorRef)&&birth.sourceDecision===edge.independentReason&&nonblank(birth.relationship)&&edge.identityPreimageSha256===valueSha(birth)&&currentId==='NREQ-'+valueSha(birth).slice(0,32)&&!duties.some(row=>row.normativeRequirementId===currentId),'INSERTION_NEW_EDGE_IDENTITY','Attributed new-duty fresh identity/preimage differs.');
      }
      states.set(index,{currentId,birth,edge:structuredClone(edge),governor:edge.successorDisposition==='CHANGED'?governor:null,diagnosticResolution:governor,remainingIssues:structuredClone(edge.currentUnresolvedSourceEffects),evidenceReference:structuredClone(root.exactEvidence),layer:structuredClone(layer)});
    }
  }
  return states;
}
function projectCurrentDirectContexts(entries){
  const decisions=[],operativeByLine=new Map,seen=new Set;
  for(const row of entries.filter(row=>row.entryKind==='SOURCE_CONTEXT'&&!row.continuationProvenance?.originalEntry)){
    const classification=row.contextClassification.classification,record=row.continuationProvenance?.sourceRecord;
    need(record&&classification===(record.classification??'STRUCTURAL_REQUIREMENT_CONTEXT')&&!seen.has(row.normativeRequirementId),'INSERTION_CURRENT_CONTEXT_IDENTITY','Current context identity/classification is absent, changed or repeated.');seen.add(row.normativeRequirementId);
    need(['STRUCTURAL_REQUIREMENT_CONTEXT','HISTORICAL_NONNORMATIVE_CONTEXT'].includes(classification),'INSERTION_CURRENT_CONTEXT_IDENTITY','Unknown current context role.');
    const declaredRanges=(record.governingOccurrenceSets??[]).map(ref=>[ref.startLine,ref.endLine]);if(record.governingScope)declaredRanges.push([record.governingScope.startLine,record.governingScope.endLine]);
    if(classification==='STRUCTURAL_REQUIREMENT_CONTEXT'&&declaredRanges.length)need(equal(row.contextClassification.governingSourceRanges,declaredRanges),'INSERTION_CURRENT_CONTEXT_PROJECTION','Current direct membership differs from its exact reviewed occurrence set.');
    if(classification==='HISTORICAL_NONNORMATIVE_CONTEXT')need(row.contextClassification.governingNormativeRequirementIds.length===0,'INSERTION_CURRENT_CONTEXT_PROJECTION','Historical context cannot supply operative members.');
    const line=row.sourceLocation.startLine,mapping=classification==='STRUCTURAL_REQUIREMENT_CONTEXT'?{resolvedClassification:classification,governingSourceRanges:structuredClone(row.contextClassification.governingSourceRanges),reviewedCurrentDecision:structuredClone(record)}:null;
    if(mapping){if(operativeByLine.has(line))need(equal(operativeByLine.get(line).governingSourceRanges,mapping.governingSourceRanges),'INSERTION_CURRENT_CONTEXT_CONFLICT','Two operative source decisions disagree on one current context line.');else operativeByLine.set(line,mapping);}
    decisions.push({schema:'closed-loop-current-direct-context-projection/1',normativeRequirementId:row.normativeRequirementId,sourceContextIdentity:row.continuationProvenance.sourceContextIdentity,sourceLine:line,projectionKind:mapping?'REVIEWED_DIRECT_ATOMIC_MEMBERSHIP':'HISTORICAL_CONTEXT_WITHOUT_GOVERNING_EDGE',mapping,reviewedCurrentDecision:structuredClone(record),contextChainInferred:false});
  }
  return decisions;
}
function validateProjectedGoverningOccurrences(entries,projection){
  // The original graph retains its original context-chain, component and
  // historical rules. New direct memberships cannot become implicit chains.
  const atoms=entries.filter(row=>row.entryKind==='ATOMIC_OBLIGATION'),originalContexts=entries.filter(row=>row.entryKind==='SOURCE_CONTEXT'&&row.continuationProvenance?.originalEntry);
  validateAtomicGoverningOccurrences([...atoms,...originalContexts],projection);
  const expected=projectCurrentDirectContexts(entries),actual=projection.currentDirectContextDecisions;
  need(equal(actual,expected),'INSERTION_CURRENT_CONTEXT_PROJECTION','Current direct context population, identity, source or membership differs.');
  const byId=new Map(entries.map(row=>[row.normativeRequirementId,row]));
  for(const decision of actual){
    if(decision.projectionKind==='HISTORICAL_CONTEXT_WITHOUT_GOVERNING_EDGE')continue;
    const row=byId.get(decision.normativeRequirementId);
    validateAtomicGoverningOccurrences([...atoms,row],{contextResolution:{mappings:new Map([[decision.sourceLine,decision.mapping]])},componentResolution:null,reconciliation:{requirementIdentityCrosswalk:[]},relocations:null});
  }
}
function projectOriginalGoverningGraph(validatedBase,base,map,idMap,entries,blocked){
  const byId=new Map(entries.map(row=>[row.normativeRequirementId,row])),oldAtoms=base.entries.filter(row=>row.entryKind==='ATOMIC_OBLIGATION'),oldByKey=new Map;
  for(const row of oldAtoms){if(!oldByKey.has(row.atomicObligation.key))oldByKey.set(row.atomicObligation.key,[]);oldByKey.get(row.atomicObligation.key).push(row);}
  const currentTarget=key=>{const originals=oldByKey.get(key)??[];need(originals.length===1,'INSERTION_CURRENT_COMPONENT_KEY','Original component key is absent or ambiguous.');return byId.get(idMap.get(originals[0].normativeRequirementId));};
  const oldComponents=loadAtomicComponentReconciliation(base.reconciliation.componentReconciliation,{readFile:file=>validatedBase.readOriginalFile(file),sourceBytes:validatedBase.originalSource(),specificationPath:map.specificationPath});
  const retainedRanges=ranges=>(ranges??[]).flatMap(([a,b])=>map.forwardLineRange(a,b));
  const retainedAnchors=anchors=>(anchors??[]).flatMap(anchor=>map.forwardLineRange(anchor.startLine,anchor.endLine).map(([startLine,endLine])=>{const lines=mapData(map).current.lines.slice(startLine-1,endLine),text=lines.join('\n');return {...anchor,startLine,endLine,...(Object.hasOwn(anchor,'exactText')?{exactText:text}:{}),...(Object.hasOwn(anchor,'sha256Utf8WithoutTrailingLf')?{sha256Utf8WithoutTrailingLf:sha(Buffer.from(text))}:{}),...(Object.hasOwn(anchor,'firstLineText')?{firstLineText:lines[0],lastLineText:lines.at(-1)}:{}),originalOccurrence:structuredClone(anchor)};}));
  const contextMappings=new Map;for(const [line,record] of base.contextResolution?.mappings??[]){const target=map.forwardLine(line);contextMappings.set(target,{resolvedClassification:record.resolvedClassification,governingSourceRanges:retainedRanges(record.governingSourceRanges),additionalSupportingSourceRanges:retainedRanges(record.additionalSupportingSourceRanges),exactSourceAnchors:retainedAnchors(record.exactSourceAnchors),governedRangeEvidence:retainedAnchors(record.governedRangeEvidence),originalDecision:structuredClone(record),originalSourceSha256:map.baseSha256});}
  const currentDirectContextDecisions=projectCurrentDirectContexts(entries);
  const mappings=new Map,snapshots=new Map,unresolved=[];
  if(oldComponents){
    for(const [key,original] of oldComponents.snapshots){const target=currentTarget(key);if(!target){unresolved.push({kind:'COMPONENT_SNAPSHOT',originalKey:key});continue;}const contexts=original.exactSupportingContextSourceLocations.map(ref=>({...ref,startLine:map.forwardLine(ref.startLine),endLine:map.forwardLine(ref.endLine)})),spans=original.sourceSpans.map(span=>{const parts=map.forwardByteRange(span.startByte,span.endByte);need(parts.length===1,'INSERTION_CURRENT_COMPONENT_SPAN','Atomic component span unexpectedly crosses insertion.');return {...span,startByte:parts[0].startByte,endByte:parts[0].endByte};});
      const projected={...original,atomicKey:target.atomicObligation.key,primarySourceLine:map.forwardLine(original.primarySourceLine),sourceSpans:spans,exactSupportingContextSourceLocations:contexts};projected.scopeSha256=atomicObligationSha256({key:projected.atomicKey,statement:projected.statement,sourceSpans:spans,contextSourceLocations:contexts});projected.originalSnapshot=structuredClone(original);need(!snapshots.has(projected.atomicKey),'INSERTION_CURRENT_COMPONENT_COLLISION','Projected component key repeats.');snapshots.set(projected.atomicKey,projected);
    }
    for(const [line,original] of oldComponents.mappings){const allKeys=[...original.targetAtomicKeys,...(original.proposedNewScopes??[]).map(row=>row.proposedAtomicKey)],missing=allKeys.filter(key=>!currentTarget(key));if(missing.length){unresolved.push({kind:'COMPONENT_MAPPING',originalLine:line,missingKeys:missing});continue;}
      const keyOf=key=>currentTarget(key).atomicObligation.key,projected={...original,sourceLine:map.forwardLine(line),exactSourceAnchors:retainedAnchors(original.exactSourceAnchors),selectedScopeEvidence:(original.selectedScopeEvidence??[]).map(ref=>({...ref,atomicKey:keyOf(ref.atomicKey),scopeSha256:snapshots.get(keyOf(ref.atomicKey)).scopeSha256,originalEvidence:structuredClone(ref)})),targetAtomicKeys:original.targetAtomicKeys.map(keyOf),proposedNewScopes:(original.proposedNewScopes??[]).map(row=>({...row,proposedAtomicKey:keyOf(row.proposedAtomicKey)})),scopeTextChanges:(original.scopeTextChanges??[]).map(row=>({...row,atomicKey:keyOf(row.atomicKey)})),originalMapping:structuredClone(original)};mappings.set(projected.sourceLine,projected);
    }
  }
  const relocationRef=base.reconciliation.historicalSourceRelocationCrosswalk,oldRelocations=relocationRef?JSON.parse(validatedBase.readOriginalFile(relocationRef.path)):null,relocations=new Map;
  for(const row of oldRelocations?.crosswalk??[])relocations.set(row.priorNormativeRequirementId,{...row,...(Number.isSafeInteger(row.targetSourceLine)?{targetSourceLine:map.forwardLine(row.targetSourceLine)}:{}),originalRelocation:structuredClone(row)});
  const crosswalk=base.reconciliation.requirementIdentityCrosswalk.map(original=>{const ids=original.currentNormativeRequirementIds.map(id=>idMap.get(id)).filter(id=>byId.get(id)?.entryKind==='ATOMIC_OBLIGATION');const oldLine=oldRelocations?.crosswalk.find(row=>row.priorNormativeRequirementId===original.priorNormativeRequirementId)?.targetSourceLine??original.priorSourceLocation.startLine;
    if(ids.length&&!relocations.has(original.priorNormativeRequirementId))relocations.set(original.priorNormativeRequirementId,{targetSourceLine:map.forwardLine(oldLine),originalSourceLine:oldLine});
    return {...original,currentNormativeRequirementIds:ids,originalCrosswalk:structuredClone(original)};
  });
  if(unresolved.length)blocked.push({kind:'UNRESOLVED_ORIGINAL_GOVERNING_TARGET',unresolved,reason:'Original typed occurrence targets lack current reviewed identity decisions.'});
  return {currentDirectContextDecisions,contextResolution:{mappings:contextMappings},componentResolution:oldComponents?{mappings,snapshots}:null,reconciliation:{requirementIdentityCrosswalk:crosswalk},relocations,provenance:{currentDirectContextDecisions:structuredClone(currentDirectContextDecisions),originalContextReconciliation:base.reconciliation.contextReconciliation??null,originalComponentReconciliation:base.reconciliation.componentReconciliation??null,originalHistoricalRelocation:relocationRef??null,originalSourceSha256:map.baseSha256,currentSourceSha256:map.currentSha256,reviewRelabeled:false}};
}
function validateSourceMeaningInput(input,custody,map,facts){
  if(input===null)return {status:'NOT_SUPPLIED',originalFindings:structuredClone(facts.sourceContractFindings),resolvedMeanings:[],currentFindingMutation:false};
  keys(input,['map','review','technicalInput','technicalAcceptance'],'INSERTION_MEANING_INPUT');
  const meaning=custody.json(input.map),review=custody.json(input.review),technical=custody.json(input.technicalInput),acceptance=custody.json(input.technicalAcceptance);
  need(meaning.schema==='closed-loop-additive-five-finding-source-meaning-map/1'&&review.schema==='closed-loop-independent-five-finding-meaning-map-successor-review/1'&&review.status==='ACCEPT_BOUNDED_SOURCE_MEANING_MAP'&&sameRef(review.acceptedMap,input.map)&&nonblank(review.reviewer)&&review.reviewer!==meaning.actorId,'INSERTION_MEANING_REVIEW','Exact bounded source-meaning acceptance is absent or not distinct.');
  need(technical.schema==='closed-loop-v4-technical-reference-adoption-input/1'&&acceptance.schema==='closed-loop-independent-technical-input-composition-boundary-review/1'&&acceptance.status==='ACCEPT_ADDITIVE_TECHNICAL_INPUT_AND_DEPENDENCY_READY_PREPARATION'&&acceptance.recordSha256===input.technicalInput.sha256,'INSERTION_MEANING_TECHNICAL_REVIEW','Technical input lacks its exact attributed acceptance.');
  const original=new Map(facts.sourceContractFindings.map(row=>[row.reconciliationId??row.id,row])),seen=new Set;
  const verifySpan=ref=>{
    const role=ref.role??(ref.artifactSha256===map.baseSha256?'BASE_SOURCE':ref.artifactSha256===map.currentSha256?'SUCCESSOR_SOURCE':'TECHNICAL_TEXT');
    const bytes=role==='BASE_SOURCE'?mapData(map).base.bytes:role==='SUCCESSOR_SOURCE'?mapData(map).current.bytes:custody.read({path:ref.path??ref.artifactPath,sha256:ref.artifactSha256});
    const expected=role==='BASE_SOURCE'?map.baseSha256:role==='SUCCESSOR_SOURCE'?map.currentSha256:sha(bytes);
    need(ref.artifactSha256===expected&&integer(ref.startByte)&&integer(ref.endByteExclusive)&&ref.endByteExclusive>ref.startByte&&ref.endByteExclusive<=bytes.length,'INSERTION_MEANING_SPAN','Source-meaning span source or boundary differs.');
    const exact=bytes.subarray(ref.startByte,ref.endByteExclusive);need(sha(exact)===ref.spanSha256IncludingLineTerminators&&(ref.text===undefined||ref.text===exact.toString('utf8')),'INSERTION_MEANING_SPAN','Source-meaning span bytes differ.');
    const lines=bytes.toString('utf8').split('\n');let start=0;for(let i=0;i<ref.startLine-1;i++)start+=Buffer.byteLength(lines[i])+1;let end=start;for(let i=ref.startLine-1;i<ref.endLine;i++)end+=Buffer.byteLength(lines[i])+1;need(start===ref.startByte&&end===ref.endByteExclusive,'INSERTION_MEANING_LINES','Source-meaning line/byte range differs.');
  };
  for(const row of meaning.findings){
    const old=original.get(row.originalFindingId);need(old&&!seen.has(row.originalFindingId)&&equal(old,row.originalFindingExact)&&row.originalFindingEvidence?.findingSha256===valueSha(old)&&row.originalFindingRewritten===false&&row.priorProofInheritance===false&&row.wholeApplicationProofPrerequisiteAdded===false&&row.implementationDisposition==='UNKNOWN_NOT_EXAMINED'&&row.proofDisposition==='UNKNOWN_NOT_EXAMINED'&&row.proposedSourceMeaningDisposition==='RESOLVED_WITHIN_EXACT_BOUNDED_REVIEWED_INPUT_SET','INSERTION_MEANING_FINDING','Meaning map omits, changes or promotes an original finding.');seen.add(row.originalFindingId);
    const walk=value=>{if(!value||typeof value!=='object')return;if(value.artifactSha256&&value.startByte!==undefined&&value.endByteExclusive!==undefined&&value.spanSha256IncludingLineTerminators)verifySpan(value);for(const child of Object.values(value))walk(child);};walk(row);
    if(row.technicalInput){need(row.technicalInput.inputSha256===input.technicalInput.sha256,'INSERTION_MEANING_TECHNICAL_ID','Finding refers to another technical input.');const binding=technical.issueBindings.filter(x=>x.issueId===row.technicalInput.issueId&&x.resolutionId===row.technicalInput.resolutionId);need(binding.length===1&&binding[0].relationshipType===row.technicalInput.relationshipType&&binding[0].proposalSpan.spanSha256IncludingLineTerminators===row.technicalInput.exactText.spanSha256IncludingLineTerminators,'INSERTION_MEANING_TECHNICAL_BINDING','Technical issue/relationship/text binding differs.');}
  }
  need(seen.size===original.size,'INSERTION_MEANING_COVERAGE','Every original finding needs one exact bounded meaning record.');
  return {status:'REVIEWED_BOUNDED_SOURCE_MEANINGS',originalFindings:structuredClone(facts.sourceContractFindings),resolvedMeanings:structuredClone(meaning.findings),independentAcceptance:structuredClone(review),technicalInputReference:structuredClone(input.technicalInput),technicalAcceptance:structuredClone(acceptance),currentFindingMutation:false,implementationConformance:false,proofInheritance:false};
}

function applyDeclaredCurrentIdentityOverlays(chain,states,{custody,map,base,reconciler,inventory,occurrenceRef}){
  need(chain.schema==='closed-loop-source-composition-consumer-chain/2'&&chain.actorId===reconciler&&sameRef(chain.preservedPriorInventory,inventory.reference)&&chain.originalPredecessorDenominator===base.entries.length&&chain.proofPromotion===false&&chain.sourceActivationClaim===false,'INSERTION_CURRENT_CHAIN','Current identity chain authority differs.');
  const seenLayers=new Set,seenSubjects=new Set,history=[];
  for(const [order,layer] of chain.orderedCurrentIdentityOverlays.entries()){
    need(layer.order===order+1&&!seenLayers.has(layer.freeze.path),'INSERTION_CURRENT_OVERLAY_ORDER','Current scope overlays repeat or reorder.');seenLayers.add(layer.freeze.path);
    const freeze=custody.json(layer.freeze),root=custody.json(layer.reconciliation),records=custody.json(layer.records);
    need(freeze.status==='FROZEN'&&freeze.outputs.some(ref=>sameRef(ref,layer.reconciliation))&&freeze.outputs.some(ref=>sameRef(ref,layer.records))&&sameRef(root.records,layer.records)&&root.sourceLedgerActivated===false&&root.proofPromoted===false&&(root.validation?.predecessorDenominator??root.validation?.originalPredecessorDenominator)===base.entries.length&&(root.validation.predecessorPopulationDelta?equal(root.validation.predecessorPopulationDelta,{RETAINED:0,CHANGED:0,BLOCKED:0}):equal(root.validation.predecessorPopulationAfter,Object.fromEntries(['RETAINED','CHANGED','BLOCKED'].map(key=>[key,[...states.values()].filter(row=>row.disposition===key).length]))))&&Array.isArray(records)&&records.length===root.validation.entryCount&&records.length===layer.records.memberCount,'INSERTION_CURRENT_OVERLAY_AUTHORITY','Current scope overlay custody/population differs.');
    const exact=custody.json(root.exactEvidence);need(freeze.outputs.some(ref=>sameRef(ref,root.exactEvidence)),'INSERTION_CURRENT_OVERLAY_AUTHORITY','Exact source evidence is not frozen with the overlay.');
    const seen=new Set;
    for(const [index,edge] of records.entries()){
      const original=base.entries[edge.predecessorIndex],id=edge.predecessorNormativeRequirementId,prior=states.get(id),ref=edge.priorCurrentEntryEvidence;
      need(original?.normativeRequirementId===id&&edge.predecessorEntrySha256===valueSha(original)&&prior&&prior.disposition!=='BLOCKED'&&!seen.has(id)&&!seenSubjects.has(id)&&edge.actorId===reconciler&&edge.priorCurrentNormativeRequirementId===prior.currentId&&ref?.entrySha256===valueSha(prior.record)&&sameRef(ref.artifact,prior.reference.artifact)&&ref.jsonPointer===prior.reference.jsonPointer&&equal(custody.selected(ref.artifact,ref.jsonPointer),prior.record),'INSERTION_CURRENT_OVERLAY_PREDECESSOR','Overlay predecessor index, ID or exact current record differs.');seen.add(id);seenSubjects.add(id);
      need(edge.proofInheritance===false&&edge.sourceLedgerActivated!==true&&edge.successorDisposition===prior.disposition,'INSERTION_CURRENT_OVERLAY_PROMOTION','Overlay changes population/proof disposition.');
      const reference={artifact:layer.records,jsonPointer:'/'+index},statement=original.atomicObligation?.statement??original.controllingText;
      let next={...prior,record:structuredClone(edge),reference,history:[...prior.history,reference],historicalState:structuredClone({record:prior.record,qualifiers:prior.qualifiers,birthPreimage:prior.birthPreimage,currentId:prior.currentId})};
      if(root.schema==='closed-loop-additive-source-scope-successor/1'){
        need(edge.proposalAdjudication==='ADDITIVE_EFFECTIVE_SCOPE_CORRECTION'&&edge.identityPreimage?.schema==='closed-loop-additive-source-impact-identity/1'&&edge.statementSha256===sha(Buffer.from(statement)),'INSERTION_CURRENT_SCOPE_CORRECTION','Scope correction lacks exact original proposition.');
        const governors=edge.addedGoverningPassageIds.map(id=>{need(exact.sourcePassages?.[id],'INSERTION_CURRENT_SCOPE_CORRECTION','Corrected governor is absent.');return exact.sourcePassages[id];}),checked=governors.map(ref=>sourcePassage(ref,map));
        need(prior.addedGovernors.every(old=>effectiveGovernorOccurrences([old.originalRecord],map).every(occurrence=>effectiveGovernorOccurrences(governors,map).some(current=>equal(current,occurrence)))),'INSERTION_CURRENT_SCOPE_CORRECTION','Correction loses a prior source governor.');
        const birth=edge.identityPreimage,expected={schema:'closed-loop-additive-source-impact-identity/1',sourceSha256:map.currentSha256,predecessorId:id,predecessorEntrySha256:valueSha(original),statement,sourceDecision:birth.sourceDecision,addedGovernors:governors,blockedDetails:edge.blockedInheritedReferenceDetails??[]};
        need(nonblank(birth.sourceDecision)&&equal(birth,expected)&&edge.identityPreimageSha256===valueSha(expected)&&edge.successorNormativeRequirementId==='NREQ-'+valueSha(expected).slice(0,32)&&edge.successorNormativeRequirementId!==prior.currentId,'INSERTION_CURRENT_SCOPE_CORRECTION','Corrected fresh birth identity differs.');
        next={...next,currentId:edge.successorNormativeRequirementId,sourceDecision:birth.sourceDecision,addedGovernors:checked,birthPreimage:structuredClone(birth)};
      }else{
        need(root.schema==='closed-loop-additive-predecessor-technical-reference-resolution/1'&&edge.schema==='closed-loop-attributed-predecessor-edge-reconciliation/1'&&edge.originalStatement===statement&&edge.originalReviewInheritance===false&&edge.implementationStatus==='UNKNOWN'&&edge.testConformance==='UNKNOWN'&&nonblank(edge.independentReason),'INSERTION_CURRENT_EDGE','Typed current edge authority or original proposition differs.');
        const occurrence=edge.originalOccurrenceSetReference,rawOccurrences=custody.selected(occurrence.artifact,occurrence.jsonPointer);
        need(valueSha(rawOccurrences)===occurrence.sha256&&sameRef(edge.originalOccurrenceTransport,occurrenceRef)&&edge.verifiedOriginalOccurrenceBindingCount===prior.occurrenceTransport.length,'INSERTION_CURRENT_EDGE_OCCURRENCES','Typed edge original occurrence set differs.');
        const governorRef=edge.originalAddedGovernorReference,oldGovernorRecord=custody.selected(governorRef.artifact,governorRef.jsonPointer);
        need(valueSha(oldGovernorRecord)===governorRef.sha256&&sameRef(governorRef.artifact,ref.artifact)&&governorRef.jsonPointer.startsWith(ref.jsonPointer+'/'),'INSERTION_CURRENT_EDGE_GOVERNORS','Retained added source governor inventory differs.');
        need(Array.isArray(edge.currentUnresolvedSourceEffects)&&Array.isArray(edge.currentBlockedInheritedReferenceDetails),'INSERTION_CURRENT_EDGE_STATUS','Current semantic effect disposition is absent.');
        if(edge.priorCurrentStatement!==undefined){
          const priorStatement=prior.record.statement??prior.record.originalStatement??statement;
          need(edge.priorCurrentStatement===priorStatement,'INSERTION_CURRENT_STATEMENT_HISTORY','Prior reviewed statement representation differs.');
          const compression=edge.preservedStatementCompression;
          if(compression){
            const statementRef=compression.originalAtomicStatementReference,exactStatement=custody.selected(statementRef.artifact,statementRef.jsonPointer),match=/^Stage (\d+) must include the ([A-Z0-9_]+) field /.exec(statement);
            need(match&&compression.priorCurrentRepresentation===priorStatement&&compression.priorCompressionDeclaration===prior.record.statementCompression&&compression.originalAtomicStatement===statement&&statementRef.jsonPointer==='/entries/'+edge.predecessorIndex+'/atomicObligation/statement'&&exactStatement===statement&&statementRef.valueSha256===valueSha(statement)&&compression.verifiedStage===match[1]&&compression.verifiedField===match[2]&&priorStatement==='FIELD '+match[2],'INSERTION_CURRENT_STATEMENT_HISTORY','Compressed history loses its full exact immutable proposition.');
          }else need(priorStatement===statement,'INSERTION_CURRENT_STATEMENT_HISTORY','Different prior statement lacks its reviewed lossless representation record.');
        }
        const evidenceRefs=edge.resolutionEvidenceReferences??(edge.resolutionEvidenceReference?[edge.resolutionEvidenceReference]:[]),evidenceByIssue=new Map;
        need(evidenceRefs.length>0,'INSERTION_CURRENT_EDGE_GOVERNOR','Technical resolution custody is absent.');
        for(const pin of evidenceRefs){const linked=reviewInput(pin,custody),issue=linked.issueResolution?.issueId;need(linked.schema==='closed-loop-attributed-source-resolution-custody-link/1'&&nonblank(issue)&&!evidenceByIssue.has(issue)&&linked.actorId===reconciler,'INSERTION_CURRENT_EDGE_GOVERNOR','Technical resolution roles or issue identities conflict.');evidenceByIssue.set(issue,{reference:pin,link:linked});}
        let issueScope=null;
        if(edge.perIssueScopeDecisions){
          const scoped=edge.perIssueScopeDecisions;issueScope=custody.selected(scoped.artifact,scoped.jsonPointer);
          need(sameRef(root.independentScopeDecisions,scoped.artifact)&&freeze.outputs.some(pin=>sameRef(pin,scoped.artifact))&&valueSha(issueScope)===scoped.entrySha256&&issueScope.predecessorIndex===edge.predecessorIndex&&issueScope.predecessorId===id&&issueScope.originalStatement===statement&&(!Object.hasOwn(issueScope,'priorReviewedStatement')||issueScope.priorReviewedStatement===(edge.priorCurrentStatement??statement))&&Array.isArray(issueScope.edges)&&issueScope.edges.length===evidenceByIssue.size&&new Set(issueScope.edges.map(row=>row.issueId)).size===issueScope.edges.length,'INSERTION_CURRENT_EDGE_SCOPE','Per-issue source decision custody or exact subject differs.');
          for(const scope of issueScope.edges){const evidence=evidenceByIssue.get(scope.issueId);need(evidence&&['ACTUAL_REFERENCE_GOVERNS_CURRENT_SCOPE','DIAGNOSTIC_QUALIFIER_ONLY_NO_EFFECTIVE_SCOPE_CHANGE'].includes(scope.decision)&&nonblank(scope.independentReason)&&equal(scope.exactTechnicalSpan,evidence.link.technicalResolution?.span)&&(scope.decision!=='ACTUAL_REFERENCE_GOVERNS_CURRENT_SCOPE'||nonblank(scope.effectiveBranchCondition)),'INSERTION_CURRENT_EDGE_SCOPE','Per-issue decision loses its exact technical span or branch.');}
          const hasActual=issueScope.edges.some(row=>row.decision==='ACTUAL_REFERENCE_GOVERNS_CURRENT_SCOPE');need(hasActual===(edge.edgeDecision==='ACTUAL_REFERENCE_GOVERNS_CURRENT_SCOPE'),'INSERTION_CURRENT_EDGE_SCOPE','Aggregate source disposition conflicts with individual issues.');
        }

        if(edge.edgeDecision==='DIAGNOSTIC_QUALIFIER_ONLY_NO_EFFECTIVE_SCOPE_CHANGE'){
          need(edge.edgeSuccessorDisposition==='RETAINED'&&edge.successorNormativeRequirementId===prior.currentId&&edge.effectiveGovernorLink===null&&!edge.identityPreimage&&!edge.identityPreimageSha256,'INSERTION_CURRENT_EDGE_DIAGNOSTIC','Diagnostic historical qualification cannot change effective identity or add a governor.');
          // Pin the reviewed explanatory custody without installing it as scope.
          next.diagnosticResolution=structuredClone(edge);
        }else{
          need(edge.edgeDecision==='ACTUAL_REFERENCE_GOVERNS_CURRENT_SCOPE'&&edge.edgeSuccessorDisposition==='CHANGED'&&edge.effectiveGovernorLink,'INSERTION_CURRENT_EDGE_GOVERNOR','Actual effective governor is absent or has another role.');
          const technical=technicalGovernor(edge.effectiveGovernorLink,custody,map,id,edge.predecessorIndex),birth=edge.identityPreimage;
          const actualComponents=technical.components??[technical],actualIssues=actualComponents.map(row=>row.link.issueResolution.issueId);
          need(actualComponents.every(row=>sameRef(row.reference,evidenceByIssue.get(row.link.issueResolution.issueId)?.reference))&&(!issueScope||equal(actualIssues.slice().sort(),issueScope.edges.filter(row=>row.decision==='ACTUAL_REFERENCE_GOVERNS_CURRENT_SCOPE').map(row=>row.issueId).sort()))&&(!issueScope||actualComponents.every(row=>sameRef(row.link.individualEffectiveScopeDecisions,edge.perIssueScopeDecisions.artifact))),'INSERTION_CURRENT_EDGE_GOVERNOR','Actual effective scope omits or substitutes an accepted component.');
          const expected={schema:'closed-loop-attributed-predecessor-edge-identity/1',successorSourceSha256:map.currentSha256,predecessorId:id,predecessorEntrySha256:valueSha(original),priorCurrentId:prior.currentId,priorCurrentEntrySha256:valueSha(prior.record),statement,retainedAddedGovernorSetSha256:governorRef.sha256,typedEffectiveGovernor:edge.effectiveGovernorLink,scopeDecision:edge.perIssueScopeDecisions??edge.independentReason,...(edge.effectiveBranchCondition!==undefined?{effectiveBranchCondition:edge.effectiveBranchCondition}:{})};
          need(equal(birth,expected)&&edge.identityPreimageSha256===valueSha(expected)&&edge.successorNormativeRequirementId==='NREQ-'+valueSha(expected).slice(0,32)&&edge.successorNormativeRequirementId!==prior.currentId,'INSERTION_CURRENT_EDGE_IDENTITY','Typed effective-scope birth differs.');
          next={...next,currentId:edge.successorNormativeRequirementId,sourceDecision:edge.independentReason,technicalGovernor:technical,birthPreimage:structuredClone(birth)};
        }
        next.currentSourceEffects=structuredClone(edge.currentUnresolvedSourceEffects);next.currentBlockedSourceEffects=structuredClone(edge.currentBlockedInheritedReferenceDetails);
      }
      states.set(id,next);history.push({predecessorId:id,priorCurrentId:prior.currentId,currentId:next.currentId,reference});
    }
  }
  const finalIdentities=[...states.values()].map(row=>[row.predecessorId,row.currentId,row.disposition]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  need(digest(chain.currentIdentityDigest)&&valueSha(finalIdentities)===chain.currentIdentityDigest,'INSERTION_CURRENT_IDENTITY_DIGEST','Declared final current identities omit or substitute a reviewed transition.');
  const citations=[];
  for(const layer of chain.citationOnlyOverlays??[]){
    if(layer.record){
      const manifest=custody.json(layer.manifest),row=layer.record,ref={path:row.logicalPath,sha256:row.sha256,byteLength:row.byteLength},record=custody.json(ref);
      need(!layer.freeze&&layer.populationDelta===0&&layer.identityDelta===0&&manifest.schema==='closed-loop-source-reconciliation-compressed-deliverable/1'&&manifest.noSemanticIdentityChange===true&&manifest.archivedLogicalFiles?.filter(item=>equal(item,row)).length===1&&record.schema==='closed-loop-source-citation-only-addendum/1'&&record.status==='FROZEN_COUNT_CAPTION_CLARIFICATION'&&record.semanticChange===false&&record.proofPromoted===false&&Array.isArray(record.exactJsonPointerCorrections),'INSERTION_CURRENT_CITATION','Count-caption custody or no-effect declaration differs.');
      const preserved=custody.json(record.preservedOriginalManifest);need(preserved.schema==='closed-loop-source-reconciliation-compressed-deliverable/1','INSERTION_CURRENT_CITATION','Original count-caption custody is absent.');
      for(const change of record.exactJsonPointerCorrections){const value=custody.selected(change.artifact,change.jsonPointer);need(equal(value,change.oldValue)&&valueSha(value)===change.oldValueSha256&&valueSha(change.replacementValue)===change.newValueSha256&&typeof value==='string'&&change.replacementValue===value.replace('15 current mechanisms','13 current mechanisms')&&['/sourceReadReview','/reviewAttestation'].includes(change.jsonPointer),'INSERTION_CURRENT_CITATION','Count-caption patch changes another source value.');}
      citations.push({reference:ref,record});continue;
    }
    const freeze=custody.json(layer.freeze),ref=oneRef(freeze.outputs,'citation-correction.json'),record=custody.json(ref);need(freeze.status==='FROZEN'&&record.schema==='closed-loop-additive-source-citation-correction/1'&&layer.populationDelta===0&&layer.identityDelta===0,'INSERTION_CURRENT_CITATION','Citation authority cannot change source identity.');
    for(const change of record.changes){const sourceRef={path:change.artifact.logicalPath,sha256:change.artifact.sha256};need(equal(custody.selected(sourceRef,change.jsonPointer),change.expectedPriorValue),'INSERTION_CURRENT_CITATION','Citation correction does not bind the exact historical value.');if(typeof change.replacementValue==='object')sourcePassage(change.replacementValue,map);else need(nonblank(change.replacementValue),'INSERTION_CURRENT_CITATION','Citation correction is empty.');}citations.push({reference:ref,record});}
  return {history,citations};
}
function validateAdditiveLayerAttribution(layer,freeze,custody,actorId){
  const judgment=freeze.schema==='closed-loop-source-judgment-reconciliation-freeze/1',technical=freeze.schema==='closed-loop-attributed-source-resolution-reconciliation-freeze/1';
  if(!judgment&&!technical){need(freeze.actorId===actorId,'INSERTION_DELTA_LAYER_ACTOR','Additive layer changes reconciler attribution.');return;}
  need(freeze.status==='FROZEN'&&(!Object.hasOwn(freeze,'actorId')||freeze.actorId===actorId),'INSERTION_DELTA_LAYER_ACTOR','Special freeze status or explicit reconciler differs.');
  const roots=freeze.outputs.filter(ref=>ref.path.endsWith('/reconciliation.json'));
  const historical=Object.hasOwn(layer,'auxiliaryFrozenArtifacts'),selectors=historical?(Array.isArray(layer.auxiliaryFrozenArtifacts)?layer.auxiliaryFrozenArtifacts.filter(ref=>ref.path.endsWith('/reconciliation.json')):[]):[layer.reconciliation];
  need((!historical||!Object.hasOwn(layer,'reconciliation'))&&roots.length===1&&selectors.length===1&&sameRef(roots[0],selectors[0])&&Array.isArray(layer.decisionArrays)&&layer.decisionArrays.length===1,'INSERTION_DELTA_LAYER_ATTRIBUTION','Special attribution root or selected decision arrays differ.');
  const root=custody.json(roots[0]),variants={
    'closed-loop-distinct-source-status-judgment-reconciliation/1':{kind:'JUDGMENT',status:'FROZEN_TWO_RESOLVED_ONE_PENDING',field:'records'},
    'closed-loop-attributed-population-resolution-reconciliation/1':{kind:'POPULATION',status:'FROZEN_ADDITIVE_LINKED_TECHNICAL_GOVERNOR_AND_CONDITIONAL_CHANGED_IDENTITY',field:'record'},
    'closed-loop-attributed-xml-root-resolution-reconciliation/1':{kind:'XML',status:'FROZEN_SEVEN_CONDITIONAL_CHANGED_IDENTITIES',field:'record'}
  },variant=variants[root.schema];
  need(variant&&(judgment?variant.kind==='JUDGMENT':variant.kind!=='JUDGMENT')&&root.status===variant.status&&root.proofPromoted===false&&(variant.kind==='JUDGMENT'||root.sourceLedgerActivated===false),'INSERTION_DELTA_LAYER_ATTRIBUTION','Unsupported special reconciliation schema, status or claim.');
  need((variant.kind==='XML'?!Object.hasOwn(root,'actorId')||root.actorId===actorId:root.actorId===actorId),'INSERTION_DELTA_LAYER_ACTOR','Special reconciliation names another actor.');
  const ref=layer.decisionArrays[0];need(sameRef(root[variant.field],ref)&&freeze.outputs.some(output=>sameRef(output,ref)),'INSERTION_DELTA_LAYER_ATTRIBUTION','Special root does not bind the complete frozen selected array.');
  const rows=custody.json(ref);need(Array.isArray(rows)&&rows.length===ref.memberCount,'INSERTION_DELTA_LAYER_COUNT','Special attribution selected member count differs.');
  need(variant.kind!=='XML'||rows.length>0,'INSERTION_DELTA_LAYER_ACTOR','XML attribution requires an actual selected reconciler member.');
  for(const row of rows)need((variant.kind!=='XML'||row.actorId===actorId)&&(!Object.hasOwn(row,'actorId')||row.actorId===actorId)&&(!Object.hasOwn(row,'reconciliationActorId')||row.reconciliationActorId===actorId),'INSERTION_DELTA_LAYER_ACTOR','Special selected member lacks or conflicts with its reconciler attribution.');
  if(variant.kind!=='JUDGMENT'){const ref=root.effectiveGovernorLink;need(ref&&freeze.outputs.some(output=>sameRef(output,ref))&&rows.every(row=>sameRef(row.effectiveGovernorLink,ref)),'INSERTION_DELTA_LAYER_ATTRIBUTION','Technical root does not bind its selected frozen governor.');const governor=custody.json(ref);need(governor.actorId===actorId,'INSERTION_DELTA_LAYER_ACTOR','Special technical governor names another reconciler.');}
}
function validateDeclaredAdditiveLayerChain(declared,consumed,facts){
  need(Array.isArray(declared)&&declared.length===consumed.length&&facts.length===consumed.length,'INSERTION_CURRENT_CHAIN','Declared additive layer population differs.');
  const oldKeys=['order','name','freeze','decisionArrays','auxiliaryFrozenArtifacts'].sort(),newKeys=['order','name','freeze','decisionArrays','reconciliation','queueDelta','sourceDecisionArtifacts','combinedCountsAfterLayer'].sort();
  for(let i=0;i<consumed.length;i++){
    const old=consumed[i],current=declared[i];if(equal(current,old))continue;
    need(old&&current&&equal(Object.keys(old).sort(),oldKeys)&&equal(Object.keys(current).sort(),newKeys)&&['order','name','freeze','decisionArrays'].every(key=>equal(old[key],current[key])),'INSERTION_CURRENT_CHAIN','Historical layer identity, order, arrays or representation differs.');
    const auxiliary=old.auxiliaryFrozenArtifacts,outputs=facts[i].outputs;
    need(Array.isArray(auxiliary)&&new Set(auxiliary.map(ref=>ref.path)).size===auxiliary.length&&auxiliary.every(ref=>outputs.filter(output=>equal(output,ref)).length===1),'INSERTION_CURRENT_CHAIN','Historical auxiliary roles are duplicated, omitted from freeze or altered.');
    const named=name=>auxiliary.filter(ref=>ref.path.endsWith('/'+name)),root=named('reconciliation.json'),queue=named('combined-queue-delta.json');
    const sourceNames=['shared-evidence.json','mechanism-adjudication.json','effective-governor-link.json'],sources=auxiliary.filter(ref=>sourceNames.some(name=>ref.path.endsWith('/'+name))),expectedSources=outputs.filter(ref=>sourceNames.some(name=>ref.path.endsWith('/'+name))),byPath=rows=>[...rows].sort((a,b)=>a.path.localeCompare(b.path));
    need(root.length===1&&queue.length===1&&named('reconcile.py').length<=1&&auxiliary.length===root.length+queue.length+sources.length+named('reconcile.py').length&&sourceNames.every(name=>named(name).length<=1)&&equal(current.reconciliation,root[0])&&equal(current.queueDelta,queue[0])&&equal(current.sourceDecisionArtifacts,sources)&&equal(byPath(sources),byPath(expectedSources))&&sameRef(current.queueDelta,facts[i].queueReference)&&equal(current.combinedCountsAfterLayer,facts[i].combinedCounts),'INSERTION_CURRENT_CHAIN','Enriched root, queue, governor roles or recomputed counts differ.');
  }
}
export function loadApprovedInsertionAtomicContinuation(descriptor,{readFile=readAtomicEvidenceBytes}={}){
  need(descriptor?.semanticDelta,'INSERTION_SEMANTIC_DELTA_MISSING','Independent semantic amendment and impact evidence is mandatory.');
  need(descriptor.semanticDelta.status==='RECONCILED'&&descriptor.semanticDelta.draft&&descriptor.semanticDelta.independentReview&&descriptor.semanticDelta.reconciliation,'INSERTION_SEMANTIC_DELTA_UNREVIEWED','A candidate or unreviewed delta cannot activate governance.');
  // Keep all earlier preparation-only calls fail-closed. Only this explicit
  // version admits the new typed, immutable composition input contract.
  need(descriptor.schema===insertionCompositionVersion,'INSERTION_ACTIVATION_NOT_IMPLEMENTED','A complete versioned continuation descriptor is required.');
  const d=JSON.parse(canonical(descriptor));
  keys(d,['schema','base','view','baseView','source','proposal','authority','insertionMap','semanticDelta','additionalLayers','sourceMeaning'],'INSERTION_CONTINUATION_DESCRIPTOR');
  need(d.base?.schema==='closed-loop-insertion-atomic-base/2','INSERTION_CONTINUATION_BASE','Full original semantic/base validation is required.');
  const validatedBase=loadValidatedInsertionAtomicBase(d.base,{readFile}),base=validatedBase.baseData(),facts=validatedBase.originalSemanticFacts();
  need(validatedBase.sourceSemanticValidated&&validatedBase.lineMembershipMaterialized,'INSERTION_CONTINUATION_BASE','The original source owner is incomplete.');
  const custody=compositionCustody(d.view,d.baseView,validatedBase,readFile),currentBytes=custody.read(d.source),proposalBytes=custody.read(d.proposal),authority=custody.json(d.authority),declaredMap=custody.json(d.insertionMap);
  need(authority.schema==='closed-loop-approved-v4-source-only-authority/1'&&authority.baseSourceSha256===validatedBase.sourceSha256&&authority.currentCandidateSourceSha256===d.source.sha256&&authority.approvedProposal?.sha256===d.proposal.sha256&&authority.approvedProposal.byteLength===proposalBytes.length&&nonblank(authority.approval?.requestMessageId)&&nonblank(authority.approval?.approvalMessageId)&&nonblank(authority.approval?.requestMessageExact)&&authority.approval?.approvalMessageExact==='👍🏻yes','INSERTION_CONTINUATION_AUTHORITY','The exact approved proposal/source/provenance chain differs.');
  const map=createApprovedInsertionMap({baseBytes:validatedBase.originalSource(),currentBytes,proposalBytes,baseSha256:validatedBase.sourceSha256,currentSha256:d.source.sha256,proposalSha256:d.proposal.sha256,specificationPath:d.base.source.path,ranges:declaredMap.ranges});validateInsertionMapSegments(map,declaredMap.originalToSuccessorSegments??declaredMap.segments);
  const sourceMeaning=validateSourceMeaningInput(d.sourceMeaning,custody,map,facts);
  const {current}=mapData(map),sections=reviewSpecificationCoverageBytes(currentBytes,map.specificationPath).sectionInventory;
  const delta=d.semanticDelta,reconciliation=custody.json(delta.reconciliation),draft=custody.json(delta.draft),review=custody.json(delta.independentReview),inventory=custody.json(delta.consumerInventory);
  need(reconciliation.schema==='closed-loop-v4-source-delta-reconciliation/1'&&reconciliation.role==='RECONCILIATION'&&sameRef(reconciliation.sourceChoiceAuthority,d.authority),'INSERTION_DELTA_RECONCILIATION','Reconciliation is not the approved source delta.');
  const sourceIdentity={baseSha256:map.baseSha256,successorSha256:map.currentSha256,approvedProposalSha256:map.proposalSha256};need(equal(reconciliation.sourceIdentity,sourceIdentity),'INSERTION_DELTA_SOURCE_IDENTITY','Reconciliation source identities differ.');
  need(new Set([draft.actorId,review.actorId,reconciliation.actorId]).size===3&&[draft.actorId,review.actorId,reconciliation.actorId,draft.contextId,review.contextId].every(nonblank)&&draft.contextId!==review.contextId,'INSERTION_DELTA_INDEPENDENCE','Extraction, blind review and reconciliation must be attributable and distinct.');
  const inserted=new Set(declaredMap.ranges.flatMap(r=>Array.from({length:r.lineCount},(_,i)=>r.startLine+i))),classifications=[];
  for(const [doc,role] of [[draft,'DRAFT'],[review,'INDEPENDENT_REVIEW']]){
    need(doc.schema==='closed-loop-approved-insertion-source-delta/1'&&doc.role===role&&equal(doc.sourceIdentity,sourceIdentity)&&doc.independence?.draftManifestReceived===false&&doc.independence?.otherContributorOutputRead===false&&doc.independence?.implementationOrTestsRead===false&&doc.independence?.fullOldSourceReviewClaim===false&&doc.claims?.boundedDeltaReadingComplete===true&&doc.claims?.fullCurrentAtomicManifestCompleteness===false&&doc.claims?.implementationConformance===false&&doc.claims?.releaseAcceptance===false&&(doc.unexpectedInputs===undefined||doc.unexpectedInputs.length===0),'INSERTION_DELTA_CONTRIBUTOR','Source-only contributor scope or independence differs.');
    const roles=new Map;for(const ref of doc.inputs){need(!roles.has(ref.role),'INSERTION_DELTA_INPUT_DUPLICATE','Contributor input role repeats.');roles.set(ref.role,ref);custody.read(ref);}
    need(roles.size===6&&['INPUT_MANIFEST','BASE_SOURCE','SUCCESSOR_SOURCE','EXACT_APPROVED_V4','APPROVAL_PROVENANCE','INSERTION_MAP'].every(role=>roles.has(role))&&roles.get('BASE_SOURCE').sha256===map.baseSha256&&roles.get('SUCCESSOR_SOURCE').sha256===map.currentSha256&&roles.get('EXACT_APPROVED_V4').sha256===map.proposalSha256&&sameRef(roles.get('APPROVAL_PROVENANCE'),d.authority),'INSERTION_DELTA_INPUTS','Contributor did not use the exact approved source-only inputs.');
    const rows=new Map;for(const row of doc.lineClassifications){need(inserted.has(row.successorLine)&&!rows.has(row.successorLine)&&row.rawText===current.lines[row.successorLine-1]&&row.lineSha256===sha(Buffer.from(row.rawText))&&nonblank(row.reason),'INSERTION_DELTA_LINE_CLASSIFICATION','Contributor insertion-line classification is missing, repeated or not source bound.');rows.set(row.successorLine,row);}
    need(rows.size===inserted.size,'INSERTION_DELTA_LINE_COVERAGE','Contributor omitted an inserted line.');classifications.push(rows);
  }
  need(equal(draft.inputs,review.inputs),'INSERTION_DELTA_INPUTS','Blind contributors used different input inventories.');
  const originalFreeze=custody.json(inventory.originalFreeze);need(originalFreeze.actorId===reconciliation.actorId&&originalFreeze.outputs.some(ref=>sameRef(ref,delta.reconciliation))&&originalFreeze.outputs.some(ref=>sameRef(ref,inventory.baseLedger)),'INSERTION_DELTA_FREEZE','Original reconciliation freeze differs.');
  for(const [role,ref] of [['AUTHOR',delta.draft],['REVIEWER',delta.independentReview]])need(reconciliation.frozenInputs.some(input=>input.role===role&&sameRef(input,ref)),'INSERTION_DELTA_FROZEN_ACTOR','Reconciliation does not bind its contributor.');
  need(inventory.schema==='closed-loop-source-reconciliation-consumer-handoff/1'&&inventory.originalPredecessorDenominator===base.entries.length&&inventory.proofPromotion===false&&inventory.sourceActivationClaim===false,'INSERTION_DELTA_INVENTORY','Consumer inventory population or scope differs.');
  const predecessorBytes=custody.read(inventory.originalPredecessor);need(valueSha(JSON.parse(predecessorBytes).entries)===valueSha(base.entries),'INSERTION_DELTA_BASE_ENTRIES','Consumer predecessor is not the original validated atomic population.');
  for(const ref of reconciliation.artifacts)need(originalFreeze.outputs.some(output=>sameRef(output,ref)),'INSERTION_DELTA_FREEZE','Reconciled artifact is not in the original immutable freeze.');
  const artifact=suffix=>oneRef(reconciliation.artifacts,suffix),ledger=custody.json(inventory.baseLedger),occurrenceDoc=custody.json(artifact('predecessor-occurrence-transport.json')),newDuties=custody.json(artifact('new-amendment-obligations.json')),newContexts=custody.json(artifact('reconciled-source-contexts.json')),lineDecisions=custody.json(artifact('inserted-line-decisions.json'));
  need(Array.isArray(ledger.entries)&&ledger.entries.length===base.entries.length&&ledger.entryCount===base.entries.length,'INSERTION_DELTA_PREDECESSOR_COVERAGE','Every original identity requires exactly one disposition.');
  const occurrenceMap=new Map;for(const row of occurrenceDoc.occurrences){need(!occurrenceMap.has(row.occurrenceId)&&row.sourceSha256===map.baseSha256&&row.successorSourceSha256===map.currentSha256,'INSERTION_DELTA_OCCURRENCE_ID','Duplicate or wrong-source occurrence.');occurrenceMap.set(row.occurrenceId,row);}
  const lineMap=new Map;for(const row of lineDecisions){const line=row.source?.startLine;sourcePassage(row.source,map);need(inserted.has(line)&&row.source.endLine===line&&!lineMap.has(line)&&row.authorClassification===classifications[0].get(line)?.classification&&row.reviewerClassification===classifications[1].get(line)?.classification&&nonblank(row.reason),'INSERTION_DELTA_LINE_RECONCILIATION','Insertion classification lacks exact independent counterpart.');lineMap.set(line,row);}
  need(lineMap.size===inserted.size,'INSERTION_DELTA_LINE_COVERAGE','Reconciliation omitted an inserted line.');
  const canonicalIds=new Set(newDuties.map(row=>row.canonicalId));need(canonicalIds.size===newDuties.length&&newDuties.length===inventory.newAmendmentDutyCount,'INSERTION_DELTA_NEW_POPULATION','New canonical duty population differs.');
  const contextCanonicalIds=new Set(newContexts.map(row=>row.canonicalId)),candidateDecisions=custody.json(artifact('all-obligation-candidate-decisions.json')),coveredCandidates=new Set,candidateLinks=new Map;
  for(const decision of candidateDecisions){const ref=decision.candidate,doc=ref.inputRole==='AUTHOR'?draft:ref.inputRole==='REVIEWER'?review:null;need(doc,'INSERTION_DELTA_CANDIDATE_ROLE','Unknown candidate contributor.');const candidate=pointerValue(doc,ref.jsonPointer),key=ref.inputRole+ref.jsonPointer;need(!coveredCandidates.has(key)&&candidate.localId===ref.localId&&valueSha(candidate)===ref.candidateSha256&&Array.isArray(decision.canonicalIds)&&decision.canonicalIds.length>0&&new Set(decision.canonicalIds).size===decision.canonicalIds.length&&nonblank(decision.reason),'INSERTION_DELTA_CANDIDATE_DECISION','Candidate is missing, duplicated or mapped to absent duty.');validateCandidateTargets(decision,candidate,canonicalIds,contextCanonicalIds,custody,reconciliation);candidateLinks.set(key,{decision,candidate});coveredCandidates.add(key);}
  for(const [role,doc] of [['AUTHOR',draft],['REVIEWER',review]])for(let i=0;i<doc.obligations.length;i++)need(coveredCandidates.has(role+'/obligations/'+i),'INSERTION_DELTA_CANDIDATE_COVERAGE','A contributor obligation is omitted.');
  need(coveredCandidates.size===draft.obligations.length+review.obligations.length,'INSERTION_DELTA_CANDIDATE_COVERAGE','Candidate inventory includes non-obligation pointers.');
  const contextDecisions=custody.json(artifact('source-context-candidate-decisions.json')),coveredContexts=new Set;
  need(contextCanonicalIds.size===newContexts.length,'INSERTION_DELTA_CONTEXT_CANONICAL_ID','Canonical source context repeats.');
  for(const decision of contextDecisions){const doc=decision.inputRole==='AUTHOR'?draft:decision.inputRole==='REVIEWER'?review:null;need(doc,'INSERTION_DELTA_CONTEXT_CANDIDATE_ROLE','Unknown context contributor.');const candidate=pointerValue(doc,decision.jsonPointer),key=decision.inputRole+decision.jsonPointer,ids=decision.canonicalIds??[decision.canonicalId];need(!coveredContexts.has(key)&&candidate.localId===decision.localId&&valueSha(candidate)===decision.candidateSha256&&ids.length>0&&ids.every(id=>contextCanonicalIds.has(id))&&nonblank(decision.reason),'INSERTION_DELTA_CONTEXT_CANDIDATE','Context candidate correspondence is incomplete or conflicting.');if(decision.countingDecisionPointer){need(sameRef(decision.countingDecisionPointer,reconciliation.countingAdjudication),'INSERTION_DELTA_CONTEXT_CANDIDATE','Counting context adjudication is not the frozen authority.');const selected=custody.selected(decision.countingDecisionPointer,decision.countingDecisionPointer.jsonPointer);need(selected.candidateId===candidate.localId&&selected.jsonPointer===decision.jsonPointer&&(selected.origin==='DRAFT'?'AUTHOR':'REVIEWER')===decision.inputRole&&equal(selected.contextIds,ids)&&selected.rationale===decision.reason,'INSERTION_DELTA_CONTEXT_CANDIDATE','Counting context mapping changed.');}else need(decision.decision==='RECONCILED_EXACT_SCOPE','INSERTION_DELTA_CONTEXT_CANDIDATE','Unknown context disposition.');coveredContexts.add(key);}
  for(const [role,doc] of [['AUTHOR',draft],['REVIEWER',review]])for(let i=0;i<doc.sourceContexts.length;i++)need(coveredContexts.has(role+'/sourceContexts/'+i),'INSERTION_DELTA_CONTEXT_CANDIDATE_COVERAGE','A source context candidate is omitted.');
  need(coveredContexts.size===draft.sourceContexts.length+review.sourceContexts.length,'INSERTION_DELTA_CONTEXT_CANDIDATE_COVERAGE','Context correspondence contains another pointer kind.');
  validateCanonicalAmendmentPayloads(newDuties,newContexts,{draft,review,reconciliation,candidateLinks,contextDecisions,custody,map,lineMap});
  const states=new Map,originalIds=new Set(base.entries.map(row=>row.normativeRequirementId));need(originalIds.size===base.entries.length,'INSERTION_DELTA_PREDECESSOR_DUPLICATE','Original IDs repeat.');
  ledger.entries.forEach((record,index)=>{
    need(record.predecessorIndex===index&&!states.has(record.predecessorNormativeRequirementId),'INSERTION_DELTA_PREDECESSOR_INDEX','Predecessor index/order repeats or differs.');
    const original=base.entries[index],decision=impactDecision(record,original,map,{custody,actorId:reconciliation.actorId,initial:true,reference:{artifact:inventory.baseLedger,jsonPointer:'/entries/'+index}});
    decision.occurrenceTransport=exactOccurrenceTransport(original,record.originalOccurrenceBindings,occurrenceMap,map);decision.history=[decision.reference];states.set(original.normativeRequirementId,decision);
  });
  const counts=()=>{const out={RETAINED:0,CHANGED:0,BLOCKED:0};for(const row of states.values())out[row.disposition]++;return out;};
  let previousQueue=null;const batchResolved=new Set,seenLayers=new Set,layerFacts=[];
  const layers=[...inventory.orderedAdditiveLayers,...d.additionalLayers];
  for(let layerIndex=0;layerIndex<layers.length;layerIndex++){
    const layer=layers[layerIndex];need(layer.order===layerIndex+1&&!seenLayers.has(layer.freeze.path),'INSERTION_DELTA_LAYER_ORDER','Additive layers must be unique and ordered.');seenLayers.add(layer.freeze.path);
    const freeze=custody.json(layer.freeze);validateAdditiveLayerAttribution(layer,freeze,custody,reconciliation.actorId);
    const outputs=freeze.outputs,queueRef=oneRef(outputs,'combined-queue-delta.json'),queue=custody.json(queueRef),sharedRef=oneRef(outputs,'shared-evidence.json',false),mechanismRef=oneRef(outputs,'mechanism-adjudication.json',false),shared=sharedRef?custody.json(sharedRef):null,mechanism=mechanismRef?custody.json(mechanismRef):null;
    need(queue.schema==='closed-loop-additive-source-impact-queue-delta/1'&&queue.denominator===base.entries.length&&queue.denominatorReduced===false&&queue.proofPromoted===false&&(previousQueue?sameRef(queue.priorQueueDelta,previousQueue):!queue.priorQueueDelta),'INSERTION_DELTA_QUEUE_CHAIN','Queue predecessor, denominator or proof status differs.');
    const layerIds=new Set;
    for(const ref of layer.decisionArrays){need(outputs.some(output=>sameRef(output,ref)),'INSERTION_DELTA_LAYER_FREEZE','Decision array is not in its exact freeze.');const records=custody.json(ref);need(Array.isArray(records)&&records.length===ref.memberCount,'INSERTION_DELTA_LAYER_COUNT','Layer member count differs.');
      records.forEach((record,index)=>{
        const id=record.predecessorNormativeRequirementId??record.predecessorId,prior=states.get(id);need(prior&&!layerIds.has(id)&&prior.disposition==='BLOCKED','INSERTION_DELTA_LAYER_OVERLAP','Layer omits, duplicates or overwrites an established disposition.');layerIds.add(id);
        const explicitSuccessor=Boolean(record.priorBlockedRecord||record.distinctReview||record.effectiveGovernorLink);
        need(!batchResolved.has(id)||explicitSuccessor,'INSERTION_DELTA_LAYER_OVERLAP','A later overlap lacks an explicit predecessor decision.');
        if(record.priorBlockedRecord){const target=custody.selected(record.priorBlockedRecord.artifact,record.priorBlockedRecord.jsonPointer);need(equal(target,prior.record),'INSERTION_DELTA_PRIOR_DECISION','Explicit successor does not bind the actual previous record.');}
        
        const original=base.entries[record.predecessorIndex];need(original?.normativeRequirementId===id,'INSERTION_DELTA_PREDECESSOR_INDEX','Additive predecessor index differs.');
        const origin=validateAdditiveOrigin(record,freeze,custody,original,map,reconciliation.actorId,prior.occurrenceTransport);
        const next=impactDecision(record,original,map,{custody,actorId:reconciliation.actorId,shared,mechanism,initial:false,reference:{artifact:ref,jsonPointer:'/'+index}});if(origin.proposalAdjudication==='ACCEPTED')need(equal(origin.proposalGovernorOccurrences,effectiveGovernorOccurrences(next.addedGovernors.map(ref=>ref.originalRecord),map)),'INSERTION_DELTA_ACCEPTED_GOVERNOR_SCOPE','Accepted proposal scope differs from its reconciled effective governors; an explicit frozen correction is required.');next.additiveOrigin=origin;next.occurrenceTransport=prior.occurrenceTransport;next.history=[...prior.history,next.reference];states.set(id,next);batchResolved.add(id);
      });
    }
    need(queue.perMemberNewDisposition?.length===layerIds.size&&new Set(queue.perMemberNewDisposition.map(row=>row.predecessorNormativeRequirementId)).size===layerIds.size&&queue.perMemberNewDisposition.every(row=>layerIds.has(row.predecessorNormativeRequirementId)&&states.get(row.predecessorNormativeRequirementId).disposition===row.successorDisposition&&(states.get(row.predecessorNormativeRequirementId).currentId??null)===(row.successorNormativeRequirementId??null))&&equal(counts(),{RETAINED:queue.combinedCounts.RETAINED,CHANGED:queue.combinedCounts.CHANGED,BLOCKED:queue.combinedCounts.BLOCKED}),'INSERTION_DELTA_QUEUE_COUNTS','Queue membership or recomputed counts differ.');layerFacts.push({outputs:freeze.outputs,queueReference:queueRef,combinedCounts:counts()});previousQueue=queueRef;
  }
  let currentOverlayEvidence=null;
  if(delta.consumerChain){
    const chain=custody.json(delta.consumerChain);
    validateDeclaredAdditiveLayerChain(chain.orderedAdditiveLayers,layers,layerFacts);
    need(sameRef(chain.preservedPriorInventory,delta.consumerInventory)&&equal(chain.orderedNewDutyResolutionLayers.map(row=>({freeze:row.freeze,reconciliation:row.reconciliation})),delta.newDutyResolutionLayers??[]),'INSERTION_CURRENT_CHAIN','Declared current chain omits or reorders consumed source decisions.');
    currentOverlayEvidence=applyDeclaredCurrentIdentityOverlays(chain,states,{custody,map,base,reconciler:reconciliation.actorId,inventory:{...inventory,reference:delta.consumerInventory},occurrenceRef:artifact('predecessor-occurrence-transport.json')});
  }
  const entries=[],pendingContexts=[],blockedSourceRecords=[],identityRelations=[],occupied=new Set,byId=new Map;
  const reserve=id=>{need(nreq(id)&&!occupied.has(id),'INSERTION_DELTA_ID_COLLISION','A current duty/context identity repeats.');occupied.add(id);};
  const add=row=>{reserve(row.normativeRequirementId);entries.push(row);byId.set(row.normativeRequirementId,row);};
  const primary=line=>({path:map.specificationPath,startLine:line,endLine:line,lineSha256:sha(Buffer.from(current.lines[line-1]))});
  const sectionAt=line=>sections.find(s=>line>=s.startLine&&line<=s.endLine)?.sectionId??'preamble';
  for(const state of states.values()){
    const original=base.entries[state.predecessorIndex];
    if(state.disposition==='BLOCKED'){blockedSourceRecords.push({kind:'UNRESOLVED_PREDECESSOR_SOURCE_IDENTITY',predecessorId:state.predecessorId,originalEntry:original,occurrenceTransport:state.occurrenceTransport,decision:state.record,history:state.history});continue;}
    need(state.disposition==='RETAINED'||!originalIds.has(state.currentId),'INSERTION_DELTA_FRESH_COLLISION','Changed identity collides with original population.');
    identityRelations.push({predecessorId:state.predecessorId,currentId:state.currentId,relation:state.disposition==='RETAINED'?'REVIEWED_COORDINATE_ONLY_CONTINUATION':'REVIEWED_FRESH_EFFECTIVE_SCOPE',birthPreimage:state.birthPreimage,history:state.history,proofInheritance:false});
    // Historical qualification arrays remain exact provenance. Only an explicit
    // unresolved CURRENT scope decision blocks current identity establishment.
    if((state.currentSourceEffects??state.record.currentUnresolvedSourceEffects??[]).length||(state.currentBlockedSourceEffects??state.record.currentBlockedInheritedReferenceDetails??[]).length)blockedSourceRecords.push({kind:'PENDING_EFFECTIVE_GOVERNOR_LINK',predecessorId:state.predecessorId,currentCandidateId:state.currentId,qualifiers:state.qualifiers,decisionReference:state.reference});
    if(original.entryKind==='SOURCE_CONTEXT'){pendingContexts.push({original,state});continue;}
    let row;
    if(state.disposition==='RETAINED'){
      const transported=transportAtomicScopeCoordinates(original,map),transportProof=verifyAtomicScopeCoordinateTransport(original,transported,map);
      row={...transported,normativeRequirementId:state.currentId,sectionId:sectionAt(transported.sourceLocation.startLine),continuationProvenance:{originalEntry:original,coordinateTransport:transportProof,occurrenceTransport:state.occurrenceTransport,reviewedNoNewGovernorDecision:state.record,history:state.history,proofInheritance:false,implementationConformance:'UNKNOWN'}};
    }else row=compatibilityAtom(state.currentId,original,null,state,map,sections);
    add(row);
  }
  const newDutyResolutions=loadNewDutyResolutions(delta.newDutyResolutionLayers??[],newDuties,artifact('new-amendment-obligations.json'),inventory,custody,map,reconciliation.actorId);
  if(delta.consumerChain){const chain=custody.json(delta.consumerChain),finalNewIds=newDuties.map((row,index)=>[index,newDutyResolutions.get(index)?.edge.successorNormativeRequirementId??row.normativeRequirementId]);need(digest(chain.currentNewDutyIdentityDigest)&&valueSha(finalNewIds)===chain.currentNewDutyIdentityDigest,'INSERTION_CURRENT_NEW_IDENTITY_DIGEST','Declared final new-duty identities omit or substitute a reviewed transition.');}

  const newSourceRows=[];
  for(const [newDutyIndex,record] of newDuties.entries()){
    const identity=verifiedNewIdentity(record,map.currentSha256);need(!originalIds.has(record.normativeRequirementId),'INSERTION_DELTA_FRESH_COLLISION','New duty collides with predecessor population.');
    const resolution=newDutyResolutions.get(newDutyIndex),graph=sourceGraphForNew(record,custody,map);graph.structuralContextRelations=reviewedNewDutyContextRelations(record,newDutyIndex,graph.sources[0].startLine,newContexts,{contexts:artifact('reconciled-source-contexts.json'),duties:artifact('new-amendment-obligations.json')},map);graph.contexts.push(...graph.structuralContextRelations.map(relation=>relation.sourceOccurrence));const impact={record,birthPreimage:resolution?.birth??identity,sourceDecision:resolution?.birth?resolution.edge.independentReason:record.sourceDecision??record.sourceDecisionId??null,addedGovernors:[],technicalGovernor:resolution?.governor??null,qualifiers:{unresolvedSourceEffects:record.unresolvedSourceEffects??[]}};
    const row=compatibilityAtom(resolution?.currentId??record.normativeRequirementId,null,graph,impact,map,sections);if(resolution)row.continuationProvenance.attributedSourceResolution=resolution;add(row);newSourceRows.push({record,row,graph});
    if((resolution?.remainingIssues??record.unresolvedSourceEffects)?.length)blockedSourceRecords.push({kind:'PENDING_NEW_DUTY_EFFECTIVE_GOVERNOR_LINK',currentCandidateId:record.normativeRequirementId,sourceIssues:record.unresolvedSourceEffects,sourceRecord:record});
  }
  const idMap=new Map(identityRelations.map(row=>[row.predecessorId,row.currentId]));need(new Set(idMap.values()).size===idMap.size,'INSERTION_DELTA_RELATION_AMBIGUITY','Predecessor identity relation is many-to-one.');
  const compact=lines=>{const out=[];for(const n of [...new Set(lines)].sort((a,b)=>a-b)){const last=out.at(-1);if(last&&last[1]+1===n)last[1]=n;else out.push([n,n]);}return out;};
  const blockedInRanges=ranges=>[...states.values()].filter(state=>state.disposition==='BLOCKED'&&ranges.some(([a,b])=>{const n=map.forwardLine(base.entries[state.predecessorIndex].sourceLocation.startLine);return n>=a&&n<=b;}));
  for(const {original,state} of pendingContexts){
    const old=original.contextClassification,line=map.forwardLine(original.sourceLocation.startLine),ranges=(old.governingSourceRanges??[]).flatMap(([a,b])=>map.forwardLineRange(a,b));
    const missing=(old.governingNormativeRequirementIds??[]).filter(id=>!idMap.has(id));
    if(missing.length||blockedInRanges(ranges).length){blockedSourceRecords.push({kind:'UNRESOLVED_CONTEXT_CHILD_RELATION',currentCandidateId:state.currentId,predecessorId:state.predecessorId,missingChildren:missing,originalEntry:original,occurrenceTransport:state.occurrenceTransport});continue;}
    const governed=old.governingNormativeRequirementIds.map(id=>idMap.get(id)),bindings=(old.governingOccurrenceBindings??[]).map(binding=>{const id=idMap.get(binding.normativeRequirementId),child=byId.get(id);need(child?.entryKind==='ATOMIC_OBLIGATION','INSERTION_DELTA_CONTEXT_CHILD','Context child is absent/non-atomic.');return {...binding,normativeRequirementId:id,currentAtomicObligationSha256:child.atomicObligation.sha256,sourceLine:map.forwardLine(binding.sourceLine),...(binding.viaSourceLines?{viaSourceLines:binding.viaSourceLines.map(line=>map.forwardLine(line))}:{})};});
    // Added context scopes are never guessed from overlap. A changed context's
    // reviewed added governors stay in its effective-scope provenance.
    add({normativeRequirementId:state.currentId,entryKind:'SOURCE_CONTEXT',sectionId:sectionAt(line),sourceLocation:primary(line),controllingText:current.lines[line-1].trim(),contextClassification:{...old,governingNormativeRequirementIds:governed,...(old.governingSourceRanges?{governingSourceRanges:ranges}:{}),...(old.governingOccurrenceBindings?{governingOccurrenceBindings:bindings}:{})},continuationProvenance:{originalEntry:original,reviewedSourceDecision:state.record,occurrenceTransport:state.occurrenceTransport,addedGovernors:state.addedGovernors,technicalGovernor:state.technicalGovernor,qualifiers:state.qualifiers,birthPreimage:state.birthPreimage,history:state.history,proofInheritance:false,implementationConformance:'UNKNOWN'}});
  }
  const contextIdentities=new Set,contextGraph=[];
  for(const record of newContexts){
    const alias=verifiedContextAlias(record,map.currentSha256);need(!contextIdentities.has(record.sourceContextIdentity)&&!originalIds.has(alias.normativeRequirementId),'INSERTION_DELTA_CONTEXT_COLLISION','Context source identity or row alias repeats.');contextIdentities.add(record.sourceContextIdentity);
    const references=record.sourceLocation?[record.sourceLocation]:record.sourceLocations,external=references.some(ref=>['EXACT_APPROVED_V4','APPROVAL_PROVENANCE'].includes(ref.role));
    const checked=references.map(ref=>{
      if(!['EXACT_APPROVED_V4','APPROVAL_PROVENANCE'].includes(ref.role))return sourcePassage(ref,map);
      const artifactRef=ref.role==='EXACT_APPROVED_V4'?d.proposal:d.authority,raw=custody.read(artifactRef),text=raw.toString('utf8'),lines=text.split('\n'),a=ref.startLine,b=ref.endLine;
      need(ref.sourceSha256===artifactRef.sha256&&Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>=1&&a<=b&&b<=lines.length,'INSERTION_DELTA_EXTERNAL_CONTEXT','External context source/line identity differs.');const selected=lines.slice(a-1,b),start=lines.slice(0,a-1).reduce((n,line)=>n+Buffer.byteLength(line)+1,0),end=start+Buffer.byteLength(selected.join('\n'));
      need(ref.startByte===start&&ref.endByte===end&&equal(ref.lineSha256,a===b?sha(selected[0]):selected.map(line=>sha(line)))&&ref.controllingText===selected.join('\n'),'INSERTION_DELTA_EXTERNAL_CONTEXT','External context exact bytes differ.');return {role:ref.role,sourceSha256:artifactRef.sha256,startLine:a,endLine:b,originalRecord:structuredClone(ref)};
    }),first=checked[0];need(first,'INSERTION_DELTA_CONTEXT_SOURCE','Context has no source occurrence.');
    if(record.selectedText!==undefined&&record.selectedText!==null)need(nonblank(record.selectedText)&&references.some(ref=>typeof ref.controllingText==='string'&&ref.controllingText.includes(record.selectedText)),'INSERTION_DELTA_CONTEXT_FRAGMENT','Selected context fragment is not contained in its exact reviewed occurrence.');
    const node={sourceContextIdentity:record.sourceContextIdentity,rowAlias:alias,sourceRecord:record,sourceOccurrences:checked,ordinaryRowEmitted:false};contextGraph.push(node);
    // External approval/history and retained-reference passages are graph
    // evidence, not invented one-line controlling-source obligations.
    const scopeFragment=record.selectedText!==null&&record.selectedText!==undefined&&(record.governingOccurrenceSets??[]).length===0&&[...candidateLinks.values()].some(x=>x.decision.disposition==='REPRESENTED_AS_SCOPE_OR_PROVENANCE_CONTEXT'&&x.decision.canonicalIds.includes(record.canonicalId)&&x.candidate.statement===record.selectedText),referenceOnly=record.sourceRole==='RETAINED_SOURCE_REFERENCE',aggregate=Object.hasOwn(record,'appliesTo')&&Object.hasOwn(record,'meaning');
    need(!referenceOnly||checked.every(ref=>ref.role==='BASE_SOURCE'),'INSERTION_DELTA_CONTEXT_PARTITION','A projectable current heading cannot be demoted to retained-reference evidence.');
    if(aggregate){need(record.sourceDecision?.jsonPointer?.startsWith('/governingContextContracts/'),'INSERTION_DELTA_CONTEXT_PARTITION','Aggregate context lacks its reviewed typed contract selector.');const contract=custody.selected(record.sourceDecision,record.sourceDecision.jsonPointer);need(contract.contextId===record.canonicalId&&contract.meaning===record.meaning&&contract.appliesTo===record.appliesTo&&equal(contract.sourceLocations,record.sourceLocations),'INSERTION_DELTA_CONTEXT_CONTRACT','Aggregate governor meaning/relation differs.');}
    node.projectionKind=external?'EXTERNAL_AUTHORITY_OR_HISTORY':referenceOnly?'RETAINED_SOURCE_REFERENCE':scopeFragment?'NON_GOVERNING_SCOPE_FRAGMENT':aggregate?'AGGREGATE_GOVERNOR_CONTRACT':'ORDINARY_SOURCE_CONTEXT';
    if(external||referenceOnly||aggregate||scopeFragment){
      reserve(alias.normativeRequirementId);
      for(const range of record.governingOccurrenceSets??[])if(range.baseStartLine!==undefined){const expected=map.forwardLineRange(range.baseStartLine,range.baseEndLine);need(expected.some(([a,b])=>a===range.successorStartLine&&b===range.successorEndLine)&&range.sha256===sha(Buffer.from(mapData(map).base.lines.slice(range.baseStartLine-1,range.baseEndLine).join('\n'))),'INSERTION_DELTA_CONTEXT_REFERENCE_TRANSPORT','Retained context reference fragment differs.');}
      continue;
    }
    need(checked.every(ref=>ref.startLine===ref.endLine),'INSERTION_DELTA_CONTEXT_PARTITION','A required ordinary source context lacks a reviewed single-line projection.');
    need(first.role==='SUCCESSOR_SOURCE','INSERTION_DELTA_CONTEXT_SOURCE','Ordinary new context needs an exact current-source anchor.');
    const line=first.startLine,linked=newSourceRows.filter(({record:child})=>[...(child.contextIds??[]),...(child.governingContextContractIds??[])].includes(record.canonicalId));
    let ranges=(record.governingOccurrenceSets??[]).map(ref=>{const checked=sourcePassage({...ref,sourceSha256:map.currentSha256},map);return [checked.startLine,checked.endLine];});
    if(record.governingScope)ranges.push([record.governingScope.startLine,record.governingScope.endLine]);
    if(!ranges.length&&linked.length)ranges=compact(linked.map(({row})=>row.sourceLocation.startLine));
    const missing=blockedInRanges(ranges);if(missing.length){reserve(alias.normativeRequirementId);blockedSourceRecords.push({kind:'UNRESOLVED_NEW_CONTEXT_MEMBER_SET',sourceContextIdentity:record.sourceContextIdentity,currentCandidateId:alias.normativeRequirementId,missingPredecessorIds:missing.map(x=>x.predecessorId),sourceRecord:record,alias});continue;}
    const classification=record.classification??'STRUCTURAL_REQUIREMENT_CONTEXT';
    const governed=classification==='STRUCTURAL_REQUIREMENT_CONTEXT'?entries.filter(row=>row.entryKind==='ATOMIC_OBLIGATION'&&ranges.some(([a,b])=>row.sourceLocation.startLine>=a&&row.sourceLocation.startLine<=b)).map(row=>row.normativeRequirementId):[];
    need(classification!=='STRUCTURAL_REQUIREMENT_CONTEXT'||ranges.length&&governed.length,'INSERTION_DELTA_CONTEXT_MEMBERSHIP','Reviewed context lacks an exact current governed occurrence set.');
    node.ordinaryRowEmitted=true;add({normativeRequirementId:alias.normativeRequirementId,entryKind:'SOURCE_CONTEXT',sectionId:sectionAt(line),sourceLocation:primary(line),controllingText:current.lines[line-1].trim(),contextClassification:{classification,reason:record.reason??record.meaning,governingNormativeRequirementIds:governed,...(classification==='STRUCTURAL_REQUIREMENT_CONTEXT'?{governingSourceRanges:ranges}:{})},continuationProvenance:{sourceContextIdentity:record.sourceContextIdentity,alias,sourceRecord:record,sourceOccurrences:checked,proofInheritance:false,implementationConformance:'UNKNOWN'}});
  }
  // Ordinary row/duplicate/reverse-membership predicates still own shape and
  // scope validation. A compatibility key cannot hide duplicate propositions.
  need(contextGraph.length===newContexts.length,'INSERTION_DELTA_CONTEXT_GRAPH_COVERAGE','A reconciled graph context was dropped.');
  const rowValidation=validateAtomicRequirementRows(currentBytes,entries,map.specificationPath,sections);
  const governingProjection=projectOriginalGoverningGraph(validatedBase,base,map,idMap,entries,blockedSourceRecords);
  validateProjectedGoverningOccurrences(entries,governingProjection);
  const transportedBaseTrace=base.sourcePrior.requirements.map(original=>({kind:'ORIGINAL_SOURCE_TRACE_TRANSPORT',original:structuredClone(original),transportedSourceLocations:map.forwardLineRange(original.sourceLocation.startLine,original.sourceLocation.endLine).map(([startLine,endLine])=>({...original.sourceLocation,startLine,endLine})),historicalSourceSha256:map.baseSha256,currentSourceSha256:map.currentSha256,originalReviewRelabeled:false}));
  const currentDutyByCanonical=new Map(newSourceRows.map(({record,row})=>[record.canonicalId,row])),currentDutySourcesById=new Map(newSourceRows.map(({row,graph})=>[row.normativeRequirementId,graph.sources])),currentContextByCanonical=new Map(contextGraph.map(node=>[node.sourceRecord.canonicalId,node]));
  const amendmentTrace=[],requiredUncovered=new Set;
  for(const [line,decision] of lineMap){
    need(['NORMATIVE','STRUCTURAL_HEADING','STRUCTURAL_TABLE','BLANK'].includes(decision.classification)&&decision.classificationAgreement===(decision.authorClassification===decision.reviewerClassification)&&[decision.authorClassification,decision.reviewerClassification].includes(decision.classification),'INSERTION_CURRENT_CLASSIFICATION','Unknown or inconsistent reviewed source classification.');
    const expected=[...candidateLinks.entries()].filter(([,link])=>link.candidate.primarySourceLocation.startLine===line).map(([key])=>key).sort(),actual=(decision.candidateDecisions??[]).map(ref=>ref.inputRole+ref.jsonPointer).sort();
    need(new Set(actual).size===actual.length&&equal(expected,actual),'INSERTION_CURRENT_TRACE_LINK','Current source line omits, duplicates or borrows a candidate decision.');
    const targets=new Set;for(const key of actual)for(const id of candidateLinks.get(key).decision.canonicalIds)targets.add(id);
    for(const row of newContexts){const refs=row.sourceLocation?[row.sourceLocation]:row.sourceLocations??[];if(refs.some(ref=>ref.role==='SUCCESSOR_SOURCE'&&ref.startLine<=line&&ref.endLine>=line))targets.add(row.canonicalId);}
    const duties=[...targets].filter(id=>currentDutyByCanonical.has(id)).map(id=>currentDutyByCanonical.get(id)),nodes=[...targets].filter(id=>currentContextByCanonical.has(id)).map(id=>currentContextByCanonical.get(id));
    const linkedDuty=duties.some(row=>reviewedNewDutyAtLine(row,currentDutySourcesById.get(row.normativeRequirementId),line)),linkedContext=nodes.some(node=>node.sourceOccurrences.some(ref=>ref.role==='SUCCESSOR_SOURCE'&&ref.startLine<=line&&ref.endLine>=line));
    const complete=decision.classification==='BLANK'?current.lines[line-1]===''&&actual.length===0&&!linkedDuty:decision.classification==='NORMATIVE'?linkedDuty||nodes.some(node=>node.ordinaryRowEmitted&&node.sourceRecord.classification==='STRUCTURAL_REQUIREMENT_CONTEXT'):linkedContext||linkedDuty;
    if(!complete){requiredUncovered.add(line);blockedSourceRecords.push({kind:'UNCOVERED_REVIEWED_AMENDMENT_SOURCE_LINE',line,classification:decision.classification,decision:structuredClone(decision),targetCanonicalIds:[...targets]});}
    const identityPayload={schema:'closed-loop-current-amendment-source-trace/1',sourceSha256:map.currentSha256,line,lineSha256:sha(Buffer.from(current.lines[line-1])),classificationDecision:structuredClone(decision),candidateDecisions:actual.map(key=>structuredClone(candidateLinks.get(key).decision)),targetCanonicalIds:[...targets].sort(),normativeRequirementIds:duties.map(row=>row.normativeRequirementId).sort(),sourceContextIdentities:nodes.map(node=>node.sourceContextIdentity).sort()};
    amendmentTrace.push({...identityPayload,traceIdentitySha256:valueSha(identityPayload),coverageEstablished:complete,proofInheritance:false});
  }
  need(amendmentTrace.length===inserted.size,'INSERTION_CURRENT_TRACE_COVERAGE','Current amendment trace does not cover every inserted classification.');
  const sourceTrace=[...transportedBaseTrace,...amendmentTrace];
  const unresolvedLines=new Set(requiredUncovered);for(const record of blockedSourceRecords)if(record.kind==='UNRESOLVED_PREDECESSOR_SOURCE_IDENTITY')for(const binding of record.occurrenceTransport)if(binding.kind==='LINES')for(const f of binding.fragments)for(let line=f.successorStartLine;line<=f.successorEndLine;line++)unresolvedLines.add(line);
  const lines=currentBytes.toString('utf8').split('\n'),coverage=lines.map((text,index)=>{
    const line=index+1,ids=[...(rowValidation.membership.get(line)??[])].sort(),oldLine=line<=map.currentPhysicalLines&&!inserted.has(line)?map.inverseLine(line):null;
    const prior=oldLine?facts.originalAtomicLineCoverage[oldLine-1]:null,decision=lineMap.get(line),unresolved=unresolvedLines.has(line);
    return {line,sectionId:sectionAt(line),lineSha256:sha(Buffer.from(text)),normativeRequirementIds:ids,status:unresolved?'UNRESOLVED_CONTEXT':ids.length?(rowValidation.byLine.has(line)?'NORMATIVE_REQUIREMENT':'NORMATIVE_CONTEXT'):prior?.status??(decision?.classification==='BLANK'||text===''?'BLANK':decision?'NORMATIVE_CONTEXT':'UNRESOLVED_CONTEXT'),reason:prior?.reason??decision?.reason??'Exact current source occurrence; no invented atomic proposition.',sourceProvenance:oldLine?{baseLine:oldLine,baseSourceSha256:map.baseSha256}:{insertionDecisionId:decision?.decisionId??null}};
  });
  const sectionMembership=sections.map(section=>({...section,normativeRequirementIds:entries.filter(row=>row.sectionId===section.sectionId).map(row=>row.normativeRequirementId),blockedPredecessorIds:[...states.values()].filter(state=>state.disposition==='BLOCKED'&&base.entries[state.predecessorIndex].sectionId===section.sectionId).map(state=>state.predecessorId)}));
  const currentById=new Map(entries.map(row=>[row.normativeRequirementId,row]));
  const reviewedSections=sections.map(section=>{
    const original=base.reconciliation.sections.find(row=>row.sectionId===section.sectionId);
    need(original,'INSERTION_CURRENT_SECTION','Current section has no exact predecessor section.');
    const references=(original.coverageReferences??[]).map(ref=>{
      const id=idMap.get(ref.normativeRequirementId);if(!currentById.has(id)){blockedSourceRecords.push({kind:'UNRESOLVED_CURRENT_SECTION_REFERENCE',sectionId:section.sectionId,originalReference:ref});return null;}
      return {...ref,normativeRequirementId:id,sourceRanges:ref.sourceRanges.flatMap(([a,b])=>map.forwardLineRange(a,b))};
    }).filter(Boolean);
    const members=entries.filter(row=>row.sectionId===section.sectionId).map(row=>row.normativeRequirementId);
    const row={...original,...section,normativeRequirementIds:members,coverageReferences:references,reason:original.reason,continuationSectionProvenance:{originalSection:original,reviewRelabeled:false}};
    if(members.length||references.length)row.disposition='COVERED';
    if(original.sourceContext)row.sourceContext={...original.sourceContext,sourceLine:map.forwardLine(original.sourceContext.sourceLine)};
    return row;
  });
  // This is a current source-trace projection, distinct from the atomic IDs.
  // Historical reviews remain bound to their original source and occurrences.
  const newTracePrior={schema:'closed-loop-insertion-current-source-trace/1',specificationSha256:map.currentSha256,sourceTrace,sourceLineCoverage:coverage,originalReviewRelabeled:false};
  const currentCounts=counts(),data={sourceSha256:map.currentSha256,baseSourceSha256:map.baseSha256,entries,identityRelations,sourceTrace,transportedBaseTrace,amendmentTrace,governingProjectionProvenance:governingProjection.provenance,sourceLineCoverage:coverage,sectionMembership,blockedSourceRecords,contextGraph,originalBasePopulation:{entryCount:base.entries.length,contextCount:base.entries.filter(row=>row.entryKind==='SOURCE_CONTEXT').length,atomicCount:base.entries.filter(row=>row.entryKind==='ATOMIC_OBLIGATION').length,structuralContextCount:base.entries.filter(row=>row.contextClassification?.classification==='STRUCTURAL_REQUIREMENT_CONTEXT').length,historicalContextCount:base.entries.filter(row=>row.contextClassification?.classification==='HISTORICAL_NONNORMATIVE_CONTEXT').length},currentOverlayEvidence,approvedRanges:structuredClone(declaredMap.ranges),reviewedSections,currentSourceTracePrior:newTracePrior,newContextAliasCount:contextIdentities.size,projectedNewContextRowCount:contextGraph.filter(node=>node.ordinaryRowEmitted).length,graphOnlyContextCount:contextGraph.filter(node=>node.projectionKind!=='ORDINARY_SOURCE_CONTEXT').length,pendingOrdinaryContextCount:contextGraph.filter(node=>node.projectionKind==='ORDINARY_SOURCE_CONTEXT'&&!node.ordinaryRowEmitted).length,atomicObligationCount:entries.filter(row=>row.entryKind==='ATOMIC_OBLIGATION').length,newAtomicDutyCount:newDuties.length,predecessorDispositionCounts:currentCounts,originalContractFindings:structuredClone(facts.sourceContractFindings),sourceMeaning,lastQueue:previousQueue};
  custody.assertClosure();const dependencyPins=custody.pins();
  return Object.freeze({schema:'closed-loop-insertion-composition-candidate/1',baseAtomicValidated:true,sourceSemanticValidated:true,semanticDeltaMechanicallyValidated:true,successorEstablished:false,productionFingerprintIntegrated:false,implementationConformance:false,applicationAcceptance:false,entryCount:entries.length,blockedSourceRecordCount:blockedSourceRecords.length,
    candidateData(){return structuredClone(data);},dependencyIdentity(){return {base:validatedBase.dependencyIdentity(),delta:structuredClone(dependencyPins)};},
    establishCurrentUniverse(){need(blockedSourceRecords.length===0&&currentCounts.BLOCKED===0,'INSERTION_CURRENT_SOURCE_INCOMPLETE','Current source identity/governor/member decisions remain unresolved.');validateGeneratorResolvedSourceCoverage(coverage);validateAtomicLineMembership(entries,coverage,currentBytes,map.specificationPath,sections);validateAtomicSectionCoverage({sections:reviewedSections},new Map(entries.map(row=>[row.normativeRequirementId,row])),sections,currentBytes,'normativeRequirementId','normativeRequirementIds');return {sourceUniverseEstablished:true,productionActivation:false,implementationConformance:false,applicationAcceptance:false,sourceSha256:map.currentSha256,entryCount:entries.length};}
  });
}


// Explicit production dispatch. This does not manufacture ordinary contributor
// records, relabel old reviews, or infer application conformance from source.
export function readInsertionAtomicDescriptor(descriptor,{readFile=readAtomicEvidenceBytes}={}){
  keys(descriptor,['schema','status','continuation'],'INSERTION_PRODUCTION_DESCRIPTOR');
  need(descriptor.schema==='closed-loop-approved-insertion-atomic-extraction/1'&&descriptor.status==='RECONCILED','INSERTION_PRODUCTION_DESCRIPTOR','Current continuation must be explicitly reconciled.');
  const ref=descriptor.continuation;need(ref&&isAtomicEvidencePath(ref.path)&&digest(ref.sha256),'INSERTION_PRODUCTION_REFERENCE','Continuation custody must be repository-local and exact.');
  const bytes=readFile(ref.path);need(Buffer.isBuffer(bytes),'INSERTION_PRODUCTION_BYTES','Reader must provide exact descriptor bytes.');
  const snapshot=Buffer.from(bytes);identity(snapshot,ref.sha256,'INSERTION_PRODUCTION_HASH');
  const continuation=JSON.parse(snapshot);need(continuation.schema===insertionCompositionVersion,'INSERTION_PRODUCTION_SCHEMA','Unsupported continuation schema.');
  return {continuation,ref:{path:ref.path,sha256:ref.sha256}};
}
export function insertionAtomicEvidenceReferences(descriptor,{readFile=readAtomicEvidenceBytes}={}){
  const {continuation:d,ref}=readInsertionAtomicDescriptor(descriptor,{readFile}),unique=new Map([[ref.path,ref]]);
  // Each declared inventory is unique. Shared immutable physical DAG nodes
  // across inventories remain valid, provided their exact bytes agree.
  for(const [inventory,key] of [[d.base?.view,'logicalPath'],[d.view,'provenancePath']]){
    need(Array.isArray(inventory),'INSERTION_PRODUCTION_CLOSURE','Both base and delta custody inventories are required.');
    const declared=new Set;
    for(const row of inventory){need(row&&typeof row[key]==='string'&&!declared.has(row[key])&&isAtomicEvidencePath(row.storagePath)&&digest(row.sha256),'INSERTION_PRODUCTION_CLOSURE','Duplicate, missing or invalid custody declaration.');declared.add(row[key]);
      need(row.storagePath!==ref.path,'INSERTION_PRODUCTION_CYCLE','Continuation descriptor cannot be its own input.');
      need(!unique.has(row.storagePath)||unique.get(row.storagePath).sha256===row.sha256,'INSERTION_PRODUCTION_CONFLICT','Physical immutable input has conflicting hashes.');
      const returned=readFile(row.storagePath);need(Buffer.isBuffer(returned),'INSERTION_PRODUCTION_BYTES','Physical dependency must return exact bytes.');const bytes=Buffer.from(returned);identity(bytes,row.sha256,'INSERTION_PRODUCTION_HASH');unique.set(row.storagePath,{path:row.storagePath,sha256:row.sha256});
    }
  }
  return [...unique.values()];
}
export function loadInsertionAtomicExtraction(descriptor,{sourceBytes,specificationPath,sections,readFile=readAtomicEvidenceBytes}={}){
  const {continuation:d}=readInsertionAtomicDescriptor(descriptor,{readFile});
  need(d.semanticDelta?.consumerChain,'INSERTION_PRODUCTION_CHAIN','Production composition requires its exact declared current identity chain.');
  need(Buffer.isBuffer(sourceBytes)&&sha(sourceBytes)===d.source?.sha256&&specificationPath===d.base?.source?.path,'INSERTION_PRODUCTION_SOURCE','Current controlling source differs from the checked continuation.');
  const composed=loadApprovedInsertionAtomicContinuation(d,{readFile}),data=composed.candidateData();
  composed.establishCurrentUniverse();
  const actualSections=reviewSpecificationCoverageBytes(sourceBytes,specificationPath).sectionInventory;
  need(!sections||equal(sections.map(({sectionId,title,startLine,endLine})=>({sectionId,...(title!==undefined?{title}:{}),startLine,endLine})),actualSections),'INSERTION_PRODUCTION_SECTIONS','Current caller section inventory differs from source.');
  const dependencyIdentity=composed.dependencyIdentity(),references=insertionAtomicEvidenceReferences(descriptor,{readFile});
  const consumed=new Map([...dependencyIdentity.base.physicalReferences,...dependencyIdentity.delta.filter(row=>row.storagePath).map(row=>({path:row.storagePath,sha256:row.sha256}))].map(row=>[row.path,row.sha256]));
  need(references.length===consumed.size+1&&references.every(row=>row.path===descriptor.continuation.path||consumed.get(row.path)===row.sha256),'INSERTION_PRODUCTION_READ_SET','Fingerprint closure differs from actual validated base/delta reads.');
  return {established:true,descriptor:structuredClone(descriptor),entries:projectInsertionEntryProvenance(data.entries,descriptor.continuation),requirementIdentityCrosswalk:data.identityRelations,reconciliation:{sections:data.reviewedSections},sourcePrior:data.currentSourceTracePrior,continuation:{schema:'closed-loop-established-insertion-source/1',data,dependencyIdentity,references,sourceReviewReference:structuredClone(d.semanticDelta.independentReview),sourceReconciliationReference:structuredClone(d.semanticDelta.reconciliation)},implementationConformance:false,applicationAcceptance:false};
}


// Reconstruct through the same pinned descriptor and full strict source owner.
// This is a representation operation; no weaker alternate loader is introduced.
export function reconstructInsertionAtomicProvenance(descriptor,entries,options){
  const checked=loadInsertionAtomicExtraction(descriptor,options);
  return reconstructInsertionEntryProvenance(entries,checked.continuation.data.entries,descriptor.continuation);
}


export function generateInsertionGovernance({evidence,sourceBytes,sourceCommit,specificationPath,owner,tests,registry,mutations}){
  need(evidence.schema==='closed-loop-requirement-evidence-bindings/1'&&evidence.specificationSha256===sha(sourceBytes)&&/^[0-9a-f]{40}$/.test(sourceCommit),'INSERTION_GENERATOR_SOURCE','Current source/declaration/commit binding differs.');
  const atomic=loadInsertionAtomicExtraction(evidence.atomicExtraction,{sourceBytes,specificationPath}),data=atomic.continuation.data;
  const {continuation:d}=readInsertionAtomicDescriptor(evidence.atomicExtraction),declaredRanges={ranges:data.approvedRanges};
  need((evidence.approvedClarifications??[]).length===0&&equal((evidence.approvedAmendments??[]).map(row=>Object.fromEntries(Object.keys(declaredRanges.ranges[0]).map(key=>[key,row[key]]))),declaredRanges.ranges),'INSERTION_GENERATOR_AMENDMENTS','Current adoption ranges differ from the exact checked insertions.');
  const meaning=data.sourceMeaning,currentFindings=meaning.status==='REVIEWED_BOUNDED_SOURCE_MEANINGS'?[]:data.originalContractFindings;
  const sections=data.reviewedSections,requirements=atomic.entries.map(entry=>{
    const statement=entry.atomicObligation?.statement??entry.controllingText,o=owner(statement,entry.sectionId);
    return {...entry,requirementClass:/\bMUST NOT\b|\bPROHIBITED\b|\bNEVER\b|\bCANNOT\b|\bMAY NOT\b/i.test(statement)?'PROHIBITION':/100%|\s=\s0\s*$/.test(statement)?'DEFINITION_OF_DONE_METRIC':'REQUIREMENT',extractionOrigins:['REVIEWED_APPROVED_INSERTION_CONTINUATION'],reconciliationStatus:'RECONCILED',responsibleImplementationOwner:o,schemaOrRegistryEntry:registry(statement,entry.sectionId),deterministicTestIds:tests(o),semanticTestIds:/semantic|meaning|interpret|reviewer|research/i.test(statement)?['verify-semantic-invariant.mjs']:[],mutationTestIds:[],candidateGovernanceMutationTestIds:mutations,testTraceStatus:'CANDIDATE_FILE_MAPPING',productionOwnerStatus:'CANDIDATE_MODULE_MAPPING',observableExpectedBehavior:statement,requiredBrowserOrPhysicalDeviceProof:/iPhone|physical device/i.test(statement)?['ACTUAL_IPHONE_SAFARI']:/browser|viewport|operator|UI\b/i.test(statement)?['LOCAL_AND_DEPLOYED_BROWSER']:[],acceptanceReportField:'normativeRequirementTrace.'+entry.normativeRequirementId,currentDisposition:'UNKNOWN',currentDispositionReason:'Reviewed current controlling-source scope. Implementation and executed proof remain unestablished.'};
  });
  const bound=new Set,allowed=new Set(['productionOwners','executedEvidence','unresolvedRequirements','currentDisposition','currentDispositionReason','responsibleImplementationOwner','deterministicTestIds','mutationTestIds','observableExpectedBehavior','requiredEvidence','applicableStagesAndOperations']);
  for(const binding of evidence.requirements??[]){const row=requirements.find(row=>row.normativeRequirementId===binding.normativeRequirementId);need(row&&!bound.has(row.normativeRequirementId)&&row.sourceLocation.lineSha256===binding.sourceLineSha256&&(row.entryKind!=='ATOMIC_OBLIGATION'||binding.atomicObligationSha256===row.atomicObligation.sha256)&&Object.keys(binding.fields??{}).every(key=>allowed.has(key))&&binding.fields.currentDisposition!=='CONFORMANT_PROVEN'&&!Object.hasOwn(binding.fields,'executedEvidence'),'INSERTION_GENERATOR_BINDING','Current binding is stale, duplicated or inherits proof.');bound.add(row.normativeRequirementId);Object.assign(row,binding.fields);}
  const sourceSha256=sha(sourceBytes),generatorVersion='closed-loop-governance-generator/11',contractProfileId='closed-loop-completion-profile/1',sid=(prefix,value)=>prefix+'-'+valueSha(value).slice(0,32),summary=sourceInventorySummary(requirements);
  const nm=encodeNormativeManifest({...summary,schema:'closed-loop-normative-requirements/1',manifestIdentity:sid('NRM',{sourceSha256,generatorVersion}),generatorVersion,contractProfileId,sourceCommit,specificationPath,specificationSha256:sourceSha256,specificationByteLength:sourceBytes.length,requirements,requirementIdentityCrosswalk:atomic.requirementIdentityCrosswalk,sectionInventory:sections,approvedClarifications:[],approvedAmendments:structuredClone(evidence.approvedAmendments),nonnormativeSections:sections.filter(row=>row.disposition==='NONNORMATIVE').map(row=>({section:row.sectionId,reason:row.reason})),sourceLineCoverage:data.sourceLineCoverage,omissionChallenge:{atomicExtraction:atomic.descriptor,sourceTraceScope:'Reviewed immutable base plus approved insertion-only source continuation; execution conformance remains separate.',sourceContinuation:{descriptor:structuredClone(evidence.atomicExtraction.continuation),sourceTrace:data.sourceTrace,contextGraph:data.contextGraph,dependencyIdentity:atomic.continuation.dependencyIdentity},historicalSourceContractFindings:data.originalContractFindings,unresolvedContractFindings:currentFindings,contractMeaningResolution:meaning,contractAcceptanceStatus:currentFindings.length?'SOURCE_MEANINGS_UNRESOLVED':'SOURCE_MEANINGS_RESOLVED_IMPLEMENTATION_UNKNOWN',independentReviewStatus:'COMPOSED_REVIEWED_SOURCE_PASS',reconciliationStatus:'ACCEPTED',historicalIndependentSourceReview:structuredClone(evidence.independentSourceReview),independentReviewEvidence:{evidenceBasis:'VALIDATED_IMMUTABLE_BASE_AND_INDEPENDENT_APPROVED_SOURCE_DELTA',semanticCompletenessEstablished:true,semanticSourceCoverageEstablished:true,atomicRequirementCompletenessEstablished:true,reviewedSourceSha256:sourceSha256,originalReviewsRelabeled:false,implementationConformance:false},reconciliationEvidence:{status:'ACCEPTED',materialDisagreements:[],missingReviewerCandidateLines:[],sourcePopulationCounts:data.predecessorDispositionCounts,implementationConformance:false}},manifestSha256:null});
  const hashManifest=record=>{const copy={...record};delete copy.manifestSha256;record.manifestSha256=valueSha(copy);};hashManifest(nm);const normativeBytes=Buffer.from(JSON.stringify(nm,null,2)+'\n');
  const sm={schema:'closed-loop-specification-manifest/1',manifestIdentity:sid('SPEC-MANIFEST',{sourceSha256,generatorVersion}),generatorVersion,sourceCommit,repositoryPath:specificationPath,artifactFilename:specificationPath.split('/').at(-1),byteLength:sourceBytes.length,sha256:sourceSha256,physicalLineCount:sourceBytes.reduce((n,byte)=>n+(byte===10),0),logicalLineCount:sourceBytes.toString('utf8').split('\n').length,sectionInventory:sections,contractProfileId,normativeRequirementManifestIdentity:nm.manifestIdentity,normativeRequirementManifestSha256:sha(normativeBytes),normativeRequirementManifestCanonicalSha256:nm.manifestSha256,normativeRequirementManifestPath:'specification/closed-loop-normative-requirements.json',...summary,challengeAndReconciliation:{independentReviewerIdentity:d.semanticDelta.independentReview.sha256,independentReconciliationIdentity:d.semanticDelta.reconciliation.sha256,sourceCoverageOnly:false,atomicRequirementCompletenessEstablished:true,status:'ACCEPTED',originalReviewsRelabeled:false},manifestSha256:null};hashManifest(sm);
  return {specificationManifest:sm,normativeManifest:nm,specificationBytes:Buffer.from(JSON.stringify(sm,null,2)+'\n'),normativeBytes,atomic};
}
