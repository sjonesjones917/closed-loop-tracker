import fs from 'node:fs';
import './hash.js';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REVIEWER_VERSION='closed-loop-independent-section-review/1';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

// Atomic interpretation is supplied by reviewed, file-pinned evidence. The
// mechanical line scanner below remains an omission challenge, not an atomizer.
const atomicHash=value=>globalThis.closedLoopHash.sha256Value(value);
const atomicEqual=(a,b)=>globalThis.closedLoopHash.stableStringify(a)===globalThis.closedLoopHash.stableStringify(b);
const atomicText=value=>typeof value==='string'&&value.trim().length>0;
const atomicDigest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const atomicList=(values,label)=>{assert(Array.isArray(values)&&new Set(values).size===values.length,`Atomic ${label} absent or duplicated`);return values;};
const atomicId=value=>typeof value==='string'&&/^NREQ-[0-9a-f]{32}$/.test(value);
export function atomicObligationSha256(scope){
  assert(scope&&typeof scope==='object','Atomic scope absent');
  return atomicHash({key:scope.key,statement:scope.statement,sourceSpans:scope.sourceSpans,contextSourceLocations:scope.contextSourceLocations});
}
export function validateAtomicRequirementRows(sourceBytes,requirements,specificationPath,sections=[]){
  const lines=new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes).split('\n'),starts=[];
  let offset=0;for(const line of lines){starts.push(offset);offset+=Buffer.byteLength(line)+1;}
  const byId=new Map(),byLine=new Map(),membership=new Map(),keys=new Set(),scopes=new Set();
  const link=(line,id)=>{if(!membership.has(line))membership.set(line,new Set());membership.get(line).add(id);};
  const anchor=(location,controllingText)=>{
    const line=location?.startLine;
    assert(location?.path===specificationPath&&Number.isSafeInteger(line)&&line>0&&line<=lines.length&&location.endLine===line,'Atomic source anchor invalid');
    assert(location.lineSha256===sha256(Buffer.from(lines[line-1]))&&controllingText===lines[line-1].trim(),'Atomic source anchor bytes mismatch');
    return line;
  };
  assert(Array.isArray(requirements)&&requirements.length>0,'Atomic active entries absent');
  for(const row of requirements){
    const id=row.normativeRequirementId;
    assert(atomicId(id)&&!byId.has(id),'Atomic requirement ID missing or duplicated');byId.set(id,row);
    const line=anchor(row.sourceLocation,row.controllingText);
    if(sections.length)assert(sections.some(s=>s.sectionId===row.sectionId&&line>=s.startLine&&line<=s.endLine)||row.sectionId==='preamble'&&line<sections[0].startLine,'Atomic requirement section/anchor mismatch');
    if(!byLine.has(line))byLine.set(line,[]);byLine.get(line).push(row);link(line,id);
    assert(['ATOMIC_OBLIGATION','SOURCE_CONTEXT'].includes(row.entryKind),'Atomic entry kind missing');
    if(row.entryKind==='SOURCE_CONTEXT'){
      assert(!Object.hasOwn(row,'atomicObligation'),'Atomic scope on context entry');
      const c=row.contextClassification;
      assert(c&&['STRUCTURAL_REQUIREMENT_CONTEXT','HISTORICAL_NONNORMATIVE_CONTEXT'].includes(c.classification)&&atomicText(c.reason),'Atomic context classification absent');
      atomicList(c.governingNormativeRequirementIds,'context governing IDs');continue;
    }
    assert(!Object.hasOwn(row,'contextClassification'),'Atomic obligation carries context exclusion');
    const scope=row.atomicObligation;
    assert(scope&&atomicText(scope.statement)&&/^[a-z][a-z0-9.-]*$/.test(scope.key||''),'Atomic proposition/key absent');
    assert(atomicEqual(Object.keys(scope).sort(),['key','statement','sourceSpans','contextSourceLocations','sha256'].sort()),'Atomic scope fields mismatch');
    const key=`${line}:${scope.key}`;assert(!keys.has(key),'Atomic key duplicated at primary anchor');keys.add(key);
    assert(Array.isArray(scope.sourceSpans)&&scope.sourceSpans.length>0,'Atomic source spans absent');
    let previous=-1;const spanKeys=new Set();
    for(const span of scope.sourceSpans){
      assert(atomicEqual(Object.keys(span).sort(),['startByte','endByte','text','sha256'].sort()),'Atomic span fields mismatch');
      assert(Number.isSafeInteger(span.startByte)&&Number.isSafeInteger(span.endByte)&&span.startByte>=starts[line-1]&&span.endByte<=starts[line-1]+Buffer.byteLength(lines[line-1])&&span.endByte>span.startByte&&span.startByte>=previous,'Atomic source span outside primary line or unordered');
      previous=span.startByte;const spanKey=`${span.startByte}:${span.endByte}`;assert(!spanKeys.has(spanKey),'Atomic source span duplicated');spanKeys.add(spanKey);
      const exact=sourceBytes.subarray(span.startByte,span.endByte);let decoded;try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(exact);}catch{throw Error('Atomic source span splits UTF-8 code point');}
      assert(atomicText(span.text)&&decoded===span.text&&sha256(exact)===span.sha256,'Atomic source span bytes/hash mismatch');
    }
    assert(Array.isArray(scope.contextSourceLocations),'Atomic context anchors absent');
    let prior=0;for(const context of scope.contextSourceLocations){
      assert(atomicEqual(Object.keys(context).sort(),['path','startLine','endLine','lineSha256','controllingText'].sort()),'Atomic context fields mismatch');
      const n=anchor(context,context.controllingText);assert(n!==line&&n>prior,'Atomic context anchors duplicate, self-linked or unordered');prior=n;link(n,id);
    }
    assert(atomicDigest(scope.sha256)&&scope.sha256===atomicObligationSha256(scope),'Atomic scope digest mismatch');
    // Different keys must not double count identical reviewed propositions.
    const semantic=atomicHash({statement:scope.statement,sourceSpans:scope.sourceSpans,contextSourceLocations:scope.contextSourceLocations});
    assert(!scopes.has(semantic),'Atomic reviewed scope duplicated');scopes.add(semantic);
  }
  for(const row of requirements.filter(row=>row.entryKind==='SOURCE_CONTEXT')){
    const c=row.contextClassification,line=row.sourceLocation.startLine;
    for(const id of c.governingNormativeRequirementIds){const child=byId.get(id);assert(child?.entryKind==='ATOMIC_OBLIGATION','Atomic context references missing/non-atomic governing entry');if(c.classification==='STRUCTURAL_REQUIREMENT_CONTEXT')assert(child.atomicObligation.contextSourceLocations.some(location=>location.startLine===line),'Atomic governing entry omitted required context');}
    if(c.classification==='STRUCTURAL_REQUIREMENT_CONTEXT'){
      assert(c.governingNormativeRequirementIds.length>0&&Array.isArray(c.governingSourceRanges)&&c.governingSourceRanges.length>0,'Atomic structural context lacks governing ranges');
      let last=0;for(const range of c.governingSourceRanges){assert(Array.isArray(range)&&range.length===2&&Number.isSafeInteger(range[0])&&Number.isSafeInteger(range[1])&&range[0]>last&&range[1]>=range[0]&&range[1]<=lines.length,'Atomic context governing range invalid');last=range[1];}
      const expected=requirements.filter(child=>child.entryKind==='ATOMIC_OBLIGATION'&&c.governingSourceRanges.some(([a,b])=>child.sourceLocation.startLine>=a&&child.sourceLocation.startLine<=b)).map(child=>child.normativeRequirementId).sort();
      assert(atomicEqual([...c.governingNormativeRequirementIds].sort(),expected),'Atomic context governing range membership incomplete');
    }
  }
  return {byId,byLine,membership};
}
export function validateAtomicLineMembership(requirements,coverage,sourceBytes,specificationPath,sections=[]){
  const result=validateAtomicRequirementRows(sourceBytes,requirements,specificationPath,sections),lines=sourceBytes.toString('utf8').split('\n');
  assert(Array.isArray(coverage)&&coverage.length===lines.length,'Atomic source line universe incomplete');
  for(let i=0;i<lines.length;i++){
    const row=coverage[i],expected=[...(result.membership.get(i+1)||[])].sort();
    assert(row?.line===i+1&&row.lineSha256===sha256(Buffer.from(lines[i])),'Atomic line coverage source mismatch');
    atomicList(row.normativeRequirementIds,'line coverage IDs');
    assert(atomicEqual(row.normativeRequirementIds,expected),'Atomic primary/context reverse membership mismatch');
    if(expected.length)assert(row.status===(result.byLine.has(i+1)?'NORMATIVE_REQUIREMENT':'NORMATIVE_CONTEXT'),'Atomic line disposition mismatch');
    else assert(!['NORMATIVE_REQUIREMENT','NORMATIVE_CONTEXT','UNRESOLVED_CONTEXT'].includes(row.status)&&atomicText(row.reason),'Atomic unclassified source line');
  }
  return result;
}
function atomicEvidenceFile(ref,readFile){
  assert(ref&&typeof ref.path==='string'&&/^(?:verification|specification)\/[a-zA-Z0-9_./-]+\.json$/.test(ref.path)&&!ref.path.split('/').includes('..')&&atomicDigest(ref.sha256),'Atomic evidence file identity invalid');
  const bytes=readFile(ref.path);assert(sha256(bytes)===ref.sha256,'Atomic evidence file digest mismatch');return JSON.parse(bytes);
}
export function validateAtomicIdentityCrosswalk(crosswalk,prior,priorRef,requirements,decisions,sourceBytes,relocations=null){
  const active=new Map(requirements.map(row=>[row.normativeRequirementId,row])),old=new Map(prior.requirements.map(row=>[row.normativeRequirementId,row])),seen=new Set();
  assert(old.size===prior.requirements.length&&Array.isArray(crosswalk)&&crosswalk.length===old.size,'Atomic crosswalk predecessor universe incomplete');
  for(const row of crosswalk){
    const before=old.get(row.priorNormativeRequirementId),decision=decisions.get(row.reconciliationDecisionId),targets=atomicList(row.currentNormativeRequirementIds,'crosswalk targets');
    assert(before&&!seen.has(row.priorNormativeRequirementId),'Atomic crosswalk predecessor missing or duplicated');seen.add(row.priorNormativeRequirementId);
    assert(row.priorManifestSha256===priorRef.sha256&&row.priorSpecificationSha256===prior.specificationSha256&&atomicEqual(row.priorSourceLocation,before.sourceLocation),'Atomic crosswalk historical identity stale');
    assert(atomicText(row.reason)&&decision&&targets.every(id=>active.has(id)&&decision.currentNormativeRequirementIds.includes(id)),'Atomic crosswalk unresolved or unknown target');
    if(targets.length){
      const relocated=relocations?.get(row.priorNormativeRequirementId),expectedLine=relocated?.targetSourceLine??before.sourceLocation.startLine;
      for(const id of targets){const target=active.get(id);assert([target.sourceLocation,...(target.atomicObligation?.contextSourceLocations||[])].some(location=>location.startLine===expectedLine&&location.lineSha256===before.sourceLocation.lineSha256),'Atomic crosswalk target lost predecessor source anchor');}
    }
    if(row.relation==='UNCHANGED_ATOMIC'){
      assert(targets.length===1&&targets[0]===row.priorNormativeRequirementId&&active.get(targets[0]).entryKind==='ATOMIC_OBLIGATION','Atomic unchanged crosswalk identity invalid');
      assert(before.entryKind==='ATOMIC_OBLIGATION'?before.atomicObligation.sha256===active.get(targets[0]).atomicObligation.sha256:decision.priorWasSingleObligation===true,'Atomic legacy singleton equivalence not reviewed');
    }else if(row.relation==='SPLIT_COMPOUND')assert(targets.length>=2&&!active.has(row.priorNormativeRequirementId)&&targets.every(id=>active.get(id).entryKind==='ATOMIC_OBLIGATION'&&!old.has(id)),'Atomic compound ancestor reused or double counted');
    else if(row.relation==='RETAINED_CONTEXT')assert(targets.length===1&&targets[0]===row.priorNormativeRequirementId&&active.get(targets[0]).entryKind==='SOURCE_CONTEXT','Atomic retained context identity invalid');
    else if(row.relation==='MERGED_EQUIVALENT'){
      assert(targets.length===1&&atomicText(decision.equivalenceReason),'Atomic many-to-one equivalence not reviewed');
      const target=active.get(targets[0]);assert(target.entryKind==='ATOMIC_OBLIGATION'&&[target.sourceLocation,...target.atomicObligation.contextSourceLocations].some(location=>location.lineSha256===before.sourceLocation.lineSha256),'Atomic merged predecessor source context lost');
    }else if(row.relation==='REMOVED_FROM_CONTROLLING_SOURCE')assert(targets.length===0&&!active.has(row.priorNormativeRequirementId)&&atomicText(decision.removalAuthority)&&!sourceBytes.toString('utf8').split('\n').some(line=>line.trim()===before.controllingText),'Atomic current source obligation improperly removed');
    else assert(false,'Atomic crosswalk relation invalid');
  }
  const incoming=new Map();for(const row of crosswalk)for(const id of row.currentNormativeRequirementIds){if(!incoming.has(id))incoming.set(id,[]);incoming.get(id).push(row);}
  for(const rows of incoming.values())if(rows.length>1)assert(rows.every(row=>row.relation==='MERGED_EQUIVALENT'&&row.reconciliationDecisionId===rows[0].reconciliationDecisionId),'Atomic crosswalk target double counted');
  for(const entry of requirements){
    if(old.has(entry.normativeRequirementId)){assert(incoming.has(entry.normativeRequirementId),'Atomic historical ID recycled without crosswalk');continue;}
    assert(entry.entryKind==='ATOMIC_OBLIGATION','Atomic new context ID has no historical source');
    const birth={sourceSha256:sha256(sourceBytes),sourceAnchor:{line:entry.sourceLocation.startLine,lineSha256:entry.sourceLocation.lineSha256},atomicKey:entry.atomicObligation.key};
    assert(atomicEqual(entry.birthIdentity,birth)&&entry.normativeRequirementId===`NREQ-${atomicHash(birth).slice(0,32)}`,'Atomic birth identity mismatch');
  }
}
// Returns no active replacement until the complete independent challenge and
// distinct reconciliation are present. Source-only booleans are never inputs.
export function loadReviewedAtomicExtraction(descriptor,{sourceBytes,specificationPath,sections,priorRequirements=null,readFile=file=>fs.readFileSync(file)}={}){
  if(!descriptor||descriptor.status==='PENDING')return {established:false,descriptor:descriptor||{status:'PENDING'}};
  assert(descriptor.status==='RECONCILED','Atomic extraction status invalid');
  const sourceSha256=sha256(sourceBytes),refs=[descriptor.draft,descriptor.independentReview,descriptor.reconciliation];
  assert(refs.every(ref=>ref&&atomicText(ref.actorId)&&atomicText(ref.contextId)&&ref.specificationSha256===sourceSha256)&&new Set(refs.map(ref=>ref.actorId)).size===3&&new Set(refs.map(ref=>ref.contextId)).size===3,'Atomic extraction/review/reconciliation independence missing');
  assert(descriptor.independentReview.draftManifestReceived===false,'Atomic reviewer received draft manifest');
  const [draft,review,reconciliation]=refs.map(ref=>atomicEvidenceFile(ref,readFile));
  for(const [i,record] of [draft,review,reconciliation].entries()){
    assert(record.actorId===refs[i].actorId&&record.contextId===refs[i].contextId&&record.specificationSha256===sourceSha256&&record.complete===true,'Atomic authored evidence identity/incomplete pass');
    assert(Array.isArray(record.inputs)&&record.inputs.some(input=>input.path===specificationPath&&input.sha256===sourceSha256),'Atomic authored evidence source input absent');
  }
  assert(review.draftManifestReceived===false&&review.inputs.length===1,'Atomic independent reviewer input isolation false');
  const validateSections=(record,rows,idKey,memberKey)=>{
    assert(Array.isArray(record.sections)&&record.sections.length===sections.length,'Atomic section coverage incomplete');
    const members=new Set();
    for(let i=0;i<sections.length;i++){
      const section=sections[i],actual=record.sections[i];
      assert(actual.sectionId===section.sectionId&&actual.startLine===section.startLine&&actual.endLine===section.endLine&&atomicText(actual.reason),'Atomic section source identity mismatch');
      const ids=atomicList(actual[memberKey],'section membership');
      assert(['COVERED','NONNORMATIVE'].includes(actual.disposition)&&(actual.disposition==='COVERED'?ids.length>0:ids.length===0),'Atomic section disposition unresolved');
      for(const id of ids){const row=rows.get(id),line=row?.primarySourceLine??row?.sourceLocation?.startLine;assert(row&&!members.has(id)&&line>=section.startLine&&line<=section.endLine,'Atomic section member missing, duplicate or misanchored');members.add(id);}
    }
    for(const row of rows.values()){const line=row.primarySourceLine??row.sourceLocation?.startLine;assert(members.has(row[idKey])||line<sections[0].startLine,'Atomic proposition/entry omitted from sections');}
  };
  const extracts=[draft,review].map((record,index)=>{
    assert(record.schema==='closed-loop-atomic-extraction-evidence/1'&&record.role===(index?'INDEPENDENT_REVIEW':'DRAFT')&&Array.isArray(record.propositions)&&record.propositions.length>0,'Atomic extraction record invalid');
    const rows=new Map(),lines=sourceBytes.toString('utf8').split('\n');
    for(const row of record.propositions){assert(atomicText(row.propositionId)&&!rows.has(row.propositionId)&&atomicText(row.statement)&&Number.isSafeInteger(row.primarySourceLine)&&row.primarySourceLine>0&&row.primarySourceLine<=lines.length&&row.sourceLineSha256===sha256(Buffer.from(lines[row.primarySourceLine-1]))&&Array.isArray(row.contextSourceLocations),'Atomic extraction proposition invalid');for(const context of row.contextSourceLocations)assert(context?.path===specificationPath&&Number.isSafeInteger(context.startLine)&&context.startLine>0&&context.startLine<=lines.length&&context.endLine===context.startLine&&context.lineSha256===sha256(Buffer.from(lines[context.startLine-1]))&&context.controllingText===lines[context.startLine-1].trim(),'Atomic extraction qualifier/context source mismatch');rows.set(row.propositionId,row);}
    validateSections(record,rows,'propositionId','propositionIds');return rows;
  });
  assert(reconciliation.schema==='closed-loop-atomic-reconciliation/1'&&reconciliation.status==='RECONCILED'&&Array.isArray(reconciliation.unresolvedMaterialDisagreements)&&reconciliation.unresolvedMaterialDisagreements.length===0,'Atomic material disagreements unresolved');
  for(const ref of [descriptor.draft,descriptor.independentReview,reconciliation.priorManifest])assert(ref&&reconciliation.inputs.some(input=>input.path===ref.path&&input.sha256===ref.sha256),'Atomic reconciliation input lineage incomplete');
  const prior=atomicEvidenceFile(reconciliation.priorManifest,readFile);
  assert(prior.schema==='closed-loop-normative-requirements/1'&&Array.isArray(prior.requirements),'Atomic pinned predecessor manifest invalid');
  const sourcePrior=reconciliation.sourceTraceManifest?atomicEvidenceFile(reconciliation.sourceTraceManifest,readFile):prior;
  if(reconciliation.sourceTraceManifest)assert(reconciliation.inputs.some(input=>input.path===reconciliation.sourceTraceManifest.path&&input.sha256===reconciliation.sourceTraceManifest.sha256),'Atomic source trace predecessor input missing');
  assert(sourcePrior.schema==='closed-loop-normative-requirements/1'&&sourcePrior.specificationSha256===sourceSha256&&Array.isArray(sourcePrior.requirements),'Atomic source trace predecessor differs from current source');
  const traceIdentity=rows=>rows.map(row=>({id:row.normativeRequirementId,sectionId:row.sectionId,sourceLocation:row.sourceLocation,controllingText:row.controllingText}));
  if(priorRequirements)assert(atomicEqual(traceIdentity(sourcePrior.requirements),traceIdentity(priorRequirements)),'Atomic predecessor differs from reviewed current source traces');
  let relocations=null;
  if(prior.specificationSha256!==sourceSha256){
    const ref=reconciliation.historicalSourceRelocationCrosswalk,relocation=atomicEvidenceFile(ref,readFile);
    assert(reconciliation.inputs.some(input=>input.path===ref.path&&input.sha256===ref.sha256),'Atomic historical relocation input absent');
    assert(relocation.schema==='closed-loop-source-relocation-crosswalk/1'&&relocation.priorManifestFileSha256===reconciliation.priorManifest.sha256&&relocation.priorSpecificationSha256===prior.specificationSha256&&relocation.targetSpecificationSha256===sourceSha256&&relocation.semanticAtomicEquivalenceEstablished===false&&relocation.implementationConformanceClaim===false&&Array.isArray(relocation.crosswalk)&&relocation.crosswalk.length===prior.requirements.length,'Atomic historical relocation source identity mismatch');
    relocations=new Map();const currentLines=sourceBytes.toString('utf8').split('\n');
    for(const row of relocation.crosswalk){
      const previous=prior.requirements.find(entry=>entry.normativeRequirementId===row.priorNormativeRequirementId);
      assert(previous&&!relocations.has(row.priorNormativeRequirementId)&&atomicEqual(previous.sourceLocation,row.priorSourceLocation)&&row.priorControllingText===previous.controllingText&&row.priorRawLineSha256===previous.sourceLocation.lineSha256,'Atomic historical relocation predecessor changed');
      if(['EXACT_SOURCE_LINE_RELOCATION','EXACT_LINE_NOW_CLASSIFIED_NONNORMATIVE'].includes(row.relation)){
        assert(Number.isSafeInteger(row.targetSourceLine)&&row.targetSourceLine>0&&row.targetSourceLine<=currentLines.length&&sha256(Buffer.from(currentLines[row.targetSourceLine-1]))===row.targetRawLineSha256&&row.targetRawLineSha256===row.priorRawLineSha256,'Atomic historical relocation source bytes changed');
        const targets=sourcePrior.requirements.filter(entry=>entry.sourceLocation.startLine===row.targetSourceLine).map(entry=>entry.normativeRequirementId).sort();
        assert(atomicEqual([...row.targetSourceTraceIds].sort(),targets),'Atomic historical relocation target trace changed');
      }else assert(row.relation==='ABSENT_OR_CHANGED_IN_TARGET_SOURCE','Atomic historical relocation relation invalid');
      relocations.set(row.priorNormativeRequirementId,row);
    }
  }

  const entries=reconciliation.entries,{byId,membership}=validateAtomicRequirementRows(sourceBytes,entries,specificationPath,sections);
  for(const row of sourcePrior.requirements)assert(membership.has(row.sourceLocation.startLine),'Atomic reviewed source-trace obligation/context omitted');
  validateSections(reconciliation,byId,'normativeRequirementId','normativeRequirementIds');
  const decisions=new Map(),resolved=[new Set(),new Set()],mapped=new Set();
  assert(Array.isArray(reconciliation.decisions)&&reconciliation.decisions.length>0,'Atomic reconciliation decisions absent');
  for(const decision of reconciliation.decisions){
    assert(atomicText(decision.decisionId)&&!decisions.has(decision.decisionId)&&atomicText(decision.reason),'Atomic reconciliation decision missing or duplicated');decisions.set(decision.decisionId,decision);
    const targets=atomicList(decision.currentNormativeRequirementIds,'decision targets');
    assert(['MAPPED','NONNORMATIVE'].includes(decision.disposition)&&(decision.disposition==='MAPPED'?targets.length>0:targets.length===0),'Atomic reconciliation decision unresolved');
    const sourceIds=[decision.draftPropositionIds,decision.independentReviewPropositionIds];
    assert(sourceIds.every(Array.isArray)&&sourceIds.some(ids=>ids.length>0),'Atomic decision source propositions absent');
    for(let i=0;i<2;i++)for(const id of atomicList(sourceIds[i],'decision proposition IDs')){assert(extracts[i].has(id)&&!resolved[i].has(id),'Atomic proposition missing or reconciled twice');resolved[i].add(id);}
    const digests={};
    for(const id of targets){const row=byId.get(id);assert(row,'Atomic decision target absent');mapped.add(id);if(row.entryKind==='ATOMIC_OBLIGATION')digests[id]=row.atomicObligation.sha256;
      const propositions=sourceIds.flatMap((ids,i)=>ids.map(id=>extracts[i].get(id)));
      assert(propositions.some(p=>p.primarySourceLine===row.sourceLocation.startLine),'Atomic decision target lacks primary source support');
      if(row.entryKind==='ATOMIC_OBLIGATION')for(const proposition of propositions.filter(p=>p.primarySourceLine===row.sourceLocation.startLine))for(const context of proposition.contextSourceLocations)assert(row.atomicObligation.contextSourceLocations.some(current=>atomicEqual(current,context)),'Atomic reviewed qualifier/context omitted');
      if(row.entryKind==='SOURCE_CONTEXT')assert(sourceIds.every(ids=>ids.length>0)&&propositions.every(p=>p.classification===row.contextClassification.classification&&atomicText(p.reason)),'Atomic context lacks current independent classification');
    }
    assert(atomicEqual(decision.currentAtomicScopeSha256,digests),'Atomic reconciliation scope digest mismatch');
  }
  assert(resolved.every((set,i)=>set.size===extracts[i].size)&&mapped.size===entries.length,'Atomic proposition reconciliation or active entry coverage incomplete');
  validateAtomicIdentityCrosswalk(reconciliation.requirementIdentityCrosswalk,prior,reconciliation.priorManifest,entries,decisions,sourceBytes,relocations);
  return {established:true,descriptor,entries,requirementIdentityCrosswalk:reconciliation.requirementIdentityCrosswalk,reconciliation,prior,sourcePrior};
}

