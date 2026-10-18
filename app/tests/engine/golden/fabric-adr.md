# Architecture Decision Record

## Northwind AG · Microsoft Fabric · 2026-10-18

_Pack release 2026.10.18 · prepared with Sylwester Lachiewicz_

## Executive summary

2 of 2 topics were decided, 0 left open and 0 parked. The platform uses Bronze, Silver, Gold, isolated by not yet decided, with not yet decided. 1 decision departs from the suggested default: Semantic model storage mode.

## Decisions

### Medallion layers

**Decision:** Bronze, Silver, Gold

- Central landing zone: On

**Context:** Bronze, Silver and Gold were chosen. Bronze keeps each source as it arrived, so any later layer can be rebuilt from it. Silver holds cleaned, deduplicated and conformed tables, so data-quality rules live in one place and can be rerun. Gold holds the business-ready facts and dimensions that semantic models read. Each layer maps onto its own lakehouse or warehouse, in line with Microsoft's medallion guidance for OneLake.

A central landing zone was added next to Bronze. Mirrored databases and shortcut sources land there once, and each environment reads them through OneLake shortcuts instead of ingesting its own copy. Sources loaded by copy still go straight into Bronze.

**Alternatives considered:** Raw and Serving; Bronze, Silver, Gold, Mart

### Semantic model storage mode

**Decision:** Direct Lake on SQL endpoint

**Context:** Direct Lake on SQL endpoint was chosen over Direct Lake on OneLake because existing access rules live on the SQL analytics endpoint and some model tables are SQL views. Queries that touch those will fall back to DirectQuery, which is accepted for this workload. This departs from the suggested default (Direct Lake on OneLake). Reason recorded: Existing row-level rules live on the SQL analytics endpoint.

**Alternatives considered:** Direct Lake on OneLake; Import; DirectQuery; Decide per model

**Notes:** Existing row-level rules live on the SQL analytics endpoint

## Appendix: sources

- [Understand medallion architecture for Fabric with OneLake](https://learn.microsoft.com/fabric/onelake/onelake-medallion-lakehouse-architecture)
- [Microsoft OneLake patterns and foundational capabilities](https://learn.microsoft.com/fabric/onelake/architecture-patterns)
- [Direct Lake overview](https://learn.microsoft.com/fabric/fundamentals/direct-lake-overview)
- [How Direct Lake works](https://learn.microsoft.com/fabric/fundamentals/direct-lake-how-it-works)
