(()=>{
'use strict';
// Compatibility entry point for existing consumers. Comparison policy belongs
// to the production engine; this file must never replace gates or projections.
if(typeof globalThis.closedLoopWorkflowEngine?.evaluateCrossRunComparison!=='function')throw new Error('Load the production workflow-engine.js comparison authority first.');
})();
