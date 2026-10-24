# Preserved independent review

Reviewed candidate: `5e587742daaabf265ae284d3733d571d9f7e293e`.
Disposition: ACCEPT for the verifier-only scope described in the unchanged review JSON.
These original artifacts do not establish overall application or deployment acceptance.
The author record's historical pending-review label remains unchanged; the separate review supplies the later decision.

## Reproduce the independent controls

Use a disposable checkout at the reviewed candidate, with Node 22.23.3. Copy the preserved scripts to that checkout's root (their relative imports intentionally target root test helpers):

- `clrt-confirmation-independent-control.mjs` as `independent-confirmation-review.mjs`
- `clrt-confirmation-independent-recovery-control.mjs` as `independent-recovery-review.mjs`

Run `node independent-confirmation-review.mjs` and `node independent-recovery-review.mjs` from that root. The original six execution commands, results, log hashes, scope and limitations are in `clrt-confirmation-independent-review.json`. Original logs and scripts are retained here byte-for-byte. References to `/workspace/shared/` in that historical record identify the original execution paths; matching artifact basenames are preserved in this directory. Reexecution against any later changed source constitutes new evidence and must retain its actual source binding.
