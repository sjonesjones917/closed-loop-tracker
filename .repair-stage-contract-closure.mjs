import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  const first=text.indexOf(from);
  if(first<0)throw new Error(`Repair anchor missing: ${label}`);
  if(text.indexOf(from,first+from.length)>=0)throw new Error(`Repair anchor is ambiguous: ${label}`);
  return text.slice(0,first)+to+text.slice(first+from.length);
}

let workbook=fs.readFileSync('workbook.js','utf8');
workbook=replaceOnce(workbook,"'PRESERVE THE COMPLETE EVIDENCE CHAIN','PRESERVE FAILURES PERMANENTLY'];","'PRESERVE THE COMPLETE EVIDENCE CHAIN','PRESERVE FAILURES PERMANENTLY AND CLOSE DELIVERY'];",'Stage 30 title');
workbook=replaceOnce(workbook,"'Traceability evidence custodian','Permanent defect-registry custodian'];","'Traceability evidence custodian','Permanent defect-registry and terminal-delivery custodian'];",'Stage 30 role');
const obsolete=(workbook.match(/HASHES_RECORDED_WHERE_PRACTICAL/g)||[]).length;
if(obsolete!==2)throw new Error(`Expected exactly two obsolete Stage 10 hash-field references, found ${obsolete}`);
workbook=workbook.replaceAll('HASHES_RECORDED_WHERE_PRACTICAL','ALL_FROZEN_COMPONENT_BYTES_HASHED');
workbook=replaceOnce(workbook,"25:['PRODUCT_ID','PRODUCT_VERSION','REPRESENTATION_REVIEW_VERSION','APPROVED_BASELINE_ID','DELIVERY_ARTIFACT_INVENTORY'","25:['PRODUCT_ID','PRODUCT_VERSION','REPRESENTATION_REVIEW_VERSION','APPROVED_BASELINE_ID','DELIVERY_CANDIDATE_SET_ID','DELIVERY_ARTIFACT_INVENTORY'",'Stage 25 field contract');
workbook=replaceOnce(workbook,"28:['HASH_REVIEW_ID','RELEASE_GATE_ID','RELEASE_GATE_STATE'","28:['HASH_REVIEW_ID','DELIVERY_CANDIDATE_SET_ID','RELEASE_GATE_ID','RELEASE_GATE_STATE'",'Stage 28 field contract');
workbook=replaceOnce(workbook,"30:['DEFECT_REGISTRY_VERSION','REGRESSION_REGISTRY_VERSION','REGISTRY_STORAGE_LOCATION'","30:['DEFECT_REGISTRY_VERSION','REGRESSION_REGISTRY_VERSION','PRE_DELIVERY_CHECKPOINT_ID','DELIVERY_ID','DELIVERY_STATE','DELIVERY_RECORD_HASH','DELIVERY_ATTEMPT_RECORDS','REGISTRY_STORAGE_LOCATION'",'Stage 30 field contract');
workbook=replaceOnce(workbook,'      "APPROVED_BASELINE_ID",\n      "DELIVERY_ARTIFACT_INVENTORY",','      "APPROVED_BASELINE_ID",\n      "DELIVERY_CANDIDATE_SET_ID",\n      "DELIVERY_ARTIFACT_INVENTORY",','Stage 25 ownership');
workbook=replaceOnce(workbook,'      "HASH_REVIEW_ID",\n      "RELEASE_GATE_STATE",','      "HASH_REVIEW_ID",\n      "DELIVERY_CANDIDATE_SET_ID",\n      "RELEASE_GATE_STATE",','Stage 28 ownership');
workbook=replaceOnce(workbook,'      "DEFECT_REGISTRY_VERSION",\n      "REGRESSION_REGISTRY_VERSION",\n      "REGISTRY_IS_APPEND_ONLY",','      "DEFECT_REGISTRY_VERSION",\n      "REGRESSION_REGISTRY_VERSION",\n      "PRE_DELIVERY_CHECKPOINT_ID",\n      "DELIVERY_ID",\n      "DELIVERY_STATE",\n      "DELIVERY_RECORD_HASH",\n      "DELIVERY_ATTEMPT_RECORDS",\n      "REGISTRY_IS_APPEND_ONLY",','Stage 30 ownership');
fs.writeFileSync('workbook.js',workbook);

let schema=fs.readFileSync('workflow-schema.js','utf8');
const oldOverrides="const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({\n  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),\n  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})\n});";
const newOverrides="const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({\n  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),\n  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '10':Object.freeze({ALL_FROZEN_COMPONENT_BYTES_HASHED:Object.freeze({valueType:'BOOLEAN',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '25':Object.freeze({DELIVERY_CANDIDATE_SET_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '28':Object.freeze({DELIVERY_CANDIDATE_SET_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '30':Object.freeze({\n    PRE_DELIVERY_CHECKPOINT_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),\n    DELIVERY_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),\n    DELIVERY_STATE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['AUTHORIZED','BLOCKED']),nullable:false,normalizerKey:null,closedProperties:null}),\n    DELIVERY_RECORD_HASH:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),\n    DELIVERY_ATTEMPT_RECORDS:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})\n  })\n});";
schema=replaceOnce(schema,oldOverrides,newOverrides,'Stage field type overrides');
fs.writeFileSync('workflow-schema.js',schema);

let verify=fs.readFileSync('verify-v3-contract.mjs','utf8');
const line="await import('./verify-stage-contract-closure.mjs');";
if(!verify.includes(line))verify=verify.replace(/\s*$/,'\n'+line+'\n');
fs.writeFileSync('verify-v3-contract.mjs',verify);
