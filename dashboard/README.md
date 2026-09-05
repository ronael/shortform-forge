# Shortform Forge Operator Dashboard

Local operator interface for reviewing rendered videos and preparing or sending
them to TikTok. It never edits or deletes source media.

## Start

```bash
pnpm dashboard:build
pnpm dashboard:start
```

The terminal prints a six-digit pairing code and the URLs for the Mac and local
network. Open the network URL on an iPhone connected to the same private
network, then enter the pairing code. The local `.env` file can set a stable
`SF_DASHBOARD_PAIRING_CODE`; it is ignored by Git. Browser sessions still expire
when the server restarts.

During development, use `pnpm dashboard:dev`. The UI runs on port `4174` and
proxies the API on port `4173`.

## Library and state

The indexer reads, but never copies, MP4 files from production/series `result`
directories and benchmark `result` or `final` directories. Review copies,
source clips, working renders, and demo output are excluded. Identical files are
deduplicated by SHA-256, preferring the durable series copy.

State is stored in `.sf-dashboard/state.json`. It contains review decisions,
captions, hashtags, non-secret account references, and publication attempts.
Approvals are keyed by checksum, so a changed render must be reviewed again.
Generated thumbnails live in `.sf-dashboard/cache/` and are capped at 200
files. The entire directory is ignored by Git and can be removed safely.

## Publication planning

The launch calendar tracks the first five French and English publications.
Each entry links to its indexed master and stores its status plus optional
TikTok, YouTube Shorts, and Instagram Reels URLs in the local dashboard state.
The two wombat entries start blocked until their mismatched footage is fixed.

The expandable general recommendations are project-independent. They document
the default cadence, audience-local timing, watermark-free export, human QA,
and the 2-hour, 24-hour, and 72-hour measurement checkpoints. Buffer is noted
as an immediate three-channel option; Postiz remains a future self-hosted API
proof of concept and is not connected automatically.

## TikTok activation

Without TikTok credentials, the dashboard supports review, caption copy, and
download to the current device. Account connection and upload remain disabled.

To activate draft uploads:

1. Register a desktop application at https://developers.tiktok.com/.
2. Add Login Kit and Content Posting API.
3. Request only `user.info.basic` and `video.upload`.
4. Register `http://127.0.0.1:4173/oauth/tiktok/callback/` as the redirect.
5. Complete TikTok's application review.
6. Set `SF_TIKTOK_CLIENT_KEY` and `SF_TIKTOK_CLIENT_SECRET` in the ignored root `.env` file, then restart the dashboard.

Start authorization from the Mac. Desktop OAuth redirects to loopback, so
connection is deliberately blocked from an iPhone. Tokens are stored in the
macOS Keychain service `shortform-forge-dashboard`; they are never written to
the repository, dashboard state, browser, or logs.

`video.upload` sends a file into TikTok's inbox. The creator must open the
notification, finish the post, and publish it manually. Captions prepared in
the dashboard are copied separately because the upload endpoint does not attach
them to the draft.

## Publication gates

- Production: technical QA pass plus explicit human approval.
- POC: promotion to candidate, technical QA pass, then human approval.
- Destination locale must match the video locale.
- A successful checksum cannot be sent twice to the same account.
- At most five pending drafts per account are permitted within 24 hours.

The dashboard does not implement scheduling, autonomous publishing, Direct
Post, analytics, hosted access, account creation, or credential sharing.

## YouTube automation preparation

The in-app YouTube guide documents the future automatic-upload setup without
pretending that the connector already exists. It covers Google Cloud project
creation, YouTube Data API v3, Google Auth test users, the minimal
`youtube.upload` scope, `videos.insert`, scheduled private uploads with
`status.publishAt`, and the YouTube compliance audit. API projects that have not
passed that audit can upload for testing, but their videos remain locked to
private visibility.

## Validation

```bash
pnpm dashboard:type-check
pnpm dashboard:test
pnpm dashboard:build
```
