import fs from 'node:fs';

let ingestion=fs.readFileSync('response-ingestion.js','utf8');
const oldKeys="const RESPONSE_SCOPE_KEYS=Object.freeze(['projectRevision','inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId']);";
const newKeys="const RESPONSE_SCOPE_KEYS=Object.freeze(['projectRevision','inputVersion','sourceSetVersion','researchVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','sourceConvergedIterationId','confirmationIterationId','baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion','reconciledReviewVersion','releaseId','hashReviewId','evidenceChainVersion']);";
if(!ingestion.includes(oldKeys))throw new Error('Old response scope key registry not found.');
ingestion=ingestion.replace(oldKeys,newKeys);
fs.writeFileSync('response-ingestion.js',ingestion);

let test=fs.readFileSync('verify-ingestion.mjs','utf8');
const old="for(const [name,stage,key] of [['project revision',2,'projectRevision'],['input version',2,'inputVersion'],['source set version',3,'sourceSetVersion'],['requirements version',5,'requirementsVersion'],['test suite version',7,'testSuiteVersion'],['instruction version',9,'instructionVersion'],['iteration',10,'iterationId'],['candidate',10,'candidateId'],['run',11,'runId'],['context',11,'contextId'],['baseline',20,'baselineId'],['product',21,'productId']])scopeNegative(name,stage,key);";
const replacement="for(const [name,stage,key] of [['project revision',2,'projectRevision'],['input version',1,'inputVersion'],['source set version',2,'sourceSetVersion'],['research version',3,'researchVersion'],['requirements version',4,'requirementsVersion'],['test suite version',6,'testSuiteVersion'],['instruction version',8,'instructionVersion'],['iteration',10,'iterationId'],['candidate',10,'candidateId'],['run',11,'runId'],['source converged iteration',19,'sourceConvergedIterationId'],['confirmation iteration',19,'confirmationIterationId'],['baseline',20,'baselineId'],['product',21,'productId'],['product version',22,'productVersion'],['delivery candidate set',25,'deliveryCandidateSetId'],['review version',26,'reviewVersion'],['reconciled review version',27,'reconciledReviewVersion'],['release',28,'releaseId'],['hash review',29,'hashReviewId'],['evidence chain version',30,'evidenceChainVersion']])scopeNegative(name,stage,key);";
if(!test.includes(old))throw new Error('Old ingestion scope negative matrix not found.');
test=test.replace(old,replacement);
fs.writeFileSync('verify-ingestion.mjs',test);
console.log('Integrated exact response-scope stale detection and negative coverage.');
