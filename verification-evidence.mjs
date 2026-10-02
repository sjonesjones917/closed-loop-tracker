// Repository verification evidence. This module is never shipped to the app.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {verificationCatalog,metricCatalog,zeroCatalog,negativePopulationCatalog} from './verification-evidence-catalog.mjs';

export const RECEIPT_SCHEMA='closed-loop-executed-verification-receipt/1';
export const SPECIFICATION_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
export const sha=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const requireEvidence=(condition,message)=>{if(!condition)throw new Error('EXECUTED_EVIDENCE_ORACLE: '+message);};
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
export function evidenceFingerprint(cwd=process.cwd()){
  // Generated retained fixtures and progress/artifact directories are excluded.
  // All first-party executable/configuration/specification inputs are included,
  // including newly added regression files before they have been committed.
  const tracked=execFileSync('git',['ls-files','-z'],{cwd,encoding:'utf8'}).split('\0').filter(name=>name&&name!=='TEST_PROJECT.json'&&/\.(?:m?js|html|css|json|txt|ya?ml)$/.test(name));
  const inputs=[...new Set([...tracked,...fs.readdirSync(cwd).filter(name=>!name.startsWith('.')&&/\.(?:m?js|html|css)$/.test(name)),...['verification-assertion-bindings.json','verification-negative-populations.json'].filter(name=>fs.existsSync(path.join(cwd,name)))])];
  const inputSha256=Object.fromEntries(inputs.sort().map(name=>[name,sha(fs.readFileSync(path.join(cwd,name)))]));
  return {sourceCommit:git(cwd,'rev-parse','HEAD'),sourceTree:git(cwd,'rev-parse','HEAD^{tree}'),sourceInputsSha256:sha(inputSha256),inputSha256,specificationSha256:inputSha256[SPECIFICATION_PATH],runtime:{node:process.version,platform:process.platform,architecture:process.arch},catalogSha256:inputSha256['verification-evidence-catalog.mjs']};
}
export function executionReports(stdout){
  const reports=String(stdout).trim().split(/\n(?=\{)/).map(text=>JSON.parse(text));
  requireEvidence(reports.length>0&&reports.every(row=>row&&typeof row==='object'&&!Array.isArray(row)),'child did not emit complete JSON report objects');
  return reports;
}
function valueAt(object,pointer){return pointer.split('.').reduce((value,key)=>value?.[key],object);}
function selectedReport(reports,marker){const selected=reports.filter(report=>Object.hasOwn(report,marker));requireEvidence(selected.length===1,`expected exactly one report marker ${marker}; received ${selected.length}`);return selected[0];}
export function observationsFromReports(suite,reports){
  const definition=verificationCatalog[suite];requireEvidence(definition,`unregistered producer ${suite}`);
  const observations=definition.checks.map(check=>{
    const report=selectedReport(reports,check.marker),observed=valueAt(report,check.path);
    const passed=check.condition?check.condition(observed,report):isDeepStrictEqual(observed,check.expected);
    return {checkId:check.id,requirementRefs:check.requirementRefs||[],assertionReference:check.assertionReference,boundary:check.boundary||definition.boundary,expected:check.expected??check.expectedDescription,observed:observed===undefined?null:observed,passed,evidenceBasis:check.basis||'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS',...(check.violation?{violation:check.violation,accepted:!passed}:{}),...(check.coverageIds?{coverageIds:check.coverageIds(report)}:{}),...(check.excludedIds?{excludedIds:check.excludedIds(report)}:{})};
  });
  for(const report of reports)for(const observation of report.verificationObservations||[]){
    requireEvidence(typeof observation.checkId==='string'&&observation.checkId&&typeof observation.passed==='boolean'&&typeof observation.boundary==='string'&&Object.hasOwn(observation,'expected')&&Object.hasOwn(observation,'observed'),'malformed emitted assertion observation');
    // Emitted detailed observations remain separately scoped. They cannot enlarge
    // a metric's frozen expected assertion population merely by appearing.
    requireEvidence(!observations.some(row=>row.checkId===observation.checkId),`duplicate emitted assertion ${observation.checkId}`);
    observations.push({...observation,evidenceBasis:'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS'});
  }
  const population=negativePopulationCatalog[suite];
  if(population){
    const actual=reports.flatMap(report=>report.negativeCasePopulation||[]);
    requireEvidence(actual.length===population.cases.length&&new Set(actual.map(row=>row.caseId)).size===actual.length,`missing/duplicate negative population ${suite}`);
    for(const expected of population.cases){
      const row=actual.find(value=>value.caseId===expected.caseId);
      requireEvidence(row&&row.checkId===expected.checkId&&row.violation===expected.violation&&row.result==='PASS'&&row.accepted===false&&typeof row.boundary==='string'&&row.observed,`failed/missing negative case ${suite}:${expected.caseId}`);
      observations.push({checkId:`negativecase.${suite}.${row.caseId}`,boundary:row.boundary,assertionReference:row.checkId,expected:'REJECTED_WITH_CANONICAL_STATE_PRESERVED',observed:row.observed,passed:row.result==='PASS'&&row.accepted===false,violation:row.violation,accepted:row.accepted,evidenceBasis:'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS',scopeLimit:population.scopeLimit});
    }
  }
  requireEvidence(new Set(observations.map(row=>row.checkId)).size===observations.length,'duplicate assertion observations');
  return observations;
}
export function createExecutionReceipt(suite,result,{cwd=process.cwd(),fingerprint=evidenceFingerprint(cwd)}={}){
  requireEvidence(result.exitCode===0&&result.outcome==='PASS'&&!result.signal&&!result.reason&&!result.error,`producer ${suite} failed or did not finish`);
  const reports=executionReports(result.stdout),observations=observationsFromReports(suite,reports);
  requireEvidence(observations.every(row=>row.passed),`producer ${suite} reported a failed or missing required assertion`);
  const producerFileSha256=sha(fs.readFileSync(path.resolve(cwd,result.command?.[1]||suite)));
  requireEvidence(producerFileSha256===fingerprint.inputSha256[suite],`producer script differs from current repository ${suite}`);
  const receipt={schema:RECEIPT_SCHEMA,suite,fingerprint,producerFileSha256,command:result.command,exitCode:result.exitCode,outcome:result.outcome,complete:true,stdoutSha256:sha(result.stdout),stderrSha256:sha(result.stderr||''),reports,observations};
  receipt.receiptSha256=sha(receipt);return receipt;
}
export function validateExecutionReceipt(receipt,suite,fingerprint){
  requireEvidence(receipt?.schema===RECEIPT_SCHEMA&&receipt.suite===suite,'receipt schema/producer mismatch');
  const {receiptSha256,...payload}=receipt;requireEvidence(receiptSha256===sha(payload),'receipt content digest mismatch');
  requireEvidence(receipt.complete===true&&receipt.exitCode===0&&receipt.outcome==='PASS','failed/incomplete receipt');
  requireEvidence(receipt.producerFileSha256===fingerprint.inputSha256[suite],'receipt producer bytes are not the current registered verifier');
  requireEvidence(receipt.fingerprint?.sourceInputsSha256===fingerprint.sourceInputsSha256&&receipt.fingerprint.specificationSha256===fingerprint.specificationSha256&&receipt.fingerprint.catalogSha256===fingerprint.catalogSha256&&isDeepStrictEqual(receipt.fingerprint.runtime,fingerprint.runtime),'stale source/specification/catalog/runtime receipt');
  // Same tree promotion is permitted only through the verified-site owner. The
  // original tested commit stays visible; equal input bytes never rewrite it.
  requireEvidence(receipt.fingerprint.sourceCommit===fingerprint.sourceCommit||receipt.promotion?.sourceCommit===fingerprint.sourceCommit&&receipt.promotion.sourceTree===fingerprint.sourceTree&&receipt.promotion.sourceTree===receipt.fingerprint.sourceTree&&receipt.promotion.verifiedSourceCommit===receipt.fingerprint.sourceCommit,'receipt belongs to a different candidate revision');
  const expected=observationsFromReports(suite,receipt.reports);
  requireEvidence(isDeepStrictEqual(expected,receipt.observations)&&expected.every(row=>row.passed),'receipt assertions differ from actual executed report');
  requireEvidence(sha(receipt.reports)!==sha([]),'empty executed report');
  return receipt;
}
export function recordExecutionReceipt(result,{cwd=process.cwd(),directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS}={}){
  if(!directory)return null;
  const suite=path.basename(result.command?.[1]||'');if(!verificationCatalog[suite])return null;
  const receipt=createExecutionReceipt(suite,result,{cwd});fs.mkdirSync(directory,{recursive:true});
  const file=path.resolve(directory,suite+'.json');
  if(fs.existsSync(file)){
    // Retain already valid evidence for unchanged inputs. A newly failed child
    // never reaches this branch: its failure replaces the old receipt above.
    const existing=readJson(file);
    try{return validateExecutionReceipt(existing,suite,receipt.fingerprint);}catch{
      // A newly executed, current, successful producer may supersede invalid
      // evidence. Preserve its bytes; validation never treats it as current.
      const superseded=path.join(directory,'superseded');fs.mkdirSync(superseded,{recursive:true});fs.copyFileSync(file,path.join(superseded,suite+'.'+sha(existing)+'.json'));
    }
  }
  const temporary=file+'.'+crypto.randomUUID()+'.partial';fs.writeFileSync(temporary,JSON.stringify(receipt,null,2)+'\n');fs.renameSync(temporary,file);return receipt;
}
export function readExecutionReceipts(directory,fingerprint=evidenceFingerprint()){
  const receipts=new Map();
  for(const suite of Object.keys(verificationCatalog)){
    const file=path.join(directory,suite+'.json');if(!fs.existsSync(file))continue;
    // A stale or corrupt mandatory receipt is a failed evidence handoff, rather
    // than a reason to silently reuse or replace an old green result.
    const receipt=validateExecutionReceipt(readJson(file),suite,fingerprint);receipts.set(suite,receipt);
  }
  return receipts;
}
export function aggregateExecutedEvidence(receipts,fingerprint){
  const observations=new Map(),receiptRefs=[];
  for(const [suite,receipt] of receipts){validateExecutionReceipt(receipt,suite,fingerprint);receiptRefs.push(`${suite}.json#${receipt.receiptSha256}`);for(const observation of receipt.observations){requireEvidence(!observations.has(observation.checkId),`duplicate observation ${observation.checkId}`);observations.set(observation.checkId,{...observation,suite,receiptSha256:receipt.receiptSha256});}}
  const metrics={};
  for(const [name,definition]of Object.entries(metricCatalog)){
    const expected=definition.checkIds;requireEvidence(expected.length>0&&new Set(expected).size===expected.length,`empty/duplicate metric universe ${name}`);
    const rows=expected.flatMap(id=>{const observation=observations.get(id),ids=observation?.coverageIds;if(ids){requireEvidence(Array.isArray(ids)&&ids.length>0&&new Set(ids).size===ids.length,`invalid enumerated assertion universe ${id}`);return ids.map(member=>({id:`${id}:${member}`,observation}));}return [{id,observation}];});
    const includedIds=rows.map(row=>row.id),missing=rows.filter(row=>!row.observation).map(row=>row.id),failed=rows.filter(row=>row.observation&&!row.observation.passed).map(row=>row.id),numerator=rows.length-missing.length-failed.length;
    const exclusions=expected.flatMap(id=>observations.get(id)?.excludedIds||[]);
    requireEvidence(exclusions.every(row=>row&&typeof row.id==='string'&&row.id&&typeof row.reason==='string'&&row.reason)&&new Set(exclusions.map(row=>row.id)).size===exclusions.length,`invalid/duplicate metric exclusion reason ${name}`);
    requireEvidence(new Set(includedIds).size===includedIds.length,`duplicate expanded metric universe ${name}`);
    metrics[name]={metricId:definition.metricId,derivationVersion:'closed-loop-executed-metrics/1',universeDefinition:definition.universeDefinition,numerator,denominator:rows.length,includedIds,excludedIds:[...(definition.excludedIds||[]),...exclusions],scopeHash:sha({fingerprint,checkIds:includedIds,exclusions}),evidenceReferences:[...new Set(rows.filter(row=>row.observation).map(row=>`${row.observation.suite}.json#${row.observation.checkId}`))],value:missing.length?null:numerator/rows.length,disposition:missing.length?'UNKNOWN':failed.length?'VIOLATED':'SATISFIED',evidenceBasis:'CURRENT_CANDIDATE_EXECUTED_ASSERTIONS',applicationConformanceEstablished:false,missingIds:missing,failedIds:failed,scopeLimit:definition.scopeLimit};
  }
  const zeroCounts={},negativePopulations={};
  for(const [name,definition]of Object.entries(zeroCatalog)){
    const expected=definition.checkIds,missing=expected.filter(id=>!observations.has(id)),observed=expected.filter(id=>observations.has(id)).map(id=>observations.get(id));
    requireEvidence(expected.length>0&&new Set(expected).size===expected.length,`empty/duplicate negative population ${name}`);
    zeroCounts[name]=missing.length?null:observed.filter(row=>row.accepted!==false).length;
    negativePopulations[name]={populationDefinition:definition.populationDefinition,includedIds:expected,excludedIds:definition.excludedIds||[],observedIds:observed.map(row=>row.checkId),missingIds:missing,acceptedViolationIds:observed.filter(row=>row.accepted!==false).map(row=>row.checkId),count:zeroCounts[name],evidenceReferences:observed.map(row=>`${row.suite}.json#${row.checkId}`),scopeHash:sha({fingerprint,expected}),scopeLimit:definition.scopeLimit};
  }
  const normative=readJson(SPECIFICATION_PATH.replace('closed-loop-reliability-controlling-implementation-specification.txt','closed-loop-normative-requirements.json'));
  const assertionBindings=fs.existsSync('verification-assertion-bindings.json')?readJson('verification-assertion-bindings.json'):{schema:'closed-loop-verification-assertion-bindings/1',specificationSha256:normative.specificationSha256,bindings:[]};
  requireEvidence(assertionBindings.schema==='closed-loop-verification-assertion-bindings/1'&&assertionBindings.specificationSha256===fingerprint.specificationSha256,'assertion bindings use a different controlling specification');
  const requirementsById=new Map(normative.requirements.map(row=>[row.normativeRequirementId,row]));
  for(const binding of assertionBindings.bindings){
    const requirement=requirementsById.get(binding.normativeRequirementId);
    requireEvidence(requirement&&requirement.sourceLocation.lineSha256===binding.sourceLineSha256&&Array.isArray(binding.checkIds)&&binding.checkIds.length>0&&typeof binding.scope==='string'&&binding.scope&&['EXECUTED_DETERMINISTIC_BOUNDARY','EXECUTED_WIRING_BOUNDARY'].includes(binding.basis),'invalid exact requirement/assertion binding');
  }
  const normativeRequirementTrace=normative.requirements.map(requirement=>{
    const bindings=assertionBindings.bindings.filter(binding=>binding.normativeRequirementId===requirement.normativeRequirementId),ids=[...new Set(bindings.flatMap(binding=>binding.checkIds))],linked=ids.filter(id=>observations.has(id)).map(id=>observations.get(id)),missingIds=ids.filter(id=>!observations.has(id));
    return {normativeRequirementId:requirement.normativeRequirementId,sourceLocation:requirement.sourceLocation,sourceLineSha256:requirement.sourceLocation.lineSha256,controllingText:requirement.controllingText,disposition:linked.length&&missingIds.length===0&&linked.every(row=>row.passed)?'QUALIFIED_EXECUTED_ASSERTION_EVIDENCE':'UNKNOWN',implementationClassification:linked.length?'implemented but insufficiently tested':'impossible to verify from current requirement-specific repository evidence',scopeBindings:bindings.map(binding=>({scope:binding.scope,basis:binding.basis,checkIds:binding.checkIds})),missingAssertionIds:missingIds,executedAssertions:linked.map(row=>({checkId:row.checkId,suite:row.suite,boundary:row.boundary,assertionReference:row.assertionReference,expected:row.expected,observed:row.observed,receiptSha256:row.receiptSha256,evidenceBasis:row.evidenceBasis})),reason:linked.length?'Exact linked assertions establish their stated boundary. Long clauses retain unproved semantic/operator/environment obligations; no full-clause success is inferred.':'No requirement-specific current executed assertion binding. Candidate file mappings do not establish this obligation.'};
  });
  const contractRequirementTrace=(assertionBindings.contractRefs||[]).map(binding=>{
    const source=binding.source,lines=fs.readFileSync(source.path,'utf8').split('\n');
    requireEvidence(sha(lines[source.startLine-1])===binding.sourceLineSha256,'amendment assertion binding source line changed');
    const linked=binding.checkIds.filter(id=>observations.has(id)).map(id=>observations.get(id));
    return {...binding,disposition:linked.length===binding.checkIds.length?'QUALIFIED_EXECUTED_ASSERTION_EVIDENCE':'UNKNOWN',executedAssertions:linked.map(row=>({checkId:row.checkId,suite:row.suite,boundary:row.boundary,expected:row.expected,observed:row.observed,receiptSha256:row.receiptSha256})),fullClauseConformanceEstablished:false};
  });
  // The handoff contract is JSON. Optional properties absent from an executed
  // observation stay absent; explicit nulls remain null. Return the exact value
  // that is persisted so a genuine report round trip cannot differ merely
  // because an in-memory optional member was undefined before serialization.
  return JSON.parse(JSON.stringify({schema:'closed-loop-executed-verification-evidence/1',fingerprint,receiptCount:receipts.size,observationCount:observations.size,receiptReferences:receiptRefs,metrics,zeroCounts,negativePopulations,normativeRequirementTrace,contractRequirementTrace,sourceInspectionIsBehavioralProof:false}));
}
export function readExecutedEvidence(file,fingerprint=evidenceFingerprint()){
  const evidence=readJson(file),{evidenceSha256,...payload}=evidence;
  requireEvidence(evidence.schema==='closed-loop-executed-verification-evidence/1'&&evidenceSha256===sha(payload),'aggregated evidence digest/schema mismatch');
  requireEvidence(evidence.fingerprint?.sourceCommit===fingerprint.sourceCommit&&evidence.fingerprint.sourceInputsSha256===fingerprint.sourceInputsSha256&&evidence.fingerprint.specificationSha256===fingerprint.specificationSha256&&isDeepStrictEqual(evidence.fingerprint.runtime,fingerprint.runtime),'aggregated evidence is not the current source/specification/revision/runtime');
  const canonical=aggregateExecutedEvidence(readExecutionReceipts(path.dirname(file),fingerprint),fingerprint);
  requireEvidence(isDeepStrictEqual(canonical,payload),'aggregated metrics/populations do not derive from the current executed receipts');
  return evidence;
}
export function applyExecutedEvidence(report,evidence){
  const output={...report,coverageMetrics:{...report.coverageMetrics},section49CoverageMetrics:{...report.section49CoverageMetrics},section49ZeroCountMetrics:{...report.section49ZeroCountMetrics},executedVerificationEvidence:{fingerprint:evidence.fingerprint,receiptCount:evidence.receiptCount,observationCount:evidence.observationCount,evidenceSha256:evidence.evidenceSha256,receiptReferences:evidence.receiptReferences},negativePopulations:evidence.negativePopulations,normativeRequirementTrace:evidence.normativeRequirementTrace,contractRequirementTrace:evidence.contractRequirementTrace};
  if(output.section49CoverageMetrics.normativeRequirementTraceCoverage){
    const traced=evidence.normativeRequirementTrace.filter(row=>row.disposition==='QUALIFIED_EXECUTED_ASSERTION_EVIDENCE');
    output.section49CoverageMetrics.normativeRequirementTraceCoverage={...output.section49CoverageMetrics.normativeRequirementTraceCoverage,numerator:traced.length,denominator:evidence.normativeRequirementTrace.length,includedIds:evidence.normativeRequirementTrace.map(row=>row.normativeRequirementId),scopeHash:sha({fingerprint:evidence.fingerprint,trace:evidence.normativeRequirementTrace}),evidenceReferences:traced.flatMap(row=>row.executedAssertions.map(assertion=>`${assertion.suite}.json#${assertion.checkId}`)),value:null,disposition:'UNKNOWN',evidenceBasis:'EXACT_CURRENT_REQUIREMENT_ASSERTION_LINKS_WITH_EXPLICIT_UNPROVED_CLAUSES',qualifiedExecutedRequirementCount:traced.length,fullClauseConformanceEstablished:false};
    output.normativeRequirementTraceCoverage=null;
  }
  for(const [key,metric]of Object.entries(evidence.metrics)){
    if(Object.hasOwn(output.coverageMetrics,key))output.coverageMetrics[key]=metric;
    else output.section49CoverageMetrics[key]=metric;
    output[key]=metric.value;
  }
  for(const [key,value]of Object.entries(evidence.zeroCounts)){
    output[key]=value;if(Object.hasOwn(output.section49ZeroCountMetrics,key))output.section49ZeroCountMetrics[key]=value;
  }
  const values=Object.values(output.section49ZeroCountMetrics);
  output.section49ZeroCountInvariantCount=values.length;
  output.section49ZeroCountUnknowns=values.filter(value=>value===null).length;
  output.section49ZeroCountInvariantViolations=values.some(value=>value===null)?null:values.reduce((sum,value)=>sum+value,0);
  return output;
}
export function applyAvailableExecutedEvidence(report){
  const file=process.env.CLOSED_LOOP_VERIFICATION_EVIDENCE||(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS?path.join(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,'evidence.json'):null);
  return file&&fs.existsSync(file)?applyExecutedEvidence(report,readExecutedEvidence(file)):report;
}
