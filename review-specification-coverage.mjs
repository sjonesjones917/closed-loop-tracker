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
    for(const id of c.governingNormativeRequirementIds){const child=byId.get(id);assert(child?.entryKind==='ATOMIC_OBLIGATION','Atomic context references missing/non-atomic governing entry');if(c.classification==='STRUCTURAL_REQUIREMENT_CONTEXT')assert([child.sourceLocation,...child.atomicObligation.contextSourceLocations].some(location=>location.startLine===line),'Atomic governing entry omitted required context');}
    if(c.classification==='STRUCTURAL_REQUIREMENT_CONTEXT'){
      assert(c.governingNormativeRequirementIds.length>0&&Array.isArray(c.governingSourceRanges)&&c.governingSourceRanges.length>0,'Atomic structural context lacks governing ranges');
      let last=0;for(const range of c.governingSourceRanges){assert(Array.isArray(range)&&range.length===2&&Number.isSafeInteger(range[0])&&Number.isSafeInteger(range[1])&&range[0]>last&&range[1]>=range[0]&&range[1]<=lines.length,'Atomic context governing range invalid');last=range[1];}
      const bindings=c.governingOccurrenceBindings??[];assert(Array.isArray(bindings),'Atomic governing occurrence bindings invalid');
      for(const binding of bindings){const child=byId.get(binding.normativeRequirementId);assert(child?.entryKind==='ATOMIC_OBLIGATION'&&binding.currentAtomicObligationSha256===child.atomicObligation.sha256&&Number.isSafeInteger(binding.sourceLine)&&c.governingSourceRanges.some(([a,b])=>binding.sourceLine>=a&&binding.sourceLine<=b)&&binding.sourceLineSha256===sha256(Buffer.from(lines[binding.sourceLine-1]))&&atomicText(binding.reason),'Atomic governing occurrence scope/source binding invalid');}
      const expected=[...new Set([...requirements.filter(child=>child.entryKind==='ATOMIC_OBLIGATION'&&c.governingSourceRanges.some(([a,b])=>child.sourceLocation.startLine>=a&&child.sourceLocation.startLine<=b)).map(child=>child.normativeRequirementId),...bindings.map(binding=>binding.normativeRequirementId)])].sort();
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
export const isAtomicEvidencePath=value=>typeof value==='string'&&/^(?:verification|specification)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:json|txt)$/.test(value)&&path.posix.normalize(value)===value;
export function readAtomicEvidenceBytes(file,cwd=process.cwd()){
  assert(isAtomicEvidencePath(file),'Atomic evidence file path invalid');
  const root=fs.realpathSync(cwd)+path.sep,target=fs.realpathSync(path.resolve(cwd,file));
  assert(target.startsWith(root),'Atomic evidence file escapes first-party source root');
  return fs.readFileSync(target);
}
function atomicEvidenceFile(ref,readFile){
  assert(ref&&isAtomicEvidencePath(ref.path)&&ref.path.endsWith('.json')&&atomicDigest(ref.sha256),'Atomic evidence file identity invalid');
  const bytes=readFile(ref.path);assert(sha256(bytes)===ref.sha256,'Atomic evidence file digest mismatch');return JSON.parse(bytes);
}
export function validateAtomicIdentityCrosswalk(crosswalk,prior,priorRef,requirements,decisions,sourceBytes,relocations=null,priorSourceBytes=null){
  const active=new Map(requirements.map(row=>[row.normativeRequirementId,row])),old=new Map(prior.requirements.map(row=>[row.normativeRequirementId,row])),seen=new Set();
  const currentSourceSha256=sha256(sourceBytes),currentSourceLines=sourceBytes.toString('utf8').split('\n'),historicalBytes=priorSourceBytes??(prior.specificationSha256===currentSourceSha256?sourceBytes:null),historicalSourceValid=Buffer.isBuffer(historicalBytes)&&sha256(historicalBytes)===prior.specificationSha256,historicalSourceLines=historicalSourceValid?new TextDecoder('utf-8',{fatal:true}).decode(historicalBytes).split('\n'):null;
  const verifyPriorContext=context=>{const n=context?.startLine;assert(historicalSourceValid&&context.path===prior.requirements[0]?.sourceLocation.path&&Number.isSafeInteger(n)&&n>0&&n<=historicalSourceLines.length&&context.endLine===n&&context.lineSha256===sha256(Buffer.from(historicalSourceLines[n-1]))&&context.controllingText===historicalSourceLines[n-1].trim(),'Atomic prior scope context differs from exact historical source');};
  const knownPriorContexts=before=>{
    const contexts=[...(before.atomicObligation?.contextSourceLocations||[])];
    for(const range of before.clarificationSourceLocations||[]){const end=range.endLine??range.startLine+range.lineCount-1;assert(historicalSourceValid&&range.path===before.sourceLocation.path&&Number.isSafeInteger(range.startLine)&&Number.isSafeInteger(end)&&range.startLine>0&&end>=range.startLine&&end<=historicalSourceLines.length&&sha256(Buffer.from(historicalSourceLines.slice(range.startLine-1,end).join('\n')+'\n'))===range.textSha256,'Atomic prior clarification context differs from exact historical source');for(let line=range.startLine;line<=end;line++)if(historicalSourceLines[line-1].trim())contexts.push({path:range.path,startLine:line,endLine:line,lineSha256:sha256(Buffer.from(historicalSourceLines[line-1])),controllingText:historicalSourceLines[line-1].trim()});}
    return contexts;
  };
  const scopeChangeFor=(decision,id)=>{
    const changes=decision.scopeChanges??(decision.scopeChange?[decision.scopeChange]:[]);
    assert(Array.isArray(changes)&&!(decision.scopeChanges&&decision.scopeChange)&&new Set(changes.map(c=>c.priorNormativeRequirementId)).size===changes.length,'Atomic per-predecessor scope changes duplicated or ambiguous');
    for(const change of changes)assert(crosswalk.some(row=>row.priorNormativeRequirementId===change.priorNormativeRequirementId&&row.reconciliationDecisionId===decision.decisionId&&row.relation==='CHANGED_SINGLETON_SCOPE'),'Atomic changed scope cannot be labeled without matching predecessor decision');
    return changes.find(change=>change.priorNormativeRequirementId===id);
  };
  assert(old.size===prior.requirements.length&&Array.isArray(crosswalk)&&crosswalk.length===old.size,'Atomic crosswalk predecessor universe incomplete');
  for(const row of crosswalk){
    const before=old.get(row.priorNormativeRequirementId),decision=decisions.get(row.reconciliationDecisionId),targets=atomicList(row.currentNormativeRequirementIds,'crosswalk targets');
    assert(before&&!seen.has(row.priorNormativeRequirementId),'Atomic crosswalk predecessor missing or duplicated');seen.add(row.priorNormativeRequirementId);
    if(historicalSourceValid)verifyPriorContext({...before.sourceLocation,controllingText:before.controllingText});
    assert(row.priorManifestSha256===priorRef.sha256&&row.priorSpecificationSha256===prior.specificationSha256&&atomicEqual(row.priorSourceLocation,before.sourceLocation),'Atomic crosswalk historical identity stale');
    assert(atomicText(row.reason)&&decision&&targets.every(id=>active.has(id)&&decision.currentNormativeRequirementIds.includes(id)),'Atomic crosswalk unresolved or unknown target');
    if(scopeChangeFor(decision,row.priorNormativeRequirementId))assert(row.relation==='CHANGED_SINGLETON_SCOPE','Atomic changed scope cannot be labeled unchanged, split, merged or removed');
    if(targets.length){
      const relocated=relocations?.get(row.priorNormativeRequirementId),expectedLine=relocated?.targetSourceLine??before.sourceLocation.startLine;
      for(const id of targets){const target=active.get(id);assert([target.sourceLocation,...(target.atomicObligation?.contextSourceLocations||[])].some(location=>location.startLine===expectedLine&&location.lineSha256===before.sourceLocation.lineSha256),'Atomic crosswalk target lost predecessor source anchor');}
    }
    if(['UNCHANGED_ATOMIC','MERGED_EQUIVALENT'].includes(row.relation)){
      const known=knownPriorContexts(before);
      for(const id of targets){const target=active.get(id);if(target.entryKind==='ATOMIC_OBLIGATION')for(const context of known)assert(target.atomicObligation.contextSourceLocations.some(current=>current.lineSha256===context.lineSha256&&current.controllingText===context.controllingText),'Atomic unchanged/equivalent scope lost predecessor context');}
      if(prior.specificationSha256!==currentSourceSha256){
        const declarations=Array.isArray(decision.scopeEquivalences)?decision.scopeEquivalences.filter(value=>value.priorNormativeRequirementId===row.priorNormativeRequirementId):[];
        assert(historicalSourceValid&&targets.length===1&&declarations.length===1,'Atomic cross-source scope equivalence review required');
        const equivalence=declarations[0],target=active.get(targets[0]);
        assert(equivalence.currentNormativeRequirementId===targets[0]&&equivalence.priorSpecificationSha256===prior.specificationSha256&&equivalence.currentSpecificationSha256===currentSourceSha256&&atomicText(equivalence.priorStatement)&&equivalence.currentStatement===target.atomicObligation?.statement&&equivalence.currentAtomicObligationSha256===target.atomicObligation.sha256&&atomicText(equivalence.reason)&&Array.isArray(equivalence.priorContextSourceLocations)&&atomicEqual(equivalence.currentContextSourceLocations,target.atomicObligation.contextSourceLocations),'Atomic cross-source scope equivalence binding incomplete');
        for(const context of equivalence.priorContextSourceLocations)verifyPriorContext(context);
        for(const context of known)assert(equivalence.priorContextSourceLocations.some(value=>atomicEqual(value,context)),'Atomic equivalence omits recorded predecessor context');
        const content=locations=>locations.map(context=>atomicHash({lineSha256:context.lineSha256,controllingText:context.controllingText})).sort();
        assert(atomicEqual(content(equivalence.priorContextSourceLocations),content(equivalence.currentContextSourceLocations)),'Atomic changed context cannot be declared equivalent');
        if(before.entryKind==='ATOMIC_OBLIGATION')assert(equivalence.priorStatement===before.atomicObligation.statement,'Atomic equivalence prior statement changed');
      }
    }
    if(row.relation==='UNCHANGED_ATOMIC'){
      assert(targets.length===1&&targets[0]===row.priorNormativeRequirementId&&active.get(targets[0]).entryKind==='ATOMIC_OBLIGATION','Atomic unchanged crosswalk identity invalid');
      assert(before.entryKind==='ATOMIC_OBLIGATION'?before.atomicObligation.sha256===active.get(targets[0]).atomicObligation.sha256:decision.priorWasSingleObligation===true,'Atomic legacy singleton equivalence not reviewed');
    }else if(row.relation==='CHANGED_SINGLETON_SCOPE'){
      assert(targets.length===1&&!active.has(row.priorNormativeRequirementId)&&!old.has(targets[0])&&active.get(targets[0]).entryKind==='ATOMIC_OBLIGATION','Atomic changed singleton must retire its predecessor and allocate one fresh atom');
      assert(!Object.hasOwn(active.get(targets[0]),'executedEvidence')&&!Object.hasOwn(active.get(targets[0]),'fullCoverage'),'Atomic changed singleton cannot inherit predecessor proof');
      const target=active.get(targets[0]),change=scopeChangeFor(decision,row.priorNormativeRequirementId),currentSha256=sha256(sourceBytes),currentLines=sourceBytes.toString('utf8').split('\n');
      assert(Buffer.isBuffer(priorSourceBytes)&&sha256(priorSourceBytes)===prior.specificationSha256,'Atomic changed singleton exact historical source bytes required');
      const priorLines=new TextDecoder('utf-8',{fatal:true}).decode(priorSourceBytes).split('\n');
      assert(decision.priorWasSingleObligation===true&&change&&change.priorNormativeRequirementId===row.priorNormativeRequirementId&&change.currentNormativeRequirementId===targets[0]&&atomicText(change.priorStatement)&&change.currentStatement===target.atomicObligation.statement&&change.currentAtomicObligationSha256===target.atomicObligation.sha256&&atomicText(change.reason),'Atomic changed singleton scope review incomplete');
      assert(change.authority?.kind==='CONTROLLING_SOURCE_REPLACEMENT'&&change.authority.priorSpecificationSha256===prior.specificationSha256&&change.authority.currentSpecificationSha256===currentSha256&&prior.specificationSha256!==currentSha256&&atomicText(change.authority.reason),'Atomic changed singleton source authority mismatch');
      assert(Array.isArray(change.priorContextSourceLocations)&&atomicEqual(change.currentContextSourceLocations,target.atomicObligation.contextSourceLocations),'Atomic changed singleton context inventory incomplete');
      const priorContexts=new Map(),currentContexts=new Map(),contextKey=location=>atomicHash(location),contextContent=location=>atomicHash({lineSha256:location.lineSha256,controllingText:location.controllingText});
      for(const context of knownPriorContexts(before))assert(change.priorContextSourceLocations.some(value=>atomicEqual(value,context)),'Atomic scope change omits recorded predecessor context');
      for(const context of change.priorContextSourceLocations){
        const n=context.startLine;assert(context.path===before.sourceLocation.path&&Number.isSafeInteger(n)&&n>0&&n<=priorLines.length&&context.endLine===n&&context.lineSha256===sha256(Buffer.from(priorLines[n-1]))&&context.controllingText===priorLines[n-1].trim(),'Atomic changed singleton historical context not in pinned predecessor source');
        const key=contextKey(context);assert(!priorContexts.has(key),'Atomic changed singleton historical context duplicated');priorContexts.set(key,context);
      }
      for(const context of change.currentContextSourceLocations){const n=context.startLine;assert(context.path===target.sourceLocation.path&&Number.isSafeInteger(n)&&n>0&&n<=currentLines.length&&context.endLine===n&&context.lineSha256===sha256(Buffer.from(currentLines[n-1]))&&context.controllingText===currentLines[n-1].trim(),'Atomic changed singleton current context source mismatch');const key=contextKey(context);assert(!currentContexts.has(key),'Atomic changed singleton current context duplicated');currentContexts.set(key,context);}
      if(before.entryKind==='ATOMIC_OBLIGATION')assert(change.priorStatement===before.atomicObligation.statement&&atomicEqual(change.priorContextSourceLocations,before.atomicObligation.contextSourceLocations),'Atomic changed singleton prior reviewed scope mismatch');
      const retainedPrior=new Set(),retainedCurrent=new Set();
      if(change.contextRetentions!==undefined){
        assert(Array.isArray(change.contextRetentions),'Atomic context retention inventory invalid');
        for(const pair of change.contextRetentions){const a=contextKey(pair.priorContextSourceLocation??{}),b=contextKey(pair.currentContextSourceLocation??{});assert(priorContexts.has(a)&&currentContexts.has(b)&&!retainedPrior.has(a)&&!retainedCurrent.has(b)&&contextContent(priorContexts.get(a))===contextContent(currentContexts.get(b))&&atomicText(pair.reason),'Atomic context retention pairing invalid');retainedPrior.add(a);retainedCurrent.add(b);}
      }
      for(const [a,previous] of priorContexts)if(!retainedPrior.has(a)){const match=[...currentContexts].find(([b,current])=>!retainedCurrent.has(b)&&contextContent(previous)===contextContent(current));if(match){retainedPrior.add(a);retainedCurrent.add(match[0]);}}
      const expectedRemoved=[...priorContexts.keys()].filter(key=>!retainedPrior.has(key)),expectedAdded=[...currentContexts.keys()].filter(key=>!retainedCurrent.has(key));
      assert(expectedRemoved.length+expectedAdded.length>0&&Array.isArray(change.contextChanges),'Atomic changed singleton has no documented semantic context change');
      const removed=new Set(),added=new Set();
      for(const delta of change.contextChanges){
        assert(atomicText(delta.reason)&&['REMOVED','ADDED','REPLACED'].includes(delta.kind),'Atomic changed singleton context change reason absent');
        if(delta.kind!=='ADDED'){const key=contextKey(delta.priorContextSourceLocation||{});assert(expectedRemoved.includes(key)&&!removed.has(key)&&atomicEqual(delta.priorContextSourceLocation,priorContexts.get(key)),'Atomic changed singleton removed context missing or duplicated');removed.add(key);if(delta.kind==='REMOVED'&&currentLines.some(line=>line.trim()===delta.priorContextSourceLocation.controllingText))assert(atomicText(delta.occurrenceRemovalReason),'Atomic removed context text survives elsewhere without scoped occurrence review');}
        else assert(!Object.hasOwn(delta,'priorContextSourceLocation'),'Atomic added context carries a prior context');
        if(delta.kind!=='REMOVED'){const key=contextKey(delta.currentContextSourceLocation||{});assert(expectedAdded.includes(key)&&!added.has(key)&&atomicEqual(delta.currentContextSourceLocation,currentContexts.get(key)),'Atomic changed singleton added context missing or duplicated');added.add(key);}
        else assert(!Object.hasOwn(delta,'currentContextSourceLocation'),'Atomic removed context carries a current context');
      }
      assert(removed.size===expectedRemoved.length&&added.size===expectedAdded.length,'Atomic changed singleton context difference unresolved');
    }else if(row.relation==='SPLIT_COMPOUND')assert(targets.length>=2&&!active.has(row.priorNormativeRequirementId)&&targets.every(id=>active.get(id).entryKind==='ATOMIC_OBLIGATION'&&!old.has(id)),'Atomic compound ancestor reused or double counted');
    else if(row.relation==='RETAINED_CONTEXT')assert(targets.length===1&&targets[0]===row.priorNormativeRequirementId&&active.get(targets[0]).entryKind==='SOURCE_CONTEXT','Atomic retained context identity invalid');
    else if(row.relation==='MERGED_EQUIVALENT'){
      assert(targets.length===1&&atomicText(decision.equivalenceReason),'Atomic many-to-one equivalence not reviewed');
      const target=active.get(targets[0]);assert(target.entryKind==='ATOMIC_OBLIGATION'&&[target.sourceLocation,...target.atomicObligation.contextSourceLocations].some(location=>location.lineSha256===before.sourceLocation.lineSha256),'Atomic merged predecessor source context lost');
    }else if(row.relation==='COMPONENT_OF_CONTRACT'){
      assert(targets.length>0&&!active.has(row.priorNormativeRequirementId)&&atomicText(decision.containmentReason)&&targets.every(id=>active.get(id).entryKind==='ATOMIC_OBLIGATION'&&(decision.componentConvergenceGroups??[]).some(group=>group.kind==='CONTRACT_COMPONENTS'&&group.currentNormativeRequirementId===id)),'Atomic contained component retirement/review incomplete');
    }else if(row.relation==='REMOVED_FROM_CONTROLLING_SOURCE')assert(targets.length===0&&!active.has(row.priorNormativeRequirementId)&&atomicText(decision.removalAuthority)&&!sourceBytes.toString('utf8').split('\n').some(line=>line.trim()===before.controllingText),'Atomic current source obligation improperly removed');
    else assert(false,'Atomic crosswalk relation invalid');
  }
  const incoming=new Map();for(const row of crosswalk)for(const id of row.currentNormativeRequirementIds){if(!incoming.has(id))incoming.set(id,[]);incoming.get(id).push(row);}
  for(const decision of decisions.values()){
    scopeChangeFor(decision,'');
    const related=crosswalk.filter(row=>row.reconciliationDecisionId===decision.decisionId),groups=decision.componentConvergenceGroups??[],partitions=decision.componentPartitions??[];
    assert(Array.isArray(groups)&&Array.isArray(partitions)&&new Set(groups.map(group=>group.currentNormativeRequirementId)).size===groups.length&&new Set(partitions.map(part=>part.priorNormativeRequirementId)).size===partitions.length,'Atomic component declaration inventory duplicated');
    for(const group of groups)assert(decision.currentNormativeRequirementIds.includes(group.currentNormativeRequirementId)&&related.some(row=>row.currentNormativeRequirementIds.includes(group.currentNormativeRequirementId)),'Atomic component convergence group has no actual decision edge');
    for(const part of partitions)assert(related.some(row=>row.priorNormativeRequirementId===part.priorNormativeRequirementId&&row.currentNormativeRequirementIds.some(id=>groups.some(group=>group.currentNormativeRequirementId===id))),'Atomic component partition has no actual convergence edge');
    const changed=decision.changedDuplicateGroups??(decision.changedDuplicateGroup?[decision.changedDuplicateGroup]:[]);
    assert(Array.isArray(changed)&&!(decision.changedDuplicateGroups&&decision.changedDuplicateGroup)&&new Set(changed.map(group=>group.currentNormativeRequirementId)).size===changed.length&&changed.every(group=>decision.currentNormativeRequirementIds.includes(group.currentNormativeRequirementId)&&related.some(row=>row.relation==='CHANGED_SINGLETON_SCOPE'&&row.currentNormativeRequirementIds.includes(group.currentNormativeRequirementId))),'Atomic changed-duplicate target groups duplicated, unrelated or ambiguous');
  }
  const validateComponentPartition=(row,targetId,groupKind)=>{
    const decision=decisions.get(row.reconciliationDecisionId),partitions=(decision.componentPartitions??[]).filter(p=>p.priorNormativeRequirementId===row.priorNormativeRequirementId),before=old.get(row.priorNormativeRequirementId);
    assert(historicalSourceValid&&partitions.length===1,'Atomic component partition requires exact historical source and one reviewed partition');
    const partition=partitions[0];
    assert(partition.priorSpecificationSha256===prior.specificationSha256&&partition.currentSpecificationSha256===currentSourceSha256&&atomicEqual(partition.priorSourceLocation,before.sourceLocation)&&partition.complete===true&&atomicText(partition.reason)&&Array.isArray(partition.components),'Atomic component partition source or completeness invalid');
    const targets=partition.components.map(c=>c.currentNormativeRequirementId);assert(new Set(targets).size===targets.length&&atomicEqual([...targets].sort(),[...row.currentNormativeRequirementIds].sort()),'Atomic component partition target universe incomplete or duplicated');
    const start=historicalSourceLines.slice(0,before.sourceLocation.startLine-1).reduce((n,line)=>n+Buffer.byteLength(line)+1,0),end=start+Buffer.byteLength(historicalSourceLines[before.sourceLocation.startLine-1]),signatures=new Set();
    for(const component of partition.components){
      const target=active.get(component.currentNormativeRequirementId);
      assert(target?.entryKind==='ATOMIC_OBLIGATION'&&(groupKind==='CONTRACT_COMPONENTS'||!old.has(target.normativeRequirementId))&&component.currentAtomicObligationSha256===target.atomicObligation.sha256&&atomicText(component.priorStatement)&&(row.relation==='COMPONENT_OF_CONTRACT'?component.relationship==='CONTAINED_COMPONENT'&&atomicText(component.containmentReason):component.relationship==='EQUIVALENT_COMPONENT'&&atomicText(component.equivalenceReason))&&Array.isArray(component.sourceSpans)&&component.sourceSpans.length>0&&Array.isArray(component.priorContextSourceLocations)&&atomicEqual(component.currentContextSourceLocations,target.atomicObligation.contextSourceLocations),'Atomic component scope binding incomplete or ancestor reused');
      assert(!Object.hasOwn(target,'executedEvidence')&&!Object.hasOwn(target,'fullCoverage'),'Atomic converged component cannot inherit predecessor proof');
      let last=start;for(const span of component.sourceSpans){assert(Number.isSafeInteger(span.startByte)&&Number.isSafeInteger(span.endByte)&&span.startByte>=last&&span.endByte>span.startByte&&span.endByte<=end&&atomicText(span.text),'Atomic prior component span outside primary source or overlapping');const bytes=historicalBytes.subarray(span.startByte,span.endByte);assert(new TextDecoder('utf-8',{fatal:true}).decode(bytes)===span.text&&sha256(bytes)===span.sha256,'Atomic prior component source bytes/hash mismatch');last=span.endByte;}
      for(const context of component.priorContextSourceLocations){verifyPriorContext(context);assert([{...target.sourceLocation,controllingText:target.controllingText},...component.currentContextSourceLocations].some(current=>current.lineSha256===context.lineSha256&&current.controllingText===context.controllingText),'Atomic converged component lost predecessor scope context');}
      for(const context of knownPriorContexts(before))assert(component.priorContextSourceLocations.some(c=>atomicEqual(c,context)),'Atomic prior component omitted recorded context');
      if(before.entryKind==='ATOMIC_OBLIGATION')assert(partition.components.length===1&&component.priorStatement===before.atomicObligation.statement&&atomicEqual(component.sourceSpans,before.atomicObligation.sourceSpans),'Atomic existing atom cannot be silently decomposed or reinterpreted');
      const signature=atomicHash({statement:component.priorStatement,sourceSpans:component.sourceSpans});assert(row.relation==='COMPONENT_OF_CONTRACT'||!signatures.has(signature),'Atomic component partition double counts one predicate');signatures.add(signature);
    }
    return partition.components.find(c=>c.currentNormativeRequirementId===targetId);
  };
  for(const [targetId,rows] of incoming){
    const groups=rows.map(row=>{
      const decision=decisions.get(row.reconciliationDecisionId),values=decision.changedDuplicateGroups??(decision.changedDuplicateGroup?[decision.changedDuplicateGroup]:[]);
      assert(Array.isArray(values)&&!(decision.changedDuplicateGroups&&decision.changedDuplicateGroup)&&new Set(values.map(group=>group.currentNormativeRequirementId)).size===values.length&&values.every(group=>decision.currentNormativeRequirementIds.includes(group.currentNormativeRequirementId)),'Atomic changed-duplicate target groups duplicated, unrelated or ambiguous');
      return values.find(group=>group.currentNormativeRequirementId===targetId);
    });
    if(groups.some(Boolean)){
      const group=groups[0],priorIds=rows.map(row=>row.priorNormativeRequirementId).sort(),scopeDigests=Object.fromEntries(rows.map(row=>[row.priorNormativeRequirementId,atomicHash(scopeChangeFor(decisions.get(row.reconciliationDecisionId),row.priorNormativeRequirementId)??null)]));
      assert(rows.length>=2&&rows.every(row=>row.relation==='CHANGED_SINGLETON_SCOPE')&&group&&atomicText(group.groupId)&&atomicText(group.priorEquivalenceReason)&&group.currentNormativeRequirementId===targetId&&groups.every(value=>value&&atomicEqual(value,group))&&atomicEqual(group.priorNormativeRequirementIds,priorIds)&&atomicEqual(group.scopeChangeSha256ByPriorId,scopeDigests),'Atomic changed-duplicate equivalence group incomplete or stale');
    }else if(rows.some(row=>(decisions.get(row.reconciliationDecisionId)?.componentConvergenceGroups??[]).some(group=>group.currentNormativeRequirementId===targetId))){
      const declarations=rows.map(row=>(decisions.get(row.reconciliationDecisionId).componentConvergenceGroups??[]).filter(group=>group.currentNormativeRequirementId===targetId)),group=declarations[0][0],target=active.get(targetId),priorIds=rows.map(row=>row.priorNormativeRequirementId).sort();
      const equivalent=group?.kind==='EQUIVALENT_COMPONENTS'&&rows.length>=2&&rows.some(row=>row.relation==='SPLIT_COMPOUND')&&rows.every(row=>['SPLIT_COMPOUND','MERGED_EQUIVALENT'].includes(row.relation)),contained=group?.kind==='CONTRACT_COMPONENTS'&&rows.some(row=>row.relation==='COMPONENT_OF_CONTRACT')&&rows.every(row=>['COMPONENT_OF_CONTRACT','UNCHANGED_ATOMIC','MERGED_EQUIVALENT','SPLIT_COMPOUND'].includes(row.relation))&&rows.filter(row=>row.relation==='UNCHANGED_ATOMIC').length<=1;
      assert((equivalent||contained)&&declarations.every(values=>values.length===1&&atomicEqual(values[0],group))&&atomicText(group?.groupId)&&atomicText(group?.reason)&&group.complete===true&&group.currentAtomicObligationSha256===target.atomicObligation.sha256&&atomicEqual(group.priorNormativeRequirementIds,priorIds),'Atomic component convergence group incomplete, unsupported or stale');
      const digests=Object.fromEntries(rows.map(row=>[row.priorNormativeRequirementId,atomicHash(validateComponentPartition(row,targetId,group.kind))]));
      assert(atomicEqual(group.componentSha256ByPriorId,digests),'Atomic component convergence source/scope binding mismatch');
    }else if(rows.length>1)assert(rows.every(row=>row.relation==='MERGED_EQUIVALENT'&&row.reconciliationDecisionId===rows[0].reconciliationDecisionId),'Atomic crosswalk target double counted');
  }
  for(const entry of requirements){
    if(old.has(entry.normativeRequirementId)){assert(incoming.has(entry.normativeRequirementId),'Atomic historical ID recycled without crosswalk');continue;}
    assert(entry.entryKind==='ATOMIC_OBLIGATION','Atomic new context ID has no historical source');
    const birth={sourceSha256:sha256(sourceBytes),sourceAnchor:{line:entry.sourceLocation.startLine,lineSha256:entry.sourceLocation.lineSha256},atomicKey:entry.atomicObligation.key};
    assert(atomicEqual(entry.birthIdentity,birth)&&entry.normativeRequirementId===`NREQ-${atomicHash(birth).slice(0,32)}`,'Atomic birth identity mismatch');
  }
}
// Returns no active replacement until the complete independent challenge and
// distinct reconciliation are present. Source-only booleans are never inputs.
function atomicPointer(value,pointer){
  assert(typeof pointer==='string'&&(pointer===''||pointer.startsWith('/')),'Atomic projection JSON pointer invalid');
  for(const part of pointer===''?[]:pointer.slice(1).split('/').map(v=>v.replace(/~1/g,'/').replace(/~0/g,'~'))){assert(value!==null&&typeof value==='object'&&Object.hasOwn(value,part),'Atomic projection JSON pointer missing');value=value[part];}return value;
}
export function atomicContributorIdentity(role,constituents){
  const contributors=[...new Map(constituents.map(c=>[`${c.actorId}\0${c.contextId}`,{actorId:c.actorId,contextId:c.contextId}])).values()].sort((a,b)=>a.actorId.localeCompare(b.actorId)||a.contextId.localeCompare(b.contextId)),digest=atomicHash({role,contributors});
  return {actorId:`CONTRIBUTOR-SET:${role}:${digest}`,contextId:`CONTRIBUTOR-CONTEXT-SET:${role}:${digest}`};
}
export function validateAtomicProjection(record,{readFile,sourceBytes,reconciler}){
  const projection=record.mechanicalProjection;
  if(!projection){assert(![record.actorId,record.contextId].some(value=>typeof value==='string'&&/^CONTRIBUTOR-(?:CONTEXT-)?SET:/.test(value)),'Atomic aggregate identity lacks constituent projection');return [{actorId:record.actorId,contextId:record.contextId}];}
  assert(projection.schema==='closed-loop-evidence-projection/1'&&projection.semanticContribution===false&&projection.adapter?.actorId===reconciler.actorId&&projection.adapter?.contextId===reconciler.contextId,'Atomic mechanical projection adapter or semantic contribution invalid');
  assert(['DRAFT','INDEPENDENT_REVIEW'].includes(record.role)&&Array.isArray(projection.constituents)&&projection.constituents.length>0&&Array.isArray(projection.normalizations),'Atomic projection constituents absent');
  const sourceSha256=sha256(sourceBytes),lines=sourceBytes.toString('utf8').split('\n'),seenFiles=new Set(),seenMembers=new Set(),propositions=new Map(record.propositions.map(p=>[p.propositionId,p]));
  for(const constituent of projection.constituents){
    assert(constituent.role===record.role&&!seenFiles.has(constituent.path),'Atomic constituent role invalid or duplicated');seenFiles.add(constituent.path);
    const original=atomicEvidenceFile(constituent,readFile),identity=constituent.identityEvidence?atomicEvidenceFile(constituent.identityEvidence,readFile):original,binding=constituent.identityEvidence??constituent;
    assert(!original.mechanicalProjection&&![constituent.actorId,constituent.contextId].some(value=>typeof value==='string'&&/^CONTRIBUTOR-(?:CONTEXT-)?SET:/.test(value)),'Atomic nested projection is not an original source contributor');
    if(constituent.identityEvidence)assert(atomicPointer(identity,binding.artifactSha256Pointer)===constituent.sha256&&binding.declaredInputsPointer==='','Atomic constituent provenance does not bind frozen artifact/full disclosures');
    assert(atomicText(constituent.actorId)&&atomicText(constituent.contextId)&&atomicPointer(identity,binding.actorIdentityPointer)===constituent.actorId&&atomicPointer(identity,binding.contextIdentityPointer)===constituent.contextId&&atomicPointer(identity,binding.sourceIdentityPointer)===sourceSha256&&atomicEqual(constituent.declaredInputs,atomicPointer(identity,binding.declaredInputsPointer)),'Atomic constituent identity/source/actual inputs mismatch');
    assert(constituent.actorId!==projection.adapter.actorId&&constituent.contextId!==projection.adapter.contextId,'Atomic projection adapter counted as source contributor');
    if(constituent.identityEvidence){
      const prefix=identity.attestation_kind==='original_reviewer_provenance_attestation',tail=identity.artifact_kind==='source_only_review_provenance_attestation';
      assert(prefix||tail,'Atomic constituent identity attestation kind invalid');
      const actorPointer=prefix?'/attestor/actual_canonical_task_name':'/attesting_task';
      assert(binding.actorIdentityPointer===actorPointer&&binding.contextIdentityPointer===actorPointer&&binding.sourceIdentityPointer===(prefix?'/normative_source_input/sha256':'/source_input/sha256')&&binding.artifactSha256Pointer===(prefix?'/frozen_review_artifact/sha256':'/frozen_artifact/sha256'),'Atomic constituent attestation pointer aliases actual identity');
    }else assert(binding.actorIdentityPointer==='/actorId'&&binding.contextIdentityPointer===(original.contextId?'/contextId':'/actorId')&&(original.contextId||original.actorId?.startsWith('/root/'))&&binding.sourceIdentityPointer===(original.source?'/source/sha256':'/specificationSha256')&&binding.declaredInputsPointer==='/inputs','Atomic constituent pointer aliases actual identity/inputs');
    const kind=constituent.memberCollectionPointer;
    let statementPointer,linePointer,classificationPointer=null,role;
    if(kind==='/requirements'&&original.schema==='closed-loop-atomic-extraction-draft/1'&&original.role==='SOURCE_ONLY_DRAFT_EVIDENCE_NOT_AUTHORITATIVE_MANIFEST'){role='DRAFT';statementPointer='/atomicObligation/statement';linePointer='/sourceLocation/startLine';assert(original.source?.sha256===sourceSha256,'Atomic constituent draft source mismatch');}
    else if(kind==='/candidates'&&['independent-source-only-candidate-review','independent-source-only-candidate-review-tail'].includes(original.artifact_kind)){role='INDEPENDENT_REVIEW';statementPointer='/proposition';linePointer='/source_lines/0';assert(original.source?.sha256===sourceSha256&&constituent.identityEvidence,'Atomic constituent blind provenance/source absent');}
    else if(kind==='/classifications'&&['DRAFT_CONTEXT','INDEPENDENT_CONTEXT_REVIEW'].includes(original.role)){role=original.role==='DRAFT_CONTEXT'?'DRAFT':'INDEPENDENT_REVIEW';statementPointer='/reason';linePointer='/line';classificationPointer='/classification';assert(original.specificationSha256===sourceSha256,'Atomic constituent context source mismatch');}
    else if(kind==='/propositions'&&original.schema==='closed-loop-atomic-extraction-evidence/1'){role=original.role;statementPointer='/statement';linePointer='/primarySourceLine';classificationPointer=null;}
    assert(role===record.role,'Atomic frozen constituent role mismatch');
    if(record.role==='INDEPENDENT_REVIEW')assert(original.draftManifestReceived!==true&&original.implementationRead!==true&&identity.draftManifestReceived!==true&&identity.implementationRead!==true,'Atomic constituent blind isolation false');
    const members=atomicPointer(original,kind);assert(Array.isArray(members)&&members.length>0&&Array.isArray(constituent.members)&&constituent.members.length===members.length,'Atomic constituent source membership incomplete');
    const originalMembers=new Set();
    for(const member of constituent.members){
      assert(member.statementPointer===statementPointer&&member.primarySourceLinePointer===linePointer&&(!classificationPointer||member.classificationPointer===classificationPointer),'Atomic member semantic pointer invalid');
      const match=new RegExp('^'+kind+'/([0-9]+)$').exec(member.originalPointer??''),index=match?Number(match[1]):-1;
      assert(index>=0&&index<members.length&&!originalMembers.has(index)&&!seenMembers.has(member.normalizedPropositionId),'Atomic constituent member missing or duplicated');originalMembers.add(index);seenMembers.add(member.normalizedPropositionId);
      const source=members[index],normalized=propositions.get(member.normalizedPropositionId),line=atomicPointer(source,linePointer);
      const originalRange=kind==='/candidates'?source.source_lines:source.sourceRange;
      assert(atomicEqual(normalized?.sourceRange??null,originalRange??null),'Atomic projected original source range changed');
      assert(normalized&&normalized.statement===atomicPointer(source,statementPointer)&&normalized.primarySourceLine===line,'Atomic projected proposition changed or misattributed');
      if(classificationPointer)assert(normalized.classification===atomicPointer(source,classificationPointer),'Atomic projected original classification changed');
      else assert(Object.hasOwn(normalized,'classification')===Object.hasOwn(source,'classification')&&normalized.classification===source.classification,'Atomic projected original classification changed');
      let contextLines=[];
      if(kind==='/requirements')contextLines=source.atomicObligation.contextSourceLocations.map(c=>c.startLine);
      else if(kind==='/candidates')for(const [a,b] of source.supporting_context_lines??[]){assert(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>0&&b>=a&&b<=lines.length,'Atomic constituent context range invalid');for(let n=a;n<=b;n++)if(lines[n-1].trim())contextLines.push(n);}
      else contextLines=(source.contextSourceLocations??[]).map(c=>typeof c==='number'?c:c.startLine);
      const expected=[...new Set(contextLines.filter(n=>n!==line))].sort((a,b)=>a-b),actual=normalized.contextSourceLocations.map(c=>c.startLine);
      assert(atomicEqual(expected,actual),'Atomic projected qualifier/context membership changed');
    }
  }
  assert(seenMembers.size===propositions.size,'Atomic projected proposition lacks frozen constituent');
  const identity=atomicContributorIdentity(record.role,projection.constituents);assert(record.actorId===identity.actorId&&record.contextId===identity.contextId,'Atomic composite contributor-set identity invalid');
  for(const change of projection.normalizations)assert(atomicText(change.reason)&&atomicText(change.field)&&atomicText(change.originalPointer)&&Object.hasOwn(change,'before')&&Object.hasOwn(change,'after'),'Atomic mechanical normalization provenance incomplete');
  return projection.constituents.map(({actorId,contextId})=>({actorId,contextId}));
}

export function atomicEvidenceReferences(descriptor,readFile=readAtomicEvidenceBytes){
  if(descriptor?.status!=='RECONCILED')return [];
  const refs=[descriptor.draft,descriptor.independentReview,descriptor.reconciliation],records=refs.map(ref=>atomicEvidenceFile(ref,readFile)),reconciliation=records[2];
  refs.push(...[reconciliation.priorManifest,reconciliation.sourceTraceManifest,reconciliation.historicalSourceRelocationCrosswalk,reconciliation.priorSpecificationSource].filter(Boolean));
  for(const record of records)for(const constituent of record.mechanicalProjection?.constituents??[])refs.push(constituent,...(constituent.identityEvidence?[constituent.identityEvidence]:[]));
  if(reconciliation.contextReconciliation){const context=reconciliation.contextReconciliation;refs.push(context,context.author,context.independentReview);}
  if(reconciliation.componentReconciliation)refs.push(reconciliation.componentReconciliation,...reconciliation.componentReconciliation.inputs??[]);
  const unique=new Map();
  for(const ref of refs){assert(ref&&isAtomicEvidencePath(ref.path)&&atomicDigest(ref.sha256),'Atomic evidence dependency identity invalid');assert(!unique.has(ref.path)||unique.get(ref.path).sha256===ref.sha256,'Atomic evidence dependency has conflicting hashes');assert(sha256(readFile(ref.path))===ref.sha256,'Atomic evidence dependency digest mismatch');unique.set(ref.path,ref);}
  return [...unique.values()];
}

