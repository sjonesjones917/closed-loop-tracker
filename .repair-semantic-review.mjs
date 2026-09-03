import fs from 'node:fs';
const path='response-ingestion.js';
let text=fs.readFileSync(path,'utf8');
const old=`  const currentAndProposedPropositions=[...workflow.recordsForCurrentScope(project,'propositions'),...safe(canonicalRecords.propositions)];
  for(const test of safe(canonicalRecords.tests)){
    const requirementId=String(test.fields?.REQ_ID||test.relationships?.REQ_ID||'');
    const proposition=currentAndProposedPropositions.find(item=>String(item.fields?.REQUIREMENT_ID||item.relationships?.REQUIREMENT_ID||'')===requirementId);
    test.fields.TARGET_PROPOSITION_IDS=proposition?[workflow.recordId(proposition,'propositions')]:[];
    test.TARGET_PROPOSITION_IDS=test.fields.TARGET_PROPOSITION_IDS;
    test.fields.SEMANTIC_REVIEW_IDS=[rawRecord.rawResponseId];
    test.SEMANTIC_REVIEW_IDS=test.fields.SEMANTIC_REVIEW_IDS;
    test.fields.RELEASE_BEARING=Boolean(proposition&&String(test.fields.SEMANTIC_COVERAGE_DISPOSITION||'').toUpperCase()==='EQUIVALENT'&&['REQUIRED_PROOF','SUPPORTING_PROOF','REGRESSION'].includes(String(test.fields.TEST_ROLE||'').toUpperCase()));
    test.RELEASE_BEARING=test.fields.RELEASE_BEARING;
  }
  for(const expression of safe(canonicalRecords.proofExpressions)){
    expression.fields.NORMALIZED_EXPRESSION=clone(expression.fields.PROPOSED_EXPRESSION);
    expression.NORMALIZED_EXPRESSION=expression.fields.NORMALIZED_EXPRESSION;
    expression.fields.SEMANTIC_EQUIVALENCE_DISPOSITION='EQUIVALENT';
    expression.SEMANTIC_EQUIVALENCE_DISPOSITION='EQUIVALENT';
    expression.fields.ACCEPTED_SEMANTIC_REVIEW_IDS=[rawRecord.rawResponseId];
    expression.ACCEPTED_SEMANTIC_REVIEW_IDS=expression.fields.ACCEPTED_SEMANTIC_REVIEW_IDS;
  }`;
const replacement=`  const currentAndProposedPropositions=[...workflow.recordsForCurrentScope(project,'propositions'),...safe(canonicalRecords.propositions)];
  for(const test of safe(canonicalRecords.tests)){
    const requirementId=String(test.fields?.REQ_ID||test.relationships?.REQ_ID||'');
    const proposition=currentAndProposedPropositions.find(item=>String(item.fields?.REQUIREMENT_ID||item.relationships?.REQUIREMENT_ID||'')===requirementId);
    test.fields.TARGET_PROPOSITION_IDS=proposition?[workflow.recordId(proposition,'propositions')]:[];
    test.TARGET_PROPOSITION_IDS=test.fields.TARGET_PROPOSITION_IDS;
    // The authoring response may propose semantic coverage, but it cannot serve as its own independent review.
    test.fields.SEMANTIC_REVIEW_IDS=[];
    test.SEMANTIC_REVIEW_IDS=[];
    test.fields.RELEASE_BEARING=false;
    test.RELEASE_BEARING=false;
  }
  for(const expression of safe(canonicalRecords.proofExpressions)){
    // Syntactic normalization is application-owned; semantic sufficiency remains UNKNOWN until a distinct accepted review exists.
    expression.fields.NORMALIZED_EXPRESSION=clone(expression.fields.PROPOSED_EXPRESSION);
    expression.NORMALIZED_EXPRESSION=expression.fields.NORMALIZED_EXPRESSION;
    expression.fields.SEMANTIC_EQUIVALENCE_DISPOSITION='UNKNOWN';
    expression.SEMANTIC_EQUIVALENCE_DISPOSITION='UNKNOWN';
    expression.fields.ACCEPTED_SEMANTIC_REVIEW_IDS=[];
    expression.ACCEPTED_SEMANTIC_REVIEW_IDS=[];
  }`;
const count=text.split(old).length-1;
if(count!==1)throw new Error(`Expected one semantic self-approval block, found ${count}.`);
text=text.replace(old,replacement);
fs.writeFileSync(path,text);

const regression=`import fs from 'node:fs';\nimport assert from 'node:assert/strict';\nconst source=fs.readFileSync('response-ingestion.js','utf8');\nfunction selfApprovalDefects(text){const defects=[];if(text.includes('test.fields.SEMANTIC_REVIEW_IDS=[rawRecord.rawResponseId]'))defects.push('test-self-review');if(/test\\.fields\\.RELEASE_BEARING=Boolean\\(proposition/.test(text))defects.push('author-release-bearing');if(text.includes(\"expression.fields.SEMANTIC_EQUIVALENCE_DISPOSITION='EQUIVALENT'\"))defects.push('proof-self-equivalence');if(text.includes('expression.fields.ACCEPTED_SEMANTIC_REVIEW_IDS=[rawRecord.rawResponseId]'))defects.push('proof-self-review');return defects;}\nconst deliberatelyBad=source+\"\\ntest.fields.SEMANTIC_REVIEW_IDS=[rawRecord.rawResponseId];\\ntest.fields.RELEASE_BEARING=Boolean(proposition);\\nexpression.fields.SEMANTIC_EQUIVALENCE_DISPOSITION='EQUIVALENT';\\nexpression.fields.ACCEPTED_SEMANTIC_REVIEW_IDS=[rawRecord.rawResponseId];\";assert.equal(selfApprovalDefects(deliberatelyBad).length,4,'mutation fixture must trigger all self-approval defects');assert.deepEqual(selfApprovalDefects(source),[],'author response must not independently approve its own semantic work');assert.match(source,/test\\.fields\\.SEMANTIC_REVIEW_IDS=\\[\\]/);assert.match(source,/test\\.fields\\.RELEASE_BEARING=false/);assert.match(source,/expression\\.fields\\.SEMANTIC_EQUIVALENCE_DISPOSITION='UNKNOWN'/);assert.match(source,/expression\\.fields\\.ACCEPTED_SEMANTIC_REVIEW_IDS=\\[\\]/);console.log('semantic review independence regressions passed');\n`;
fs.writeFileSync('verify-semantic-review-independence.mjs',regression);
