# MVP v0.1

## Goal

Build the first safe DayZ server control-plane foundation.

## Non-negotiable rules

- No config write without backup.
- No XML write without validation.
- No raw user path passthrough.
- No plain RCON password exposure in API responses.
- No shell command string concatenation from user input.
