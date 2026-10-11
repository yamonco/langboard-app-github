# GitHub panel

## Optional workflow declaration

Generate a separately reviewed workflow profile with
`node server.mjs --manifest --workflow-cards`; add `--interactions` to declare
optional PR choice requests. The default manifest and `/manifest.json` remain
read-only. The workflow profile uses schema v2, explicit issue/PR lifecycle
policies and a data trust origin matching `PUBLIC_URL`. Instance approval,
connection/resource onboarding and board capability grants are still required.
Declaration does not start the receiver, create cards, enable archive sync or
merge a PR. Archive synchronization and PR choices each require their own opt-in.

## Optional workflow card adapters (not connected to the signal panel)

`archive.mjs` exports explicit issue/PR lifecycle policies and a server-side issue
closure handler. It reads the current issue, closes once using the official GitHub
API, then verifies the same issue is closed. Already closed is idempotent; a lost
write response is unknown and is never automatically retried. PR resources are
rejected by the issue handler. No provider credentials reach the browser.

`interactions.mjs` declares a disabled-by-default PR decision (merge, close without
merging, hold) and builds a native choice-card request only after explicit opt-in.
It does not execute the answer or grant repository permission. PR mutation still
requires a separate authenticated adapter with current head/check fences.

These modules do not run from inbox ingestion or public static routes.
`archive-receiver.mjs` now provides a server-side receiver and `panelServer(config,
{ receiveArchive })` optionally exposes `POST /events/archive`. The default CLI
does not enable this endpoint. Before enabling it, supply an approved webhook
secret, an `archiveStore` backed by a durable local file, a configured
`archiveHost` with the owning connection credential, and a trusted `resolveIssue`
mapping that explicitly enables each board/connection/issue. Event URLs are never
used for credential routing. The receiver verifies exact signed bytes, checks the
current host receipt, persists the claim before GitHub access and stores the exact
outcome report. Duplicate deliveries reuse that report without another provider
write. A claim without a report remains unresolved and requires operator
reconciliation; it never causes an automatic repeat mutation. Node's built-in
SQLite is used only for this standalone app's local operation ledger; it does
not select or change Langboard's database backend. Use Node 22.13 or newer for
this optional adapter; SQLite remains experimental in Node 22.

Instance declaration approval, connection/resource onboarding, deployment
configuration and real-provider acceptance remain pending. Existing panel permissions
do not authorize mutations. Restoring an archived card does not reopen an issue.

Standalone third party Langboard panel service. Node 22.13 or newer; no core checkout, React installation, copied theme, or browser provider credentials. The vendored npm SDK package version 0.2.3, including its signal request channel, provides the browser bridge. The separate vendored @langboard/app-server 0.1.2 provides server-only archive processing and is never exposed as a browser asset.

```sh
npm ci
HOST_ORIGIN=https://board.example PUBLIC_URL=https://panel.example PORT=8780 npm start
HOST_ORIGIN=https://board.example PUBLIC_URL=https://panel.example npm run manifest --silent > manifest.json
npm test
```

`HOST_ORIGIN` is the exact approved host origin. `PUBLIC_URL` is the deployed HTTPS panel origin; HTTPS termination may be handled by a reverse proxy. `HOST` defaults to loopback; set `HOST=0.0.0.0` in a container. `PORT` defaults to 8780. Local development defaults to host `http://127.0.0.1:5173` and declaration URL `https://panel.example`; configure a real public URL before approval. The manifest is also available at `/manifest.json`. The default CLI serves no provider credentials or authenticated API endpoints.

Register the generated external declaration (`github-panel`) for instance approval, then grant board panel rendering and explicitly check the separate signal read consent checkbox. Rendering consent alone cannot read signals. This companion panel requires an existing authorized provider connection, eligible board resource bindings and the native provider read/resource grants, in addition to the external panel read consent. External panel consent never creates provider authority. Provider onboarding remains a host responsibility. The host must support `session.request('signals.list', {provider: 'github', after?: cursor})` and supply its actual React, Button, Badge, Input and mount widget exports. The SDK imports from `/sdk/index.mjs`; the server exposes the installed package file with public module CORS for an opaque iframe. Host styling and theme follow automatically through the SDK.

GitHub shows checks and commit statuses from authorized inbox records, with text and status filters, manual refresh, and cursor pagination. It requests on opening and on explicit actions; there is no polling. Disposable search/status filters use session state. Abort cleanup releases the mounted React tree; SDK request timeout and disposal cancel pending work. Inbox semantics exclude signals already linked to visible cards and may return empty pages with a next cursor. Times retain source values and observation/event basis; they are evidence timestamps, not an assertion of current provider state.