// Original context passes may disagree. Only a separately pinned, distinct
// source-grounded reconciliation can resolve them; normalization is not review.
export function loadAtomicContextReconciliation(ref,{readFile,sourceBytes}){
  if(!ref)return null;
  const record=atomicEvidenceFile(ref,readFile),author=atomicEvidenceFile(ref.author,readFile),review=atomicEvidenceFile(ref.independentReview,readFile),sourceSha256=sha256(sourceBytes),lines=sourceBytes.toString('utf8').split('\n');
  assert(record.schema==='closed-loop-source-context-reconciliation/1'&&record.role==='DISTINCT_SOURCE_ONLY_RECONCILIATION'&&author.role==='DRAFT_CONTEXT'&&review.role==='INDEPENDENT_CONTEXT_REVIEW','Atomic context reconciliation roles invalid');
  const passes=[author,review,record];
  assert(passes.every(p=>atomicText(p.actorId)&&atomicText(p.contextId)&&p.specificationSha256===sourceSha256)&&new Set(passes.map(p=>p.actorId)).size===3&&new Set(passes.map(p=>p.contextId)).size===3,'Atomic context reconciliation independence missing');
  assert(review.draftManifestReceived===false&&review.implementationRead===false&&record.method?.sourceOnly===true&&record.method.implementationInspected===false&&record.method.originalInputsModified===false,'Atomic context reconciliation source isolation false');
  assert(Array.isArray(record.inputs)&&[ref.author,ref.independentReview].every(r=>record.inputs.some(i=>i.path===(r.originalPath??r.path)&&i.sha256===r.sha256))&&record.inputs.some(i=>i.sha256===sourceSha256),'Atomic context reconciliation input lineage incomplete');
  const sourceInputs=record.inputs.filter(input=>input.sha256===sourceSha256);
  assert([author,review].every(pass=>Array.isArray(pass.inputs)&&pass.inputs.length===1&&sourceInputs.some(input=>typeof pass.inputs[0]==='string'?pass.inputs[0]===input.path:pass.inputs[0].path===input.path&&pass.inputs[0].sha256===sourceSha256)),'Atomic original context source inputs differ');
  assert(Array.isArray(record.unresolvedDisagreements)&&record.unresolvedDisagreements.length===0&&Array.isArray(record.mappings),'Atomic context disagreement unresolved');
  const classifications=passes.slice(0,2).map(p=>{assert(Array.isArray(p.classifications),'Atomic original context classifications absent');const m=new Map();for(const row of p.classifications){assert(!m.has(row.line),'Atomic original context duplicated');m.set(row.line,row);}return m;});
  const mappings=new Map();
  for(const row of record.mappings){
    const line=row.line,originals=classifications.map(m=>m.get(line));
    assert(Number.isSafeInteger(line)&&line>0&&line<=lines.length&&!mappings.has(line)&&row.sourceLineSha256===sha256(Buffer.from(lines[line-1]))&&row.rawSourceText===lines[line-1]&&atomicText(row.reason)&&row.unresolved===false&&row.normativeForcePreserved===(row.resolvedClassification!=='HISTORICAL_NONNORMATIVE_CONTEXT'),'Atomic resolved context source or decision invalid');
    for(const [i,original] of originals.entries()){
      const prefix=i?'Review':'Author';
      assert(original&&original.sourceLineSha256===row.sourceLineSha256&&(original.rawSourceText??original.rawLine)===lines[line-1]&&atomicText(original.reason)&&row[i?'reviewClassification':'authorClassification']===original.classification&&atomicEqual(row[`original${prefix}GoverningSourceRanges`],original.governingSourceRanges??[])&&atomicEqual(row[`original${prefix}ContextSourceLocations`],original.contextSourceLocations??[]),'Atomic original context decision changed');
    }
    assert(['NORMATIVE_PROPOSITION','STRUCTURAL_REQUIREMENT_CONTEXT','HISTORICAL_NONNORMATIVE_CONTEXT'].includes(row.resolvedClassification)&&atomicText(row.resolutionMode)&&Array.isArray(row.governingSourceRanges)&&Array.isArray(row.additionalSupportingSourceRanges),'Atomic resolved context classification/ranges absent');
    let last=0;for(const range of row.governingSourceRanges){assert(Array.isArray(range)&&range.length===2&&Number.isSafeInteger(range[0])&&Number.isSafeInteger(range[1])&&range[0]>last&&range[1]>=range[0]&&range[1]<=lines.length,'Atomic resolved governing range invalid');last=range[1];}
    assert(Array.isArray(row.exactSourceAnchors)&&row.exactSourceAnchors.some(a=>a.startLine<=line&&a.endLine>=line),'Atomic context source anchors absent');
    for(const anchor of row.exactSourceAnchors){const {startLine:a,endLine:b}=anchor;assert(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>0&&b>=a&&b<=lines.length,'Atomic context source anchor invalid');const text=lines.slice(a-1,b).join('\n');assert(anchor.exactText===text&&anchor.sha256Utf8WithoutTrailingLf===sha256(Buffer.from(text)),'Atomic context source anchor bytes mismatch');}
    for(const anchor of row.governedRangeEvidence??[]){const {startLine:a,endLine:b}=anchor;assert(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>0&&b>=a&&b<=lines.length&&anchor.sha256Utf8WithoutTrailingLf===sha256(Buffer.from(lines.slice(a-1,b).join('\n')))&&anchor.firstLineText===lines[a-1]&&anchor.lastLineText===lines[b-1],'Atomic context governed range bytes mismatch');}
    for(const [a,b] of [...row.governingSourceRanges,...row.additionalSupportingSourceRanges])assert([...row.exactSourceAnchors,...row.governedRangeEvidence??[]].some(anchor=>anchor.startLine<=a&&anchor.endLine>=b),'Atomic context governing/support range lacks source anchor');
    mappings.set(line,row);
  }
  assert(classifications.every(m=>m.size===mappings.size&&[...m.keys()].every(line=>mappings.has(line))),'Atomic context reconciliation original universe incomplete');
  return {record,author,review,mappings,refs:[ref,ref.author,ref.independentReview]};
}

