# DayZ AIO v0.2.14 - DayZ CE Validation Fix

## Problem

Vanilla and modded DayZ Central Economy files can contain entries where `min > nominal`, especially for infected (`ZmbF_*`, `ZmbM_*`), event-driven economy, animals, mushrooms, and other special CE patterns.

Earlier AIO builds treated this as a hard validation failure. That incorrectly blocked Server Readiness and Economy Save on valid real-world `types.xml` files.

## Changes

- `min > nominal` is now a **warning**, not an error.
- Server Readiness no longer blocks on these vanilla DayZ CE patterns.
- Economy Save only hard-blocks true destructive issues such as malformed XML, duplicate names, impossible quant ranges, invalid numbers, and unsupported negative values.
- Validation responses now include:
  - `errors[]`
  - `warnings[]`
  - `issues[]`
  - `summary.grouped[]`
- Readiness and Economy UI now display grouped validation summaries instead of hundreds of repeated lines.
- Economy table rows with `min > nominal` are highlighted as warnings, not danger/fail rows.

## Validation policy

Hard fail:

- XML parse failure
- duplicate type/event/global names
- missing names
- `quantmin > quantmax`
- invalid numeric values
- negative values where DayZ CE does not allow them

Warning:

- `min > nominal`
- event `nominal > max`
- unusual globals type values

## Expected result

A real vanilla/modded `types.xml` with many zombie entries like `ZmbF_*` / `ZmbM_*` should now show:

```text
Server Readiness: Needs attention / Warning
Fail: 0
Warn: >= 1
Blocked: no
```

