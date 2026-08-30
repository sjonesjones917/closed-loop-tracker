require('../../workbook.js');
require('../../hash.js');
require('../../workflow-schema.js');
const s=globalThis.closedLoopWorkflowSchema;
const out={};
for(let n=1;n<=30;n++){const c=s.STAGE_CONTRACTS[n];out[n]={operations:c.operations,primaryCollections:c.primaryCollections,allowedCollections:c.allowedCollections,supportCollections:c.supportCollections,readCollections:c.readCollections,contextCollections:c.contextCollections,scopeRequirements:c.scopeRequirements};}
require('fs').writeFileSync('STAGE_CONTEXT_CONTRACTS.json',JSON.stringify(out,null,2));