export function loadAtomicComponentReconciliation(ref,{readFile,sourceBytes,specificationPath,contributors=[]}){
  if(!ref)return null;
  const record=atomicEvidenceFile(ref,readFile),sourceSha256=sha256(sourceBytes),lines=sourceBytes.toString('utf8').split('\n');
  assert(record.schema==='closed-loop-normative-component-reconciliation/1'&&record.status==='BOUNDED_SOURCE_RELATIONSHIP_REVIEW_COMPLETE_NOT_ACCEPTANCE'&&record.specificationSha256===sourceSha256&&atomicText(record.actorId)&&atomicText(record.contextId)&&!contributors.some(c=>c.actorId===record.actorId||c.contextId===record.contextId),'Atomic component review identity/source/independence invalid');
  assert(Array.isArray(record.unresolvedDisagreements)&&record.unresolvedDisagreements.length===0&&Array.isArray(record.inputs)&&Array.isArray(ref.inputs)&&ref.inputs.length===record.inputs.length,'Atomic component review unresolved or input inventory missing');
  const seen=new Set();for(const input of ref.inputs){assert(isAtomicEvidencePath(input.path)&&atomicDigest(input.sha256)&&!seen.has(input.originalPath??input.path)&&record.inputs.some(original=>original.path===(input.originalPath??input.path)&&original.sha256===input.sha256)&&sha256(readFile(input.path))===input.sha256,'Atomic component review original input identity mismatch');seen.add(input.originalPath??input.path);}
  assert(record.inputs.some(input=>input.sha256===sourceSha256)&&Array.isArray(record.mappings)&&Array.isArray(record.reviewedSourceLines),'Atomic component review source or mapping inventory absent');
  const mappings=new Map();
  for(const mapping of record.mappings){
    const line=mapping.sourceLine;assert(Number.isSafeInteger(line)&&line>0&&line<=lines.length&&!mappings.has(line)&&mapping.unresolved===false&&mapping.normativeOccurrenceRetained===true&&atomicText(mapping.reason)&&['EXISTING_CONTRACT_COMPONENT','EQUIVALENT_OCCURRENCE','NEW_DISTINCT_SCOPE'].includes(mapping.relation)&&Array.isArray(mapping.targetAtomicKeys)&&(mapping.relation==='NEW_DISTINCT_SCOPE'?mapping.targetAtomicKeys.length===0&&Array.isArray(mapping.proposedNewScopes)&&mapping.proposedNewScopes.length>0:mapping.targetAtomicKeys.length>0)&&new Set(mapping.targetAtomicKeys).size===mapping.targetAtomicKeys.length,'Atomic component source mapping invalid');
    assert(Array.isArray(mapping.exactSourceAnchors)&&mapping.exactSourceAnchors.some(anchor=>anchor.startLine<=line&&anchor.endLine>=line),'Atomic component source anchor missing');
    for(const anchor of mapping.exactSourceAnchors){const a=anchor.startLine,b=anchor.endLine;assert(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>0&&b>=a&&b<=lines.length&&anchor.exactText===lines.slice(a-1,b).join('\n')&&anchor.sha256Utf8WithoutTrailingLf===sha256(Buffer.from(anchor.exactText)),'Atomic component source anchor bytes mismatch');}
    mappings.set(line,mapping);
  }
  assert(atomicEqual([...mappings.keys()].sort((a,b)=>a-b),[...record.reviewedSourceLines].sort((a,b)=>a-b)),'Atomic component reviewed source universe incomplete');
  assert(Array.isArray(record.selectedAtomicScopeSnapshots),'Atomic component reviewed scope snapshots absent');
  const snapshots=new Map();for(const snapshot of record.selectedAtomicScopeSnapshots){assert(!snapshots.has(snapshot.atomicKey),'Atomic component scope snapshot duplicated');snapshots.set(snapshot.atomicKey,snapshot);}
  for(const snapshot of snapshots.values()){
    assert(Number.isSafeInteger(snapshot.primarySourceLine)&&snapshot.primarySourceLine>0&&snapshot.primarySourceLine<=lines.length&&atomicObligationSha256({key:snapshot.atomicKey,statement:snapshot.statement,sourceSpans:snapshot.sourceSpans,contextSourceLocations:snapshot.exactSupportingContextSourceLocations})===snapshot.scopeSha256,'Atomic component snapshot scope digest mismatch');
    const start=lines.slice(0,snapshot.primarySourceLine-1).reduce((n,line)=>n+Buffer.byteLength(line)+1,0),end=start+Buffer.byteLength(lines[snapshot.primarySourceLine-1]);
    for(const span of snapshot.sourceSpans)assert(Number.isSafeInteger(span.startByte)&&Number.isSafeInteger(span.endByte)&&span.startByte>=start&&span.endByte<=end&&span.endByte>span.startByte&&new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes.subarray(span.startByte,span.endByte))===span.text&&sha256(sourceBytes.subarray(span.startByte,span.endByte))===span.sha256,'Atomic component snapshot primary span bytes mismatch');
    for(const anchor of snapshot.exactSupportingContextSourceLocations)assert(anchor.path===specificationPath&&Number.isSafeInteger(anchor.startLine)&&anchor.startLine>0&&anchor.startLine<=lines.length&&anchor.endLine===anchor.startLine&&anchor.lineSha256===sha256(Buffer.from(lines[anchor.startLine-1]))&&anchor.controllingText===lines[anchor.startLine-1].trim(),'Atomic component snapshot context bytes mismatch');
  }

  for(const mapping of mappings.values())for(const key of mapping.targetAtomicKeys)assert(snapshots.has(key)&&mapping.selectedScopeEvidence?.some(e=>e.atomicKey===key&&e.scopeSha256===snapshots.get(key).scopeSha256),'Atomic component selected scope lacks exact snapshot');
  return {record,mappings,snapshots,refs:[ref,...ref.inputs]};
}
export function validateAtomicGoverningOccurrences(entries,{contextResolution,componentResolution,reconciliation,relocations=null}){
  const atoms=entries.filter(row=>row.entryKind==='ATOMIC_OBLIGATION'),byId=new Map(atoms.map(row=>[row.normativeRequirementId,row])),byKey=new Map(),primary=new Map(),historical=new Map(),components=new Map();
  const add=(map,line,id)=>{if(!map.has(line))map.set(line,new Set());map.get(line).add(id);};
  for(const atom of atoms){add(primary,atom.sourceLocation.startLine,atom.normativeRequirementId);if(!byKey.has(atom.atomicObligation.key))byKey.set(atom.atomicObligation.key,[]);byKey.get(atom.atomicObligation.key).push(atom);}
  for(const edge of reconciliation.requirementIdentityCrosswalk??[]){const line=relocations?.get(edge.priorNormativeRequirementId)?.targetSourceLine??edge.priorSourceLocation.startLine;for(const id of edge.currentNormativeRequirementIds)if(byId.has(id)){assert(['UNCHANGED_ATOMIC','CHANGED_SINGLETON_SCOPE','SPLIT_COMPOUND','MERGED_EQUIVALENT','COMPONENT_OF_CONTRACT'].includes(edge.relation),'Atomic historical occurrence relation unsupported');add(historical,line,id);}}
  for(const [line,mapping] of componentResolution?.mappings??[])for(const key of mapping.targetAtomicKeys){const targets=byKey.get(key)??[];assert(targets.length<=1,'Atomic component target key is ambiguous across source anchors');if(targets[0])add(components,line,targets[0].normativeRequirementId);}
  const rangesFor=line=>contextResolution?.mappings.get(line)?.resolvedClassification==='STRUCTURAL_REQUIREMENT_CONTEXT'?contextResolution.mappings.get(line).governingSourceRanges:[];
  const inRanges=(line,ranges)=>ranges.some(([a,b])=>line>=a&&line<=b);
  const reachable=ranges=>{const found=new Set(),seen=new Set(),queue=[];for(const [a,b] of ranges)for(let n=a;n<=b;n++)queue.push(n);for(let i=0;i<queue.length;i++){const line=queue[i];if(seen.has(line))continue;seen.add(line);for(const map of [primary,historical,components])for(const id of map.get(line)??[])found.add(id);for(const [a,b] of rangesFor(line))for(let n=a;n<=b;n++)if(!seen.has(n))queue.push(n);}return found;};
  for(const row of entries.filter(entry=>entry.entryKind==='SOURCE_CONTEXT'&&entry.contextClassification.classification==='STRUCTURAL_REQUIREMENT_CONTEXT')){
    const c=row.contextClassification,bindings=c.governingOccurrenceBindings??[];
    if(!bindings.length&&!contextResolution)continue;
    const resolved=contextResolution?.mappings.get(row.sourceLocation.startLine);
    if(!resolved){assert(bindings.length===0,'Atomic governed occurrences lack pinned context decision');continue;}
    assert(resolved&&resolved.resolvedClassification===c.classification&&atomicEqual(resolved.governingSourceRanges,c.governingSourceRanges),'Atomic governed occurrences lack pinned context decision');
    const bound=new Set(),edges=new Set();
    for(const binding of bindings){
      const target=byId.get(binding.normativeRequirementId),path=binding.relationship==='CONTEXT_CHAIN'?binding.viaSourceLines:[binding.sourceLine],terminal=binding.relationship==='CONTEXT_CHAIN'?binding.terminalRelationship:binding.relationship;
      assert(target&&binding.currentAtomicObligationSha256===target.atomicObligation.sha256&&[{...target.sourceLocation},...target.atomicObligation.contextSourceLocations].some(anchor=>anchor.startLine===binding.sourceLine&&anchor.lineSha256===binding.sourceLineSha256)&&atomicText(binding.reason)&&Array.isArray(path)&&path.length>0&&path[0]===binding.sourceLine&&new Set(path).size===path.length&&inRanges(binding.sourceLine,c.governingSourceRanges),'Atomic governed occurrence path invalid');
      if(binding.relationship==='CONTEXT_CHAIN')assert(path.length>=2,'Atomic context chain has no typed intermediate edge');
      for(let i=0;i<path.length-1;i++)assert(inRanges(path[i+1],rangesFor(path[i])),'Atomic context chain lacks reviewed governing edge');
      const last=path.at(-1),id=target.normativeRequirementId;
      if(terminal==='PRIMARY_SOURCE')assert(primary.get(last)?.has(id),'Atomic occurrence terminal is not target primary');
      else if(terminal==='CONTRACT_COMPONENT'){
        assert(componentResolution&&components.get(last)?.has(id),'Atomic occurrence terminal lacks pinned component review');
        const mapping=componentResolution.mappings.get(last),snapshot=componentResolution.snapshots.get(target.atomicObligation.key),clarification=(mapping.scopeTextChanges??[]).find(change=>change.atomicKey===target.atomicObligation.key&&change.changeType==='CLARIFY_STATEMENT_FROM_ALREADY_INCLUDED_CONTEXT'&&change.semanticScopeChanged===false);
        assert(snapshot&&target.atomicObligation.statement===(clarification?.proposedStatement??snapshot.statement)&&atomicEqual(target.atomicObligation.sourceSpans,snapshot.sourceSpans)&&snapshot.exactSupportingContextSourceLocations.every(anchor=>[{...target.sourceLocation,controllingText:target.controllingText},...target.atomicObligation.contextSourceLocations].some(current=>atomicEqual(anchor,current))),'Atomic governed component reviewed scope changed');
      }
      else if(terminal==='HISTORICAL_OCCURRENCE')assert(historical.get(last)?.has(id)&&reconciliation.requirementIdentityCrosswalk.some(edge=>edge.priorNormativeRequirementId===binding.priorNormativeRequirementId&&edge.currentNormativeRequirementIds.includes(id)&&(relocations?.get(edge.priorNormativeRequirementId)?.targetSourceLine??edge.priorSourceLocation.startLine)===last),'Atomic occurrence terminal lacks reviewed historical edge');
      else assert(false,'Atomic governed occurrence relationship invalid');
      const signature=atomicHash({id,path,terminal});assert(!edges.has(signature),'Atomic governed occurrence edge duplicated');edges.add(signature);bound.add(id);
      for(const line of path)assert(target.sourceLocation.startLine===line||target.atomicObligation.contextSourceLocations.some(anchor=>anchor.startLine===line),'Atomic governed occurrence source lost from target scope');
    }
    const expected=reachable(c.governingSourceRanges),direct=new Set(atoms.filter(atom=>inRanges(atom.sourceLocation.startLine,c.governingSourceRanges)).map(atom=>atom.normativeRequirementId));
    assert(atomicEqual([...expected].sort(),[...c.governingNormativeRequirementIds].sort())&&[...expected].every(id=>direct.has(id)||bound.has(id)),'Atomic typed governed occurrence coverage incomplete');
  }
}

