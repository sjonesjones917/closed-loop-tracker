from pathlib import Path

p=Path('workbook.js'); s=p.read_text()
old="""  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);\n  const migrated=JSON.parse(JSON.stringify(p));\n  const original=JSON.parse(JSON.stringify(p));\n  migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;"""
new="""  const sourceSchema=String(p.schema||'');\n  if(!['human-project/30','closed-loop-project/2'].includes(sourceSchema))throw new Error(`Unsupported project schema: ${sourceSchema||'MISSING'}`);\n  const migrated=JSON.parse(JSON.stringify(p));\n  const original=JSON.parse(JSON.stringify(p));\n  migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;"""
if new not in s:
    assert s.count(old)==1, 'migration entry target not unique'
    s=s.replace(old,new,1)
a="{kind:'LEGACY_STAGE_RECORDS',schema:'human-project/30',records:"; b="{kind:'LEGACY_STAGE_RECORDS',schema:sourceSchema,records:"
if b not in s:
    assert s.count(a)==1
    s=s.replace(a,b,1)
a="{kind:'MIGRATION_SOURCE',schema:'human-project/30',preservedAt:"; b="{kind:'MIGRATION_SOURCE',schema:sourceSchema,preservedAt:"
if b not in s:
    assert s.count(a)==1
    s=s.replace(a,b,1)
p.write_text(s)

p=Path('workflow-engine.js'); s=p.read_text()
old="function requiredVersionScopeKeys(collection){const stage=Number(schema.RECORD_SCHEMAS[collection]?.stage||0),keys=[];if(stage>=2)keys.push('inputVersion','sourceSetVersion');if(stage>=4)keys.push('requirementsVersion');if(stage>=6)keys.push('testSuiteVersion');if(stage>=8)keys.push('instructionVersion');return keys;}"
new="function requiredVersionScopeKeys(collection){const stage=Number(schema.RECORD_SCHEMAS[collection]?.stage||0),keys=[];if(stage>=2)keys.push('sourceSetVersion');if(stage>=4)keys.push('requirementsVersion');if(stage>=6)keys.push('testSuiteVersion');if(stage>=8)keys.push('instructionVersion');return keys;}"
if new not in s:
    assert s.count(old)==1, 'scope target not unique'
    s=s.replace(old,new,1)
p.write_text(s)

p=Path('verify-spec3-contract.mjs'); s=p.read_text()
old="""const p=core.createBlankState('CAPTURE');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested thing',EXPLICIT_USER_REQUIREMENTS:'Never ask me for the same project data twice',SUPPLIED_MATERIALS_INVENTORY:'intent.pdf',EXACT_DELIVERABLE_REQUESTED:'finished product',INPUT_SET_CONTENTS:'captured project requirements'});engine.ensureShape(p);engine.recalculate(p);const intake=engine.stage01IntakeManifest(p),ob=engine.stage04ObligationManifest(p);assert(intake.entries.length>=3);assert(ob.entries.some(x=>String(x.value).includes('Never ask me')));const pr=prompt.buildPromptRecord(4,p).prompt;for(const t of ['PROJECT DATA EXECUTION RULE — MANDATORY','APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Never ask the human','Never ask me for the same project data twice'])assert(pr.includes(t),t);console.log(JSON.stringify({projectSchema:core.PROJECT_SCHEMA,responseSchema:schema.RESPONSE_SCHEMA,stageCount:core.STAGE_COUNT,intake: intake.entries.length,obligations:ob.entries.length,visualBaselineRestored:true,testRuntimeLoaded:true}));"""
new="""const p=core.createBlankState('CAPTURE');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested thing',EXPLICIT_USER_REQUIREMENTS:'Never ask me for the same project data twice',SUPPLIED_MATERIALS_INVENTORY:'intent.pdf'});engine.ensureShape(p);engine.recalculate(p);const intake=engine.intakeCoverageManifest(p);p.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED='finished product';p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Captured for migration contract fixture.',extractedStatements:[{statementKey:'S'+String(i+1),text:u.rawValueText||u.label,statementClass:'FACT'}]}))});for(let stage=1;stage<=3;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';const ob=engine.obligationManifest(p);assert(intake.units.length>=3);assert(ob.items.some(x=>String(x.text).includes('Never ask me')));const pr=prompt.buildPromptRecord(4,p).prompt;for(const t of ['PROJECT DATA EXECUTION RULE — MANDATORY','APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Never ask the human','Never ask me for the same project data twice'])assert(pr.includes(t),t);console.log(JSON.stringify({projectSchema:core.PROJECT_SCHEMA,responseSchema:schema.RESPONSE_SCHEMA,stageCount:core.STAGE_COUNT,intake:intake.units.length,obligations:ob.items.length,visualBaselineRestored:true,testRuntimeLoaded:true}));"""
if new not in s:
    assert s.count(old)==1, 'spec3 fixture target not unique'
    s=s.replace(old,new,1)
