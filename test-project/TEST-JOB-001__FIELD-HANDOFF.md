# Portable Generator Service Handoff

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

## Release record
Status: ACCEPTED

Evidence:
- Service actions recorded.
- Functional start/stop check recorded.
- Leak inspection recorded.
- No unresolved safety-critical blocker remains in the final verified handoff.
