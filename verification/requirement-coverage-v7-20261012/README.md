# Complete portable forecast work-map proposal

This proposal completes V7's incremental map over the exact V5 baseline. The exact ID join replaced 2,944 V5 `COUNTED_UNTRIAGED` rows with their corresponding V7 rows and retained the other 1,055 V5 rows unchanged. The result has 3,999 rows and 3,999 unique substantive NREQ IDs. Primary counts are 2,265 `SEMANTIC_REVIEW_TRIAGE`, 760 `ASSERTION_EVIDENCE_ADMISSION`, 480 `REQUIRED_VERIFICATION`, 488 `COUNTED_UNTRIAGED`, and 6 `COMPLETED_FROZEN`.

The separate contextual count is 67, as recorded in V5. No contextual row objects are asserted in this proposal; it links the retained master lifecycle ledger and schedule by private evidence reference and SHA-256. The contextual count remains separate from the 3,999 substantive denominator.

The package summary is 568 bounded review/action packages, plus 2 conditional CI renewal packages and 1 conditional inherited append-only package. Conditional work is not PASS. All exact row actions, owner labels, source references, and unresolved premises are preserved from their source records. No bugs, PASS, ETA, or execution authorization are inferred.

Repository paths were converted to repository-relative locators, with current availability and hashes in the JSON. Executor-private paths remain opaque references; their source bytes are not included. The previous portable V7 proposal remains unchanged. Root's readback that its changes were path strings only is retained in the JSON lineage.

This is a private work-map proposal only. It includes no new audit, tests, semantic review, source edits, runtime edits, or external transfer.


## Public locator sanitation

The packaged map uses six stable `PRIVATE_FIXTURE_LOCATOR_####` tokens for 62 controlled synthetic fixture-locator occurrences. Original locator values and the mapping are excluded and remain available only in the authorized private source environment. Parsed row recovery under the private mapping matched all 3,999 rows; NREQ IDs, assertion links, owners, actions, dispositions, and scope are unchanged. The 89 opaque private evidence references remain unavailable and are not proof. Sanitized JSON SHA-256: `8b10831c9cf7c1cf069fde6528869ab870f9079e5781e3fbe085e6afd5b33a97`; deterministic gzip SHA-256: `6daa30fa4e240e7a62716531db6882eeb04611d59dd4334e4037a5a8a8c39608`.


## Private-path-bearing historical record qualification

`verification/test-ir-native-contract-repair-20261010.json` is retained only as a repository-relative historical identity (`SHA-256 29e20a80fa9fcce3acd177c4f72cad881755bfb72338ae1643f34c8bd640f07a`, 56,911 bytes). Its raw bytes are excluded because the completed privacy review found 15 private absolute-path occurrences representing 10 unique values. The work map preserves 26 substantive-row evidence links and one repository-source index reference, but marks all 27 references `PRIVATE_SOURCE_ONLY_NOT_INCLUDED`, historical-identity-only, and nonproof. No sanitized successor is claimed, and no availability, execution eligibility, admission, or proof promotion follows from the retained identity.
