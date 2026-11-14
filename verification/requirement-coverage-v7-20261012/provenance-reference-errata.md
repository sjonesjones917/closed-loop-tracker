# V7 namespace-qualified provenance crosswalk proposal

This private additive proposal compares explicit reference/digest pairs from the completed V7 map and forecast with the separately delivered 141-entry portable index. It preserves every original map reference and does not alter either source artifact or uploaded snapshot. The SHA-keyed standalone references below are lookup aids across two namespaces; do not substitute them into the original map unless its embedded table and all dependent references are reindexed together. No evidence content was read, and no semantic adequacy or PASS judgment is made.

The completed map contains an 89-entry embedded reference table. All 1,950 explicit row-level reference/digest occurrences match that table exactly, across 61 distinct pairs affecting 697 unique NREQ IDs. The within-map mismatch count is zero. For refs `PRIVATE_EVIDENCE_REF_0077` and `PRIVATE_EVIDENCE_REF_0078`, the paired hashes match the embedded table exactly; the separate index locates those same hashes under refs `PRIVATE_EVIDENCE_REF_0130` and `PRIVATE_EVIDENCE_REF_0131` respectively.

All 89 embedded numeric labels have a different digest at the same label in the standalone 141-entry index. SHA lookup finds a unique standalone target for 85 embedded digests; four are absent. The map creator record shows its 89-entry namespace was generated from sorted paths and reused consistently in the map. The creator for the separate index was unavailable in the inspected records, so the source of the namespace divergence remains unattributed.

The forecast has five explicit reference/digest occurrences whose digests are absent from the standalone index, across two distinct pairs. This is unresolved cross-namespace lookup; it does not establish that the forecast’s own pointers are invalid. The JSON retains their portable locations without guessing replacements.

The V5 crosswalk aliases appear only when their explicit digest matches. All original counts, row assignments, historical adequacy entries, map bytes, and uploaded bytes remain unchanged.
