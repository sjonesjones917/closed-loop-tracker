import {verifyComparisonMaterialityPackage} from './test-comparison-materiality-package.mjs';

if(process.argv.length!==2)throw new Error('MATERIALITY_PACKAGE_DEFAULT_OWNER_ORACLE: complete default invocation required.');
console.log(JSON.stringify(await verifyComparisonMaterialityPackage()));