// Source identity only: this does not establish coverage, provenance reachability, or conformance.
export function validateSpecificationSource(sourceBytes,committedSpec,sourceCommit){
assert(/^[0-9a-f]{40}$/.test(sourceCommit),'Exact specification source commit is unavailable.');
assert(!sourceBytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])),'Specification BOM is prohibited.');
const sourceText=new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes);
assert(!sourceText.includes('\r'),'Specification contains CR or CRLF bytes.');
assert(!sourceText.startsWith('\n'),'Specification has a leading blank line.');
assert(sourceText.endsWith('\n\n')&&!sourceText.endsWith('\n\n\n'),'Specification must preserve the supplied two final LF bytes.');
assert(sourceText.startsWith('The one\n\nClosed-Loop Reliability Application\nZero-Loss Controlling Implementation Specification\n'),'Specification start boundary is wrong.');
assert(sourceText.endsWith('Completion additionally requires the current exact deployed origin and bytes and the pinned actual physical-iPhone Safari operator path.\n\n'),'Specification end boundary is wrong.');
assert(committedSpec.sha256===sha256(sourceBytes),'Committed specification manifest does not bind the exact source bytes.');
assert(committedSpec.byteLength===sourceBytes.length,'Committed specification manifest byte length is wrong.');
assert(committedSpec.sourceCommit===sourceCommit,'Committed specification source commit is wrong.');
return sourceText;
}