p.write_text(s)

p=Path('.github/workflows/pages.yml'); s=p.read_text()
start='            fieldOwnershipCoverage:1,\n'; end='            unrequestedUnrelatedVisualChanges:0,\n'
if start in s:
    i=s.find(start); j=s.find(end,i); assert i>=0 and j>=0 and s.find(start,i+1)<0
    j+=len(end)
    block="""            fieldOwnershipCoverage:definition.fieldOwnershipCoverage,
            applicationDerivationCoverage:definition.applicationDerivationCoverage,
            typedRelationshipCoverage:definition.typedRelationshipCoverage,
            stage01IntakeCoverage:v3.stage01IntakeCoverage,
            stage01RawInputAccounting:v3.stage01IntakeCoverage,
            stage01RequiredFileInspectionAccounting:v3.stage01IntakeCoverage,
            stage01AcceptedSemanticMappingCoverage:v3.stage01IntakeCoverage,
            stage04ObligationCoverage:v3.stage04ObligationCoverage,
            stage04ObligationAccounting:v3.stage04ObligationCoverage,
            acceptedAgentValueExtractionCoverage:definition.acceptedAgentValueExtractionCoverage,
            acceptedRelationshipProvenanceCoverage:definition.acceptedRelationshipProvenanceCoverage,
            currentScopeSelectorCoverage:definition.currentScopeSelectorCoverage,
            exactReqRunTestCoverage:definition.exactReqRunTestCoverage,
            reqRunTestCoverage:definition.exactReqRunTestCoverage,
            applicableCurrentRegressionSuccess:definition.applicableCurrentRegressionSuccess,
            mandatoryEvidenceChainStructuralCoverage:definition.mandatoryEvidenceChainCoverage,
            mandatoryEvidenceSufficiencyCoverage:v3.mandatoryEvidenceSufficiencyCoverage,
            releaseArtifactIdentityCoverage:definition.releaseArtifactIdentityCoverage,
            nativeExecutionCoverage:v3.nativeExecutionCoverage,
            unauthorizedFieldMutationsAccepted:definition.unauthorizedFieldMutationsAccepted,
            canonicalMutationsBeforeAcceptance:definition.canonicalMutationsBeforeAcceptance,
            partialCommitsAfterInjectedFailure:definition.partialCommitsAfterInjectedFailure,
            staleProposalsAccepted:definition.staleProposalsAccepted,
            crossProjectRelationshipsAccepted:definition.crossProjectRelationshipsAccepted,
            historicalScopeSatisfyingCurrentGates:definition.historicalScopeSatisfyingCurrentGates,
            unmatchedDeliveryFilesAuthorized:definition.unmatchedDeliveryFilesAuthorized,
            appendOnlyHistoryRewritesAccepted:definition.appendOnlyHistoryRewritesAccepted,
            unsupportedTestIrTreatedAsExecutable:v3.unsupportedTestIrTreatedAsExecutable,
            externalAssertionsOverridingApplicationProof:v3.externalAssertionsOverridingApplicationProof,
            nativeExecutionReceiptsFabricatedExternally:v3.nativeExecutionReceiptsFabricatedExternally,
            releaseAcceptedWithContradiction:v3.releaseAcceptedWithContradiction,
            stage04RequestsToRepeatAcceptedUserIntent:v3.stage04RequestsToRepeatAcceptedUserIntent,
            unrequestedUnrelatedVisualChanges:v3.unrequestedUnrelatedVisualChanges,
"""
    s=s[:i]+block+s[j:]
if '            liveBrowserVerification:true,\n' not in s:
    marker='            liveVerification:true,\n'; assert s.count(marker)==1
    s=s.replace(marker,marker+'            liveBrowserVerification:true,\n',1)
p.write_text(s)
