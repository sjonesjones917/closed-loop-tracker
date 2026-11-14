import assert from 'node:assert/strict';

// IDs are resolved from the authored fixture and real run reservations by the
// caller. No production selection, matrix, plan, or coverage function is used.
export const verificationTupleId=(requirementId,runId,testId)=>JSON.stringify([requirementId,runId,testId]);

export function exactVerificationTuples(expectedIncludedIds,acceptedTupleIds){
 assert.equal(new Set(expectedIncludedIds).size,expectedIncludedIds.length,'EXACT_VERIFICATION_FIXTURE_ORACLE: expected tuples are not unique');
 const expected=new Set(expectedIncludedIds),counts=new Map();
 for(const id of acceptedTupleIds)counts.set(id,(counts.get(id)||0)+1);
 const includedIds=[...counts.keys()].sort(),missingIds=expectedIncludedIds.filter(id=>!counts.has(id)).sort(),extraIds=includedIds.filter(id=>!expected.has(id)),duplicateIds=includedIds.filter(id=>counts.get(id)!==1);
 const observed={includedIds,acceptedTupleIds:[...acceptedTupleIds].sort(),expectedCount:expectedIncludedIds.length,acceptedCount:acceptedTupleIds.length,missingIds,extraIds,duplicateIds};
 assert.equal(missingIds.length+extraIds.length+duplicateIds.length,0,'EXACT_VERIFICATION_TUPLE_ORACLE: '+JSON.stringify(observed));
 return observed;
}