// An independently reviewed exclusion is an exact source-evidence tuple, never
// a heuristic permission to omit a historical section or a mandatory clause.
export function validateMechanicalCandidateExclusions(lines,sourceSha256,semanticReview,reconciliation){
  const exclusions=reconciliation.mechanicalCandidateExclusions||[];
  const descriptor=reconciliation.mechanicalCandidateExclusionEvidence;
  if(!descriptor){assert(exclusions.length===0,'Reviewed mechanical exclusion evidence is missing.');return {exclusions:[],mandatoryPreservedLines:[]};}
  const load=(record,base='.')=>{
    assert(record&&typeof record.path==='string'&&/^[0-9a-f]{64}$/.test(record.sha256),'Reviewed mechanical exclusion evidence identity is missing.');
    const file=path.resolve(base,record.path),bytes=fs.readFileSync(file);
    assert(sha256(bytes)===record.sha256,'Reviewed mechanical exclusion evidence digest mismatch.');
    return {file,value:JSON.parse(bytes)};
  };
  const evidence=load(descriptor),review=evidence.value;
  assert(review.schema==='closed-loop-independent-exclusion-evidence/1'&&review.specificationSha256===sourceSha256,'Reviewed mechanical exclusion source mismatch.');
  assert(JSON.stringify(exclusions)===JSON.stringify(review.mechanicalCandidateExclusions),'Reviewed mechanical exclusion inventory mismatch.');
  const originalB=load(review.independentReview,path.dirname(evidence.file)).value;
  const originalA=load(review.independentExtractorA,path.dirname(evidence.file)).value;
  assert(originalB.source?.sha256===sourceSha256&&originalB.complete_independent_pass===true&&originalB.independence?.other_extractions_read===false&&originalB.independence?.repository_implementation_read===false,'Reviewed mechanical exclusion independent B basis mismatch.');
  assert(semanticReview.normalizationProvenance?.frozenSourceReviewSha256===review.independentReview.sha256&&semanticReview.normalizationProvenance?.semanticContentChanged===false,'Reviewed mechanical exclusion normalized review mismatch.');
  assert(originalA.source_identity?.sha256===sourceSha256&&originalA.source_reading_finished_before_repository_inspection===true&&originalA.repository_or_other_worker_outputs_read_during_independent_phase===false,'Reviewed mechanical exclusion independent A basis mismatch.');
  const pointer=(value,location)=>{
    assert(typeof location==='string'&&location.startsWith('/'),'Reviewed mechanical exclusion pointer is missing.');
    for(const token of location.slice(1).split('/')){const key=token.replace(/~1/g,'/').replace(/~0/g,'~');assert(value!=null&&Object.hasOwn(value,key),'Reviewed mechanical exclusion pointer does not resolve.');value=value[key];}
    return value;
  };
  const seen=new Set,mandatory=new Set(review.mandatoryPreservedLines||[]);
  assert(mandatory.size>0,'Reviewed mechanical exclusion mandatory preservation controls are missing.');
  for(const row of exclusions){
    assert(Number.isInteger(row.line)&&row.line>0&&row.line<lines.length&&!seen.has(row.line)&&!mandatory.has(row.line),'Reviewed mechanical exclusion overlaps or removes a mandatory line.');seen.add(row.line);
    assert(row.sectionId==='51'&&row.classification==='NONNORMATIVE_HISTORICAL_EVIDENCE'&&row.text===lines[row.line-1]&&row.sourceLineSha256===sha256(Buffer.from(lines[row.line-1]))&&row.reason,'Reviewed mechanical exclusion exact source mismatch.');
    const refs=row.independentReviewPointers,classification=pointer(originalB,refs?.classification),exception=pointer(originalB,refs?.exception),block=pointer(originalB,refs?.exactSourceBlock),unit=pointer(originalA,row.extractorAUnitPointer);
    assert(typeof classification==='string'&&classification.length>0&&typeof exception==='string'&&exception.length>0,'Reviewed mechanical exclusion independent classification is missing.');
    assert(block.section==='51'&&Number.isInteger(block.start_line)&&Number.isInteger(block.end_line)&&row.line>=block.start_line&&row.line<=block.end_line,'Reviewed mechanical exclusion is outside its independent source block.');
    const raw=lines.slice(block.start_line-1,block.end_line).join('\n');
    assert(block.verbatim===raw&&block.source_sha256===sha256(Buffer.from(raw+'\n')),'Reviewed mechanical exclusion independent source block mismatch.');
    assert(row.extractorAUnitPointer==='/source_units/'+row.extractorAUnitIndex&&unit.source_anchor==='B:L'+row.line&&unit.text===row.text&&unit.line_sha256===sha256(Buffer.from(row.text+'\n'))&&unit.classification===row.extractorAClassification&&unit.classification==='HISTORICAL_NONNORMATIVE_EVIDENCE','Reviewed mechanical exclusion independent source unit mismatch.');
  }
  for(const line of mandatory)assert(Number.isInteger(line)&&line>0&&line<lines.length&&!seen.has(line),'Reviewed mechanical exclusion mandatory preservation line is invalid.');
  return {exclusions,mandatoryPreservedLines:[...mandatory]};
}