Unsupported mutations: PR merge, deployment execution, issue resolution, card creation and provider configuration. No pull request API is available; this panel displays inbox evidence only. It sends no synthetic GlitchTip events. Read authorization, provider ingestion, real deployed host integration, light/dark behavior and browser lifecycle acceptance must be verified in the target deployment; Node checks validate service routes, headers, SDK availability, declarations and request/filter/pagination/abort contracts, and do not establish browser or production proof.

Public static assets permit CORS `*` without credentials. CSP frame ancestors is limited to the configured host. Exact route allowlisting excludes arbitrary files. Deploy this repository independently with its package tarball and lockfile; run `npm ci` before starting.

Local browser verification used the real compiled host widget module and opaque iframe lifecycle with disposable sample inbox records. It confirmed dark theme changes, filters, and denial clearing prior data; it did not exercise a deployed account or real provider ingestion.

Panel declaration 0.1.1 explicitly limits signal_sources to github. Approve the newer declaration and review board signal consent again on SDK 0.2.20 hosts. The declaration neither grants provider account access nor installs an adapter. Inbox state remains independent from app-owned cards and HITL.


## Serving an optional workflow declaration

The default HTTP `/manifest.json` and `--manifest` output remain the read-only
signal inbox profile. Use `--workflow-cards` for both generation and service
startup when offering app-owned workflow cards:

```sh
npm run manifest --silent -- --workflow-cards > workflow-manifest.json
npm start -- --workflow-cards
```

Programmatic callers use `panelServer(config, { workflowCards: true })`. The
HTTP declaration is generated at startup from that same explicit profile.
These flags offer capabilities for approval; they do not register an app,
create a card, grant consent, connect a provider or activate external actions.

GitHub may additionally use `--interactions` together with `--workflow-cards`
for both generation and startup. The PR interaction declaration remains
optional and disabled by default; declaring choices does not execute them.

## Explicit external check reads

`provider-api.mjs` reads the configured repository metadata first and verifies its
immutable numeric ID and full name before requesting a specific check run. It
uses GET only, an exact server-configured HTTPS API origin, an explicit API
version (default `2022-11-28` for existing compatibility), no redirects and a
15-second deadline. Each decoded response is limited to 1 MiB. See the official
[Checks API](https://docs.github.com/en/rest/checks/runs).

`observeCheck` in `signals.mjs` requires a trusted current board/resource mapping,
server credentials and an awaited durable `saveEnvelope` callback. Only completed
checks with finite conclusions, an explicit completed timestamp and a full commit
SHA are normalized. Output text, annotations, URLs and diagnostics do not leave
the provider. Neutral/skipped/stale/action-required/timed-out conclusions are
preserved and mapped to unknown rather than inferred success or approval.
The exact envelope is saved before signed submission; an unknown result is
reconciled with that same envelope, never an automatic provider re-read or retry.
This event identity differs from a webhook delivery ID; existing native webhook
histories are retained and never silently re-keyed or deduplicated into it.

`--publish-signals` independently offers schema 2 app version 0.2.1. It requests
signal publication consent but no card creation unless `--workflow-cards` is also
selected. The panel selects `github` or `github-panel` with separate SDK-owned
source lifetimes. SDK packages are pinned at panel 0.2.3 and server 0.1.2.
The flag offers a contract, not a running worker, credentials or consent.

Tests exercise local HTTP and provider/host doubles. Actual GitHub credentials,
native persistence readback, webhook ingress migration, durable service deployment
and browser acceptance remain gates before any host provider path can be removed.

Signal publication requires a native signal_uid and boolean duplicate receipt.
An HTTP success without that receipt is an unknown outcome; preserve the saved
envelope and reconcile before explicit replay. No automatic retry is performed.

## Durable one-shot observation CLI

Run `node observation.mjs observe CONFIG FILE` for one explicitly configured
resource. CONFIG includes exact HTTPS `hostOrigin`, `providerOrigin` and the
`scope` fields required by the provider reader plus `boardUID`, `resourceUID`,
`appRevision` and `bindingRevision`. Server credentials are environment-only:
`LANGBOARD_APP_TOKEN` and `GITHUB_READ_TOKEN`. No polling is started.

The SDK 0.1.3 store exclusively creates an owner-only, size-limited FILE and
syncs it before publication. `node observation.mjs resend CONFIG FILE` loads
the same batch without reading the provider. It rejects changed host/provider
origins or mapping revisions and stops at the first rejected/unknown receipt.
Partial batches replay accepted event identities for native deduplication.
Keep the file until native readback resolves all receipts; never replace an
unknown event with a new observation. CLI output contains receipt IDs only.
Local tests establish this recovery boundary, not live provider or deployment
acceptance.
