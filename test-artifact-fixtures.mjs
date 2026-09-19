// Named test inputs still go through the production allocator. The label is a
// fixture command identity, never a substitute canonical artifact identity.
export function artifactFixtureId(engine,project,label){
 const existing=project.projectData?.allocationReceipts?.find(row=>row.collection==='artifacts'&&row.commandId==='FIXTURE_ARTIFACT:'+label);
 if(existing){engine.assertArtifactAllocation(project,existing.resultingId);return existing.resultingId;}
 return engine.allocateId(project,'artifacts',engine.clone({commandId:'FIXTURE_ARTIFACT:'+label,idempotencyKey:'fixture-file',payload:{label}}));
}
