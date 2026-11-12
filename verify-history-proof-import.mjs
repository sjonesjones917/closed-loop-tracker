// History root proofs in an import's own checks, split from
// verify-history-proof-reuse.mjs (which holds the production store realms,
// fixtures, sections and implementation faults all three proof suites use)
// so that each suite completes within its conformance child deadline. In ONE
// proof-holding storage worker an import's preparation of its prior project
// re-binds the local active checkpoint to its proofs in the happy path and
// imports exactly as a fresh cold worker (stored rows included) under every
// local fault, realm change, future derivation or missing pair, and its
// validator checks never answer the History loop's; digests an import
// computes once are reused only within one synchronous span or, for a parts
// list, within its own operation and, at the cold conflict check, only under
// natives confirmed in that check's turn, each equal to a fresh computation;
// and the input checks refuse every change of a captured descriptor and
// accept it once undone. Each implementation fault these sections own reruns
// only its sections and must be detected by its oracle.
import {pathToFileURL} from 'node:url';
import {runHistoryProofSuite} from './verify-history-proof-reuse.mjs';

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)await runHistoryProofSuite('verify-history-proof-import.mjs');
