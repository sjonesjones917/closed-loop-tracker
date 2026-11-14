import {verifyComparisonMaterialityPackage} from './test-comparison-materiality-package.mjs';
import {verifySyntheticHandoffBatching,verifySyntheticHandoffBatchingFaults} from './test-synthetic-handoff-batching.mjs';

if(process.argv.length!==2)throw new Error('MATERIALITY_PACKAGE_DEFAULT_OWNER_ORACLE: complete default invocation required.');
const authorizationBatching={...await verifySyntheticHandoffBatching(),...await verifySyntheticHandoffBatchingFaults()};
console.log(JSON.stringify({...await verifyComparisonMaterialityPackage(),authorizationBatching}));
