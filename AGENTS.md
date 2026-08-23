# Overview

Chef Hat turns an image + an audio track into a video, normalising the audio's
loudness with ffmpeg's `loudnorm` filter along the way. It's a pnpm monorepo split
into `packages/*` (the deployables: the Next.js app, the GraphQL api, and three
lambdas — `image-processor`, `audio-processor`, `media-convert-service`) and
`lib/*` (shared code: `s3`, `lambda`, `step-functions` types, `ts-result`,
`local-runner`, `ts-config`). See `README.md` for the full pipeline.

# Code Style

## General

- Prefer multiple focused files over monolithic ones — one export per file,
  filename matching the export (e.g. `normaliseAudio.ts` exports `normaliseAudio`).
- Shared logic goes in `lib/*` and is imported via the `@chef-hat/*` workspace
  packages, not copy-pasted between the `image-processor` / `audio-processor` /
  `media-convert-service` lambdas.
- Format/lint with biome (`pnpm tidy` to fix, `pnpm check` to verify) — tabs,
  single quotes.

## TypeScript

- Prefer arrow functions for all function definitions.
- Errors are values, not exceptions: functions that can fail return
  `Result<T>` from `@chef-hat/ts-result` (checked with `isFailure`, unwrapped
  with `getValueOrThrow`) rather than throwing. Lambda handlers follow the same
  shape at their boundary, returning `S3ObjectState | ErrorState` on top of the
  usual promise/callback wrapping ffmpeg needs.
- Cross-step data passed through Step Functions (bucket/key pairs, error state)
  is typed once in `lib/step-functions` and reused by every lambda, rather than
  redeclared per package.
- `type` over `interface` for plain data shapes.
