#!/usr/bin/env bash
set -euo pipefail
node --check workbook.js
node --check workflow-schema.js
node verify-canonical-job-contract.mjs
node verify-contract-profile-migration.mjs
node verify-closed-contract-registries.mjs
node verify-hash.mjs
node verify-v3-migration.mjs
node verify-v3-contract.mjs
node verify-spec3-contract.mjs
