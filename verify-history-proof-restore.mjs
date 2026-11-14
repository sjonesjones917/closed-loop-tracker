// History root proofs restoring versions in an import (Tier 1.5), split from
// verify-history-proof-reuse.mjs (which holds the production store realms,
// fixtures, sections and implementation faults all three proof suites use)
// so that each suite completes within its conformance child deadline. A
// proven root that no pair serves, and the active version's proven root, is
// restored and digested as cold and skips only its static check when those
// digests equal its proof's; its pair check refuses exactly as cold and
// mints exactly what a cold import mints; the cold conflict check digests
// parts lists as cold; and values bound to a proof only by natives seen
// unchanged around their awaited restore are refused or accepted exactly as
// a cold page-realm store, which holds no proof at all. Each implementation
// fault these sections own reruns only its sections and must be detected by
// its oracle.
import {pathToFileURL} from 'node:url';
import {runHistoryProofSuite} from './verify-history-proof-reuse.mjs';

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)await runHistoryProofSuite('verify-history-proof-restore.mjs');