export function validateAtomicSectionCoverage(record,rows,sections,sourceBytes,idKey,memberKey){
  assert(Array.isArray(record.sections)&&record.sections.length===sections.length,'Atomic section coverage incomplete');
  const members=new Set(),lines=sourceBytes.toString('utf8').split('\n');
  for(let i=0;i<sections.length;i++){
    const section=sections[i],actual=record.sections[i];
    assert(actual.sectionId===section.sectionId&&actual.startLine===section.startLine&&actual.endLine===section.endLine&&atomicText(actual.reason),'Atomic section source identity mismatch');
    const ids=atomicList(actual[memberKey],'section membership'),references=actual.coverageReferences??[];assert(Array.isArray(references),'Atomic section coverage references invalid');
    const referenced=new Set();
    for(const reference of references){
      const id=reference[idKey],row=rows.get(id),primary=row?.primarySourceLine??row?.sourceLocation?.startLine,contexts=row?.contextSourceLocations??row?.atomicObligation?.contextSourceLocations??[],range=row?.sourceRange??[primary,primary];
      assert(row&&!referenced.has(id)&&atomicText(reference.reason)&&Array.isArray(reference.sourceRanges)&&reference.sourceRanges.length>0,'Atomic section coverage reference missing or duplicated');referenced.add(id);
      assert(reference.sourceRanges.some(([a,b])=>lines.slice(Math.max(a,section.startLine+1)-1,b).some(line=>line.trim())),'Atomic section reference covers no substantive source occurrence');
      let last=0;for(const [a,b] of reference.sourceRanges){assert(Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a>=section.startLine&&b<=section.endLine&&a>last&&b>=a,'Atomic section reference outside covered subsection');last=b;for(let n=a;n<=b;n++)assert((n>=range[0]&&n<=range[1])||contexts.some(context=>context.startLine===n),'Atomic section reference lacks original source occurrence');}
    }
    assert(['COVERED','NONNORMATIVE','SOURCE_CONTEXT_ONLY'].includes(actual.disposition),'Atomic section disposition unresolved');
    if(actual.disposition==='COVERED')assert(ids.length+references.length>0,'Atomic section disposition unresolved');
    else if(actual.disposition==='NONNORMATIVE')assert(ids.length===0&&references.length===0,'Atomic section disposition unresolved');
    else{
      assert(ids.length===0&&references.length===0&&lines.slice(section.startLine,section.endLine).every(line=>!line.trim()),'Atomic context-only section contains unreviewed substantive source');
      assert(actual.sourceContext?.classification==='SECTION_HEADING'&&actual.sourceContext.sourceLine===section.startLine&&actual.sourceContext.sourceLineSha256===sha256(Buffer.from(lines[section.startLine-1])),'Atomic context-only heading identity missing');
      const children=sections.filter(child=>child.sectionId.startsWith(section.sectionId+'.')).map(child=>child.sectionId);
      assert(atomicEqual(atomicList(actual.governedSectionIds,'context-only governed sections'),children),'Atomic context-only child section coverage incomplete');
    }
    for(const id of ids){const row=rows.get(id),line=row?.primarySourceLine??row?.sourceLocation?.startLine;assert(row&&!members.has(id)&&line>=section.startLine&&line<=section.endLine,'Atomic section member missing, duplicate or misanchored');members.add(id);}
  }
  for(const row of rows.values()){const line=row.primarySourceLine??row.sourceLocation?.startLine;assert(members.has(row[idKey])||line<sections[0].startLine,'Atomic proposition/entry omitted from sections');}
}

