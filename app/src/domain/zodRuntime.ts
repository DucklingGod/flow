import { z } from 'zod'

// Zod v4 probes for JIT support with `Function('')`. The hosted Content-Security-
// Policy has no `'unsafe-eval'`, so that probe is always blocked: Zod catches the
// error and falls back to interpreted validation, which is correct but reports a
// `script-src` violation on every load of a route that parses a schema.
//
// Declaring `jitless` up front skips a probe that can never succeed under our
// CSP. Behaviour is unchanged — this is the path the app already took — but the
// violation report and its console noise go away, and validation performance
// becomes the same locally and in production instead of silently differing.
//
// Import this before any schema module so the setting is in place first.
z.config({ jitless: true })

export {}
