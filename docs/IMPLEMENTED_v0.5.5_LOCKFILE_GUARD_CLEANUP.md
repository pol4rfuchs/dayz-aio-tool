# v0.5.5 Lockfile Guard Cleanup

## Purpose

Remove the hardcoded `lucide-react` dependency-resolution assertion from the pnpm lockfile guard.

The v0.5.4 guard correctly detects the actual failure class: a project release version accidentally written into a dependency `version:` field in `pnpm-lock.yaml`. The additional exact `lucide-react@0.475.0(react@19.2.7)` assertion was too narrow and would fail on a legitimate future dependency update.

## Changes

- Kept the generic project-version-as-dependency-version detection.
- Removed the hardcoded lucide-react resolution regex.
- Kept package-lock rejection.
- Kept missing pnpm-lock rejection.
- Kept workflow integration through `pnpm run check:lockfile`.

## Expected result

CI still catches version-bump lockfile corruption, but no longer blocks valid dependency bumps for `lucide-react` or React.
