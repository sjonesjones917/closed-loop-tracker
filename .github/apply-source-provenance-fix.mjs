import fs from 'node:fs';

function replaceOnce(text,from,to,label){const count=text.split(from).length-1;if(count!==1)throw new Error(`${label}: expected exactly one match; found ${count}.`);return text.replace(from,to);}

let schema=fs.readFileSync('workflow-schema.js','utf8');
schema=replaceOnce(schema,
"const TARGET_PRODUCT_REFERENCE_PATTERN=/(?:closed-loop-tracker|current\\s+application|existing\\s+application|target\\s+product|repository\\s+file|source\\s+code|app-core\\.js|workbook\\.js|prompt-engine\\.js|TEST_PROJECT\\.json|github\\.com\\/sjonesjones917\\/closed-loop-tracker)/i;",
"const TARGET_PRODUCT_REFERENCE_PATTERN=/(?:closed-loop-tracker|current\\s+application|existing\\s+application|target\\s+product|current\\s+ui|target\\s+screenshot|app-core\\.js|workbook\\.js|prompt-engine\\.js|TEST_PROJECT\\.json|github\\.com\\/sjonesjones917\\/closed-loop-tracker)/i;",
'scope target-product source detection to actual target identity');
schema=replaceOnce(schema,
"  if(/(?:repository|source code|current ui|existing implementation|target screenshot)/i.test(String(fields.SOURCE_TYPE||'')))issues.push('Source type describes an implementation artifact rather than independent external authority.');\n",
"",
'remove blanket repository/source-code source rejection');
fs.writeFileSync('workflow-schema.js',schema);

let engine=fs.readFileSync('workflow-engine.js','utf8');
engine=replaceOnce(engine,
"    case 4:\n      requireAccepted();requireCount('requirements',1);\n      for(const req of collection('requirements'))for(const name of schema.RECORD_SCHEMAS.requirements.required)if(!String(recordValue(req,name)||'').trim())reasons.push(`${recordId(req,'requirements')}: ${name} is missing.`);\n      break;",
"    case 4:{\n      requireAccepted();requireCount('requirements',1);\n      for(const req of collection('requirements')){\n        for(const name of schema.RECORD_SCHEMAS.requirements.required)if(!String(recordValue(req,name)||'').trim())reasons.push(`${recordId(req,'requirements')}: ${name} is missing.`);\n        const sourceId=String(recordValue(req,'SOURCE_ID')||req.relationships?.SOURCE_ID||'').trim(),userRelationship=String(recordValue(req,'USER_INPUT_RELATIONSHIP')||'').trim();\n        if(!sourceId&&!userRelationship)reasons.push(`${recordId(req,'requirements')}: requirement lacks source provenance or an explicit User Job Input relationship.`);\n      }\n      break;\n    }",
'require canonical requirement provenance');
fs.writeFileSync('workflow-engine.js',engine);

let ingestion=fs.readFileSync('verify-ingestion.mjs','utf8');
ingestion=replaceOnce(ingestion,
"negative('target product source',(e)=>{e.stageData={};e.records={sources:[sourceProposal('source-target',{TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',PUBLICATION_ORIGIN:'current application',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'target product',APPLICABLE_PORTIONS:'app-core.js',CONTROLLING_STATE:'CONTROLLING'})]};},'INVALID_EXTERNAL_SOURCE');",
"{const externalRepoIssues=schema.sourceClassificationIssues({TITLE:'Official vendor reference implementation',ISSUING_ORGANIZATION_OR_AUTHOR:'Example Vendor',SOURCE_TYPE:'OFFICIAL SOURCE CODE REPOSITORY',PUBLICATION_ORIGIN:'Vendor-maintained repository',URL_REFERENCE:'https://github.com/example-vendor/reference-implementation',AUTHORITY_LEVEL:'PRIMARY DIRECT EVIDENCE',AUTHORITY_ROLE:'SUPPORTING EVIDENCE',RELEVANCE:'Direct evidence of the vendor implementation',APPLICABLE_PORTIONS:'Published implementation behavior',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'NON-GOVERNING EVIDENCE'});if(externalRepoIssues.length)throw new Error(`Legitimate external source-code repository was rejected: ${externalRepoIssues.join(' | ')}`);}\nnegative('target product source',(e)=>{e.stageData={};e.records={sources:[sourceProposal('source-target',{TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',PUBLICATION_ORIGIN:'current application',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'target product',APPLICABLE_PORTIONS:'app-core.js',CONTROLLING_STATE:'CONTROLLING'})]};},'INVALID_EXTERNAL_SOURCE');",
'allow legitimate external repository evidence while retaining target rejection');
fs.writeFileSync('verify-ingestion.mjs',ingestion);

let full=fs.readFileSync('verify-full-cycle.mjs','utf8');
full=replaceOnce(full,
"data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:'The deliverable must contain the required verified content.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_MEANING',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})]}});const reqId=rid('requirements');complete(4);",
"data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:'The deliverable must contain the required verified content.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_MEANING',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})]}});const reqId=rid('requirements');{const unsupported=engine.clone(p),req=unsupported.projectData.requirements.find(r=>engine.recordId(r,'requirements')===reqId);req.fields.USER_INPUT_RELATIONSHIP='';req.USER_INPUT_RELATIONSHIP='';const unsupportedGate=engine.gate(4,unsupported);assert(!unsupportedGate.complete&&unsupportedGate.reasons.some(reason=>reason.includes('lacks source provenance')),'Stage 04 accepted a requirement with neither source nor User Job Input provenance.');}complete(4);",
'prove unsupported requirement cannot complete Stage 04');
fs.writeFileSync('verify-full-cycle.mjs',full);

console.log(JSON.stringify({patched:['workflow-schema.js','workflow-engine.js','verify-ingestion.mjs','verify-full-cycle.mjs'],semanticFixes:['requirement provenance','external repository evidence classification']},null,2));
