# Package measurement comparison — 12 September 2026

Three-run medians, Node v24.19.0 on Linux x64. These are production encode/verification paths with export storage I/O substituted; import intentionally stops before activation. The browser worker is not exercised.

| Fixture | Export before / after | Import before / after | V8 heap at import return before / after |
|---|---:|---:|---:|
| 25 responses | 0.27 / 0.24 s | 0.24 / 0.26 s | 27.0 / 32.6 MiB |
| 600 responses | 4.29 / 4.24 s | 4.20 / 4.29 s | 399.8 / 330.1 MiB |
| 25 responses + 8 MiB binary | 2.33 / 2.10 s | 1.08 / 1.13 s | 93.2 / 75.5 MiB |

Whole-process maximum RSS: 884.7 MiB before, 617.9 MiB after. This includes all three workloads and retained diagnostic objects; it is not a per-operation or browser peak.

The large-history and binary fixtures show lower retained heap samples. Throughput is broadly similar; small-fixture heap can increase. The primary responsiveness change is moving canonical transaction computation to the browser worker, which these Node measurements do not time. No whole-app speedup, physical-iPhone capacity, p95, or unlimited-capacity claim is made.

See `packages-scope.json` for source/script identity and exact measurement limitations. Existing correctness/byte-identity tests remain mandatory.
