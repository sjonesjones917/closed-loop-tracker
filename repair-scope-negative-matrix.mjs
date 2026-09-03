import fs from 'node:fs';
const path='verify-ingestion.mjs';
let source=fs.readFileSync(path,'utf8');
const old="for(const [name,stage,key] of [['project revision',2,'projectRevision'],['input version',2,'inputVersion'],['source set version',3,'sourceSetVersion'],['requirements version',5,'requirementsVersion'],['test suite version',7,'testSuiteVersion'],['instruction version',9,'instructionVersion'],['iteration',10,'iterationId'],['candidate',10,'candidateId'],['run',11,'runId'],['context',11,'contextId'],['baseline',20,'baselineId'],['product',21,'productId']])scopeNegative(name,stage,key);";
if(!source.includes(old))throw new Error('Old scope negative matrix was not found.');
const replacement="for(const [name,stage,key] of [['input version',1,'inputVersion'],['source set version',2,'sourceSetVersion'],['research version',3,'researchVersion'],['requirements version',4,'requirementsVersion'],['test suite version',6,'testSuiteVersion'],['instruction version',8,'instructionVersion'],['iteration',10,'iterationId'],['candidate',10,'candidateId'],['run',11,'runId'],['source converged iteration',19,'sourceConvergedIterationId'],['confirmation iteration',19,'confirmationIterationId'],['baseline',20,'baselineId'],['product',21,'productId'],['product version',22,'productVersion'],['delivery candidate set',25,'deliveryCandidateSetId'],['review version',26,'reviewVersion'],['reconciled review version',27,'reconciledReviewVersion'],['release',28,'releaseId'],['hash review',29,'hashReviewId'],['evidence chain version',30,'evidenceChainVersion']])scopeNegative(name,stage,key);";
source=source.replace(old,replacement);
fs.writeFileSync(path,source);
console.log('Replaced stale scope-negative matrix with the exact Section 14.7 dimension universe.');
