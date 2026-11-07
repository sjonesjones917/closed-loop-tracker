import assert from 'node:assert/strict';
import {types} from 'node:util';
import {pathToFileURL} from 'node:url';
export const FRACTIONAL_STABILITY_ORACLE='COUNTERPART_FRACTIONAL_STABILITY_CANONICAL_REFUSAL_ORACLE';
// This observer never permits invalid canonical data. It recognizes only the
// declared mutant's actual projection preimage at the canonical hash boundary.
export function fractionalStabilityRefusal(error,preimage,{fault,currentRequirementIds}={}){
 if(fault!=='fractional-stability'||!types.isNativeError(error)||error.name!=='TypeError')return null;
 const match=/^Cannot canonically hash non-safe-integer JSON number at \$\.stages\.13\.derivedData\.STABILITY_SUMMARY\.requirementStability\.([^.]+)\.agreementRate\.$/.exec(error.message);
 if(!match)return null;
 let ids;try{ids=typeof currentRequirementIds==='function'?currentRequirementIds():currentRequirementIds;}catch{return null;}
 if(!Array.isArray(ids)||!ids.includes(match[1]))return null;
 const value=preimage?.stages?.[13]?.derivedData?.STABILITY_SUMMARY?.requirementStability?.[match[1]]?.agreementRate;
 if(typeof value!=='number'||!Number.isFinite(value)||Number.isInteger(value)||value<=0||value>=1)return null;
 const stack=String(error.stack||'');
 if(!/at canonicalChunks \(hash\.js:\d+:\d+\)/.test(stack)||!/at (?:Object\.)?createApplicationDerivationReceipt \(workflow-schema\.js:\d+:\d+\)/.test(stack)||!/at recordApplicationProjection \(workflow-engine\.js:\d+:\d+\)/.test(stack))return null;
 return {requirementId:match[1],value,errorType:error.name,message:error.message,stack};
}
export function rethrowFractionalStabilityRefusal(error,preimage,context,{observe=()=>{}}={}){
 const refusal=fractionalStabilityRefusal(error,preimage,context);
 if(!refusal)throw error;
 observe(refusal);
 assert.fail(FRACTIONAL_STABILITY_ORACLE+': exact noncanonical agreement rate rejected by projection receipt hashing');
}
export function verifyFractionalStabilityRefusalControls(){
 // Explicit synthetic classifier fixtures; the full injected owner separately
 // supplies an actual thrown error, failing hash preimage and current IDs.
 const make=()=>{const id='REQ-CONTROL',message='Cannot canonically hash non-safe-integer JSON number at $.stages.13.derivedData.STABILITY_SUMMARY.requirementStability.'+id+'.agreementRate.',error=new TypeError(message);error.stack='TypeError: '+message+'\n    at canonicalChunks (hash.js:156:141)\n    at Object.createApplicationDerivationReceipt (workflow-schema.js:2539:249)\n    at recordApplicationProjection (workflow-engine.js:4515:209)';return {error,preimage:{stages:{13:{derivedData:{STABILITY_SUMMARY:{requirementStability:{[id]:{agreementRate:0.9}}}}}}},context:{fault:'fractional-stability',currentRequirementIds:[id]}};};
 const good=make();let observed=0;assert.throws(()=>rethrowFractionalStabilityRefusal(good.error,good.preimage,good.context,{observe:()=>observed++}),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith(FRACTIONAL_STABILITY_ORACLE));assert.equal(observed,1);
 const mutations=[
  row=>{row.context.fault=null;},row=>{row.context.fault='missing-defect-gate';},row=>{row.context.currentRequirementIds=[];},row=>{row.context.currentRequirementIds=()=>{throw new Error('unavailable identity');};},
  row=>{row.error=new Error(row.error.message);},row=>{row.error=new ReferenceError(row.error.message);},row=>{row.error={name:'TypeError',message:row.error.message,stack:row.error.stack};},
  row=>{row.error.message=row.error.message.replace('stages.13','stages.12');},row=>{row.error.message=row.error.message.replace('agreementRate','runCount');},row=>{row.error.message='Unrelated failure';},
  ...['canonicalChunks','createApplicationDerivationReceipt','recordApplicationProjection'].map(name=>row=>{row.error.stack=row.error.stack.replace(name,'unrelated');}),
  ...[0,1,NaN,Infinity,-0,0.9+'','rational:9/10',null].map(value=>row=>{row.preimage.stages[13].derivedData.STABILITY_SUMMARY.requirementStability['REQ-CONTROL'].agreementRate=value;}),
  row=>{delete row.preimage.stages;}
 ];
 for(const mutate of mutations){const row=make();mutate(row);assert.equal(fractionalStabilityRefusal(row.error,row.preimage,row.context),null);assert.throws(()=>rethrowFractionalStabilityRefusal(row.error,row.preimage,row.context),error=>error===row.error);}
 return {syntheticClassifierFixture:true,positiveControls:1,negativeControls:mutations.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(verifyFractionalStabilityRefusalControls()));
