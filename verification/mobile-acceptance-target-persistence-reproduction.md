# Reproduction

1. Open Stage 30.
2. Paste a valid pinned mobile acceptance target.
3. Click Run MOBILE_CAPABILITY_PROBE.
4. The handler stores `acceptanceSession.target` and calls `render()`.
5. `mobileAcceptanceMarkup()` recreates `#mobile-acceptance-target-json` with no value, so the visible target is empty.
6. `recordMobileAcceptanceReceipt()` and `recordMobileAcceptanceMeasurements()` parse that now-empty textarea instead of using the stored target, so the next required action fails before any receipt or measurement can be recorded.

Fixed oracle: rerender must preserve/display the exact session target, and post-probe actions must consume the session-bound target rather than ephemeral textarea state.
