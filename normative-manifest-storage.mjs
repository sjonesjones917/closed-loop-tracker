// Repository-only, lossless storage representation. Ordinary atomic scopes are
// reconstructed before their existing validators or proof consumers are used.
import './hash.js';
import crypto from 'node:crypto';

const H=globalThis.closedLoopHash;
const assert=(ok,message)=>{if(!ok)throw Error('NORMATIVE_STORAGE: '+message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,fields)=>plain(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key));
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const canonical=value=>H.stableStringify(value);
const encodingSchema='closed-loop-shared-context-anchor-storage/1';
const anchorFields=['path','startLine','endLine','lineSha256','controllingText'];
function anchorKey(anchor){
  assert(exact(anchor,anchorFields)&&typeof anchor.path==='string'&&anchor.path.length>0&&Number.isSafeInteger(anchor.startLine)&&anchor.startLine>0&&anchor.endLine===anchor.startLine&&digest(anchor.lineSha256)&&typeof anchor.controllingText==='string','Malformed context anchor');
  return canonical(anchor);
}
export function encodeNormativeManifest(manifest){
  assert(plain(manifest)&&Array.isArray(manifest.requirements)&&!Object.hasOwn(manifest,'storageEncoding'),'Malformed or already encoded manifest');
  if(Object.hasOwn(manifest,'storedManifestIdentity')){
    const identity=manifest.storedManifestIdentity;assert(exact(identity,['encodingSchema','canonicalSha256'])&&identity.encodingSchema===encodingSchema&&!Object.hasOwn(manifest,'manifestSha256')&&(identity.canonicalSha256===null||digest(identity.canonicalSha256)),'Conflicting stored manifest identity');
    const {storedManifestIdentity,...ordinary}=manifest;manifest={...ordinary,manifestSha256:identity.canonicalSha256};
  }
  const unique=new Map;
  for(const row of manifest.requirements)if(row.entryKind==='ATOMIC_OBLIGATION'){
    const scope=row.atomicObligation;assert(plain(scope)&&Array.isArray(scope.contextSourceLocations)&&!Object.hasOwn(scope,'contextSourceLocationIndices'),'Missing or mixed ordinary context array');
    for(const anchor of scope.contextSourceLocations)unique.set(anchorKey(anchor),anchor);
  }
  const ordered=[...unique.keys()].sort(),indices=new Map(ordered.map((key,index)=>[key,index])),anchors=ordered.map(key=>structuredClone(unique.get(key)));
  const requirements=manifest.requirements.map(row=>{
    if(row.entryKind!=='ATOMIC_OBLIGATION')return structuredClone(row);
    const {contextSourceLocations,...scope}=row.atomicObligation;
    return {...structuredClone({...row,atomicObligation:undefined}),atomicObligation:{...structuredClone(scope),contextSourceLocationIndices:contextSourceLocations.map(anchor=>indices.get(anchorKey(anchor)))}};
  });
  return {...manifest,requirements,storageEncoding:{schema:encodingSchema,anchors,anchorsSha256:H.sha256Value(anchors)}};
}
export function decodeNormativeManifest(manifest,{verifyDigest=true}={}){
  assert(plain(manifest)&&Array.isArray(manifest.requirements),'Malformed manifest');
  if(!Object.hasOwn(manifest,'storageEncoding')){
    assert(manifest.requirements.every(row=>!Object.hasOwn(row.atomicObligation??{},'contextSourceLocationIndices')),'Undeclared shared context references');
    return manifest;
  }
  if(verifyDigest){const payload={...manifest};delete payload.manifestSha256;assert(digest(manifest.manifestSha256)&&H.sha256Value(payload)===manifest.manifestSha256,'Encoded manifest digest differs');}
  const encoding=manifest.storageEncoding;
  assert(exact(encoding,['schema','anchors','anchorsSha256'])&&encoding.schema===encodingSchema&&Array.isArray(encoding.anchors)&&digest(encoding.anchorsSha256),'Unsupported or malformed encoding');
  let prior=null;
  for(const anchor of encoding.anchors){const key=anchorKey(anchor);assert(prior===null||key>prior,'Duplicate or unordered context anchors');prior=key;}
  assert(H.sha256Value(encoding.anchors)===encoding.anchorsSha256,'Context anchor table digest differs');
  const used=new Set,requirements=manifest.requirements.map(row=>{
    if(row.entryKind!=='ATOMIC_OBLIGATION'){assert(!Object.hasOwn(row.atomicObligation??{},'contextSourceLocationIndices'),'Context references on non-atomic row');return structuredClone(row);}
    const scope=row.atomicObligation;assert(plain(scope)&&!Object.hasOwn(scope,'contextSourceLocations')&&Array.isArray(scope.contextSourceLocationIndices),'Missing or mixed stored context indices');
    const {contextSourceLocationIndices,...ordinary}=scope;
    const contextSourceLocations=contextSourceLocationIndices.map(index=>{
      assert(Number.isSafeInteger(index)&&index>=0&&index<encoding.anchors.length,'Dangling or malformed context index');used.add(index);
      // A parse of ordinary JSON gives each occurrence its own mutable object.
      // Do not introduce cross-row or cross-decode aliases through interning.
      return structuredClone(encoding.anchors[index]);
    });
    return {...structuredClone({...row,atomicObligation:undefined}),atomicObligation:{...structuredClone(ordinary),contextSourceLocations}};
  });
  assert(used.size===encoding.anchors.length,'Unused context anchor declaration');
  const {storageEncoding,manifestSha256,...ordinary}=manifest;
  return {...ordinary,requirements,storedManifestIdentity:{encodingSchema,canonicalSha256:manifestSha256??null}};
}

// The complete provenance remains reproducible from the exact continuation
// descriptor, source records and the already-validated row. This commitment is
// produced only after the original full composition and scope checks succeed.
export function projectInsertionEntryProvenance(entries,descriptor){
  assert(Array.isArray(entries)&&exact(descriptor,['path','sha256'])&&typeof descriptor.path==='string'&&descriptor.path.length>0&&digest(descriptor.sha256),'Malformed provenance custody selector');
  const ids=new Set;
  return entries.map((entry,index)=>{
    assert(typeof entry.normativeRequirementId==='string'&&!ids.has(entry.normativeRequirementId)&&plain(entry.continuationProvenance),'Missing or duplicate provenance subject');ids.add(entry.normativeRequirementId);
    const full=entry.continuationProvenance;
    assert(full.proofInheritance===false&&full.implementationConformance==='UNKNOWN'&&full.schema!=='closed-loop-checked-insertion-provenance-reference/1','Invalid or already projected provenance');
    return {...entry,continuationProvenance:{schema:'closed-loop-checked-insertion-provenance-reference/1',continuation:structuredClone(descriptor),entryIndex:index,normativeRequirementId:entry.normativeRequirementId,fullProvenanceSha256:crypto.createHash('sha256').update(canonical(full)).digest('hex'),proofInheritance:false,implementationConformance:'UNKNOWN'}};
  });
}
export function reconstructInsertionEntryProvenance(projectedEntries,validatedFullEntries,descriptor){
  const expected=projectInsertionEntryProvenance(validatedFullEntries,descriptor);
  assert(Array.isArray(projectedEntries)&&projectedEntries.length===expected.length&&expected.every((entry,index)=>plain(projectedEntries[index])&&Object.entries(entry).every(([key,value])=>Object.hasOwn(projectedEntries[index],key)&&canonical(projectedEntries[index][key])===canonical(value))),'Provenance projection differs from exact validated reconstruction');
  // Generated implementation metadata is outside this source-only operation.
  return structuredClone(validatedFullEntries);
}