function reviewSpecificationCoverage(SPEC_PATH){
const bytes=fs.readFileSync(SPEC_PATH);
const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const lines=text.split('\n');

const headingMatch=line=>{
  const match=String(line).match(/^(?:(\d+)\.|(\d+(?:\.\d+)+(?:[A-Z])?))\s+(.+?)\s*$/);
  return match?{sectionId:match[1]||match[2],title:match[3]}:null;
};
const headings=[];
for(let index=0;index<lines.length;index++){
  const match=headingMatch(lines[index]);
  if(!match)continue;
  const blankBefore=index===0||lines[index-1].trim()==='';
  const blankAfter=index===lines.length-1||lines[index+1].trim()==='';
  if(blankBefore&&blankAfter)headings.push({...match,startLine:index+1});
}
for(let index=0;index<headings.length;index++)headings[index].endLine=(headings[index+1]?.startLine||lines.length+1)-1;
const topLevel=headings.filter(item=>/^\d+$/.test(item.sectionId));
const expectedTop=Array.from({length:53},(_,index)=>String(index));
if(topLevel.length!==expectedTop.length||topLevel.some((item,index)=>item.sectionId!==expectedTop[index]))throw new Error('Independent reviewer did not find the exact top-level Section 0 through Section 52 inventory.');
if(new Set(headings.map(item=>item.sectionId)).size!==headings.length)throw new Error('Independent reviewer found duplicate section identifiers.');

const headingByLine=new Map(headings.map(item=>[item.startLine,item]));
let currentSection=null;
const candidateLines=[];
const lineCoverage=[];
const broadNormative=/\b(MUST(?:\s+NOT)?|SHALL(?:\s+NOT)?|REQUIRED|PROHIBITED|REJECT(?:S|ED|ION)?|BLOCKS?|CANNOT|CAN NEVER|NEVER|EXACTLY|ONLY WHEN|COMPLETION|DEFINITION OF DONE|FAILS? CLOSED|DO NOT|MAY NOT)\b/i;
const broadStructure=/^(?:[-*]\s+|\d+\.\s+|Stage\s+\d+\s+—|Role:|Operations:|Completion:|Fields:|[A-Z][A-Z0-9_./-]{2,}(?:\s|$)|[a-z][A-Za-z0-9]+\s*$)/;
const equation=/\s=\s(?:100%|0|1\.0|TRUE|FALSE|ACCEPTED|REJECTED|BLOCKED)\s*$/;
const arrow=/→/;
for(let index=0;index<lines.length;index++){
  const lineNumber=index+1;
  const raw=lines[index];
  const trimmed=raw.trim();
  const heading=headingByLine.get(lineNumber);
  if(heading){
    currentSection=heading;
    const headingNormative=broadNormative.test(heading.title)||/^(?:must|never|do not|completion|definition of done)\b/i.test(heading.title)||['1.1','1.2','1.3','1.4'].includes(heading.sectionId);
    if(headingNormative)candidateLines.push({line:lineNumber,sectionId:heading.sectionId,text:trimmed,textSha256:sha256(Buffer.from(raw,'utf8')),reason:'NORMATIVE_SECTION_HEADING'});
    lineCoverage.push({line:lineNumber,status:headingNormative?'NORMATIVE_SECTION_HEADING':'SECTION_HEADING',sectionId:heading.sectionId,textSha256:sha256(Buffer.from(raw,'utf8'))});
    continue;
  }
  if(!currentSection){
    lineCoverage.push({line:lineNumber,status:trimmed?'DOCUMENT_HEADER':'BLANK',sectionId:null,textSha256:sha256(Buffer.from(raw,'utf8'))});
    continue;
  }
  if(!trimmed){lineCoverage.push({line:lineNumber,status:'BLANK',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8'))});continue;}
  if(trimmed==='⸻'){lineCoverage.push({line:lineNumber,status:'DECORATIVE_SEPARATOR',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8'))});continue;}
  const top=Number(currentSection.sectionId.split('.')[0]);
  const highDensityContractSection=top>=37&&top<=50;
  const candidate=broadNormative.test(trimmed)||broadStructure.test(trimmed)||equation.test(trimmed)||arrow.test(trimmed)||highDensityContractSection;
  if(candidate){
    const reason=broadNormative.test(trimmed)?'NORMATIVE_LANGUAGE':broadStructure.test(trimmed)?'CONTRACT_STRUCTURE':equation.test(trimmed)?'METRIC_EQUATION':arrow.test(trimmed)?'CONTROL_FLOW':'HIGH_DENSITY_CONTRACT_SECTION';
    candidateLines.push({line:lineNumber,sectionId:currentSection.sectionId,text:trimmed,textSha256:sha256(Buffer.from(raw,'utf8')),reason});
    lineCoverage.push({line:lineNumber,status:'NORMATIVE_CANDIDATE',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8')),reason});
  }else{
    lineCoverage.push({line:lineNumber,status:'NONNORMATIVE_CONTEXT',sectionId:currentSection.sectionId,textSha256:sha256(Buffer.from(raw,'utf8')),reason:'No normative language, contract-list structure, metric equation, control-flow arrow, or high-density contract-section rule matched.'});
  }
}

const reviewerSourceBytes=fs.readFileSync(new URL(import.meta.url));
const result={
  schema:'closed-loop-independent-specification-review/1',
  reviewerVersion:REVIEWER_VERSION,
  reviewerIdentitySha256:sha256(reviewerSourceBytes),
  reviewedSourcePath:SPEC_PATH,
  reviewedSourceSha256:sha256(bytes),
  reviewedSourceByteLength:bytes.length,
  draftManifestReceived:false,
  inputs:[SPEC_PATH],
  sectionInventory:headings,
  candidateLines,
  lineCoverage,
  status:'COMPLETE'
};
process.stdout.write(`${JSON.stringify(result)}\n`);

}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))reviewSpecificationCoverage(process.argv[2]||'specification/closed-loop-reliability-controlling-implementation-specification.txt');
