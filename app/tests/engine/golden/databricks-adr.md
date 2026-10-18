# Architecture Decision Record

## Contoso Ltd · Databricks · 2026-10-18

_Pack release 2026.10.18_

## Executive summary

2 of 2 topics were decided, 0 left open and 0 parked. The platform uses Bronze, Silver, Gold, Mart, isolated by not yet decided, with not yet decided. 1 decision departs from the suggested default: Medallion layers.

## Decisions

### Medallion layers

**Decision:** Bronze, Silver, Gold, Mart

- Landing volume: Off

**Context:** A fourth Mart layer was added on top of Gold. Several domains need differently shaped tables from the same conformed data, and building those in Gold would make it serve no one well. Each Mart has a named owner, and Gold remains the shared source of truth. This departs from the suggested default (Bronze, Silver, Gold). Reason recorded: Three business domains need their own shaped tables.

No landing volume was added. Every source connects directly and loads into Bronze tables. A volume can be added later, without changing Bronze, if file-based sources appear.

**Alternatives considered:** Raw and Serving; Bronze, Silver, Gold

**Notes:** Three business domains need their own shaped tables

### Semantic layer and query mode

**Decision:** Unity Catalog metric views

**Context:** Shared business metrics are defined as Unity Catalog metric views, so every tool that reads them gets the same numbers. Power BI models import from a SQL warehouse for speed, and switch to DirectQuery only where data must be current within minutes.

**Alternatives considered:** Power BI Import from a SQL warehouse; Power BI DirectQuery; Decide per model

## Appendix: sources

- [What is the medallion lakehouse architecture?](https://docs.databricks.com/aws/en/lakehouse/medallion)
- [Unity Catalog metric views](https://docs.databricks.com/aws/en/uc-semantics/metric-views)
