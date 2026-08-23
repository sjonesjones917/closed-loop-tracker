# Portable Generator Service Handoff — intentionally invalid fixture

This file is preserved as a Stage 07 negative test fixture. It must be rejected by validation and must never be treated as a finished or releasable product.

## Customer request
Return the portable generator after scheduled service with a phone-readable handoff that tells the field technician what was done, what still needs attention, and whether the unit can be returned to service.

## Work completed
- Oil and filter service recorded.
- Battery terminals inspected and cleaned.
- Start/stop functional check completed.
- Exterior fuel and oil leak inspection completed.

## Required handoff checks
- Record the unit identifier and service date.
- Record each completed service action.
- Record any unresolved observation as **UNKNOWN** until evidence establishes the condition.
- If a safety-critical condition is unresolved, mark the handoff **BLOCKED** and do not state that the unit is ready for service.
- If no unresolved safety-critical condition remains, record the release decision and supporting evidence.

## Escalation
If a safety-critical condition is found or cannot be established, stop return-to-service, record the blocker, identify the missing evidence or required repair, and route the unit for authorized resolution before revalidation.

## Invalid release record
Status: ACCEPTED

Known defects intentionally preserved for validator calibration:
- Unit identifier is missing.
- Service date is missing.
- The release assertion is unsupported because mandatory handoff evidence is incomplete.