export function loadReviewedAtomicExtraction(descriptor,{sourceBytes,specificationPath,sections,priorRequirements=null,readFile=readAtomicEvidenceBytes}={}){
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
  const contributors=[draft,review,reconciliation].map(record=>validateAtomicProjection(record,{readFile,sourceBytes,reconciler:reconciliation}));
  for(let i=0;i<contributors.length;i++)for(let j=i+1;j<contributors.length;j++)assert(!contributors[i].some(a=>contributors[j].some(b=>a.actorId===b.actorId||a.contextId===b.contextId)),'Atomic actual contributor roles are not independent');
  const validateSections=(record,rows,idKey,memberKey)=>validateAtomicSectionCoverage(record,rows,sections,sourceBytes,idKey,memberKey);
  const extracts=[draft,review].map((record,index)=>{
    assert(record.schema==='closed-loop-atomic-extraction-evidence/1'&&record.role===(index?'INDEPENDENT_REVIEW':'DRAFT')&&Array.isArray(record.propositions)&&record.propositions.length>0,'Atomic extraction record invalid');
    const rows=new Map(),lines=sourceBytes.toString('utf8').split('\n');
    for(const row of record.propositions){if(row.sourceRange)assert(Array.isArray(row.sourceRange)&&row.sourceRange.length===2&&row.sourceRange[0]===row.primarySourceLine&&Number.isSafeInteger(row.sourceRange[1])&&row.sourceRange[1]>=row.sourceRange[0]&&row.sourceRange[1]<=lines.length,'Atomic authored source range invalid');assert(atomicText(row.propositionId)&&!rows.has(row.propositionId)&&atomicText(row.statement)&&Number.isSafeInteger(row.primarySourceLine)&&row.primarySourceLine>0&&row.primarySourceLine<=lines.length&&row.sourceLineSha256===sha256(Buffer.from(lines[row.primarySourceLine-1]))&&Array.isArray(row.contextSourceLocations),'Atomic extraction proposition invalid');for(const context of row.contextSourceLocations)assert(context?.path===specificationPath&&Number.isSafeInteger(context.startLine)&&context.startLine>0&&context.startLine<=lines.length&&context.endLine===context.startLine&&context.lineSha256===sha256(Buffer.from(lines[context.startLine-1]))&&context.controllingText===lines[context.startLine-1].trim(),'Atomic extraction qualifier/context source mismatch');rows.set(row.propositionId,row);}
    validateSections(record,rows,'propositionId','propositionIds');return rows;
  });
  assert(reconciliation.schema==='closed-loop-atomic-reconciliation/1'&&reconciliation.status==='RECONCILED'&&Array.isArray(reconciliation.unresolvedMaterialDisagreements)&&reconciliation.unresolvedMaterialDisagreements.length===0,'Atomic material disagreements unresolved');
  for(const ref of [descriptor.draft,descriptor.independentReview,reconciliation.priorManifest])assert(ref&&reconciliation.inputs.some(input=>input.path===ref.path&&input.sha256===ref.sha256),'Atomic reconciliation input lineage incomplete');
  const prior=atomicEvidenceFile(reconciliation.priorManifest,readFile);
  assert(prior.schema==='closed-loop-normative-requirements/1'&&Array.isArray(prior.requirements),'Atomic pinned predecessor manifest invalid');
  let priorSourceBytes=null;
  if(reconciliation.priorSpecificationSource){const ref=reconciliation.priorSpecificationSource;assert(isAtomicEvidencePath(ref.path)&&ref.path.endsWith('.txt')&&ref.sha256===prior.specificationSha256&&reconciliation.inputs.some(input=>input.path===ref.path&&input.sha256===ref.sha256),'Atomic historical specification source input identity mismatch');priorSourceBytes=readFile(ref.path);assert(sha256(priorSourceBytes)===ref.sha256,'Atomic historical specification source bytes mismatch');}
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

  const contextResolution=loadAtomicContextReconciliation(reconciliation.contextReconciliation,{readFile,sourceBytes});
  const componentResolution=loadAtomicComponentReconciliation(reconciliation.componentReconciliation,{readFile,sourceBytes,specificationPath,contributors:contributors.slice(0,2).flat()});
  if(componentResolution)assert(reconciliation.inputs.some(input=>input.path===reconciliation.componentReconciliation.path&&input.sha256===reconciliation.componentReconciliation.sha256),'Atomic component reconciliation input missing');
  if(contextResolution){
    assert(reconciliation.inputs.some(input=>input.path===reconciliation.contextReconciliation.path&&input.sha256===reconciliation.contextReconciliation.sha256),'Atomic context reconciliation input missing');
    assert(!contributors.slice(0,2).flat().some(c=>c.actorId===contextResolution.record.actorId||c.contextId===contextResolution.record.contextId),'Atomic context reconciler reuses an extraction contributor');
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
      if(row.entryKind==='SOURCE_CONTEXT'){
        const resolution=contextResolution?.mappings.get(row.sourceLocation.startLine);
        if(resolution){
          assert(resolution.resolvedClassification===row.contextClassification.classification&&atomicEqual(resolution.governingSourceRanges,row.contextClassification.governingSourceRanges??[]),'Atomic current context differs from resolved decision');
          for(let i=0;i<2;i++)assert(sourceIds[i].some(id=>{const p=extracts[i].get(id);return p.primarySourceLine===row.sourceLocation.startLine&&p.classification===resolution[i?'reviewClassification':'authorClassification']&&atomicText(p.reason); }),'Atomic original context classification omitted or rewritten');
        }else assert(sourceIds.every(ids=>ids.length>0)&&propositions.every(p=>p.classification===row.contextClassification.classification&&atomicText(p.reason)),'Atomic context lacks current independent classification');
      }
    }
    assert(atomicEqual(decision.currentAtomicScopeSha256,digests),'Atomic reconciliation scope digest mismatch');
  }
  assert(resolved.every((set,i)=>set.size===extracts[i].size)&&mapped.size===entries.length,'Atomic proposition reconciliation or active entry coverage incomplete');
  validateAtomicIdentityCrosswalk(reconciliation.requirementIdentityCrosswalk,prior,reconciliation.priorManifest,entries,decisions,sourceBytes,relocations,priorSourceBytes);
  validateAtomicGoverningOccurrences(entries,{contextResolution,componentResolution,reconciliation,relocations});
  return {established:true,descriptor,entries,requirementIdentityCrosswalk:reconciliation.requirementIdentityCrosswalk,reconciliation,prior,sourcePrior,contextResolution};
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
