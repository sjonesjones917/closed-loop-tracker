# Invalid acceptance fixture — portable generator handoff

This file is intentionally invalid test evidence for Stage 07. It is not a finished product and is not authorized for release.

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

## Deliberately invalid release record
Status: ACCEPTED

Known defects intentionally present:
- The unit identifier is missing from the handoff body.
- The service date is missing.
- Acceptance is asserted without preserved evidence establishing every mandatory release fact.

Expected validator response: **REJECT / VIOLATED**.