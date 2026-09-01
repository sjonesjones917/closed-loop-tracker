export const DEPLOYMENT_SCHEMA='closed-loop-deployment-manifest/1';
export const CANONICALIZATION_VERSION='closed-loop-canonical-json/1';
export const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
export const WORKER_DIGEST_PLACEHOLDER='__CLOSED_LOOP_TEST_WORKER_SHA256__';
export const BUILD_IDENTITY_SCHEMA='closed-loop-build-identity/1';
export const BUILD_IDENTITY_PATH='build-identity.json';
export const BUILD_IDENTITY_DERIVATION_SCHEMA='closed-loop-runtime-build-input/1';
export const BUILD_IDENTITY_PREFIX='clb-';
export const DEPLOYMENT_REBUILD_PERMITTED=false;

export const DEPLOYMENT_SOURCE_RUNTIME_PATHS=Object.freeze([
  'index.html',
  'workbook.js',
  'hash.js',
  'workflow-schema.js',
  'test-runtime.js',
  'test-worker.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js',
  'TEST_PROJECT.json'
]);

export const DEPLOYMENT_GENERATED_RUNTIME_PATHS=Object.freeze([BUILD_IDENTITY_PATH]);
export const DEPLOYMENT_RUNTIME_PATHS=Object.freeze([...DEPLOYMENT_SOURCE_RUNTIME_PATHS,...DEPLOYMENT_GENERATED_RUNTIME_PATHS]);

export const MAIN_RUNTIME_SCRIPT_PATHS=Object.freeze([
  'workbook.js',
  'hash.js',
  'workflow-schema.js',
  'test-runtime.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js'
]);

export const DEPLOYMENT_CONTROL_PATHS=Object.freeze(['.nojekyll']);

export function mediaTypeFor(file){
  if(file.endsWith('.html'))return 'text/html; charset=utf-8';
  if(file.endsWith('.js'))return 'text/javascript; charset=utf-8';
  if(file.endsWith('.json'))return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}
