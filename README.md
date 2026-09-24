# Career Radar

A self-hosted job-search workbench that aggregates US tech postings directly from employers' official applicant-tracking-system (ATS) APIs, enriches each posting with seniority and visa-sponsorship signals, and pairs the search with an ATS-friendly resume builder.

[中文说明](README.zh-CN.md) · [Engineering notes (Chinese)](docs/engineering-notes.zh-CN.md)

**Stack:** TypeScript · React 19 (Server Components via vinext / Vite) · Cloudflare Workers · D1 (SQLite) · Drizzle migrations · Tailwind CSS 4 · shadcn/ui

---

## Motivation

Aggregator job boards re-post listings late, duplicate them across sites, and bury the details that decide whether an application is worth sending. Career Radar goes to the source instead. It polls 603 employers' own career systems, deduplicates by official posting ID, and makes two questions answerable with a single filter: *is this role open to someone at my level?* (seniority) and *does the posting rule out sponsorship?* (visa language in the description).

## Highlights

| | |
|---|---|
| **603 official sources** | 287 Workday tenants; the Amazon, Microsoft, Google and Apple career sites; and 312 hosted boards on Greenhouse, Ashby, Lever and SmartRecruiters. About 145k active US postings after a full refresh. |
| **Resumable incremental sync** | Paginated connectors with lease-based locking, persisted cursors and duplicate-page fingerprinting. A full refresh (~5,600 upstream requests) finishes in about 12 minutes at concurrency 8. |
| **Signal extraction with evidence** | Rule-based classifiers derive seniority from titles and a visa verdict from descriptions, and store the exact sentence behind every verdict so it can be checked at a glance. |
| **Faceted search on D1** | Locations normalized into states, 40 metro areas and 294 cities. List queries return in 18–30 ms over ~137k rows. |
| **Resume workbench** | Structured resume model, three single-column templates, PDF export through print CSS, and DOCX generated from hand-written OOXML with an in-house ZIP/CRC32 encoder, because the Workers runtime has no packaging libraries. |

## Architecture

```
Browser (React client)
  │  refresh loop: 8 sources in parallel, resumes interrupted runs
  ▼
/api/sync ──► connectors ──► Workday · Greenhouse · Ashby · Lever · SmartRecruiters
  │                          Amazon · Microsoft · Google
  │   ├─ normalize → classify role and seniority → parse location → extract visa signal
  │   ├─ on-demand detail fetch when the list payload has no description
  │   └─ idempotent upsert keyed by (source, official posting ID)
  ▼
Cloudflare D1 (SQLite) ◄── /api/jobs      rows + count, two queries per request
                       ◄── /api/overview  facets and source status, cached 45 s
```

### Ingestion pipeline

- **Source registry.** Workday tenants were discovered through each tenant's `robots.txt` and verified against its CXS API. Hosted boards were matched by company name against each platform's public API (`scripts/make-registry.mjs`). Each company keeps one source, and a company-hosted system wins over a hosted board, so postings are not collected twice.
- **Connectors.** One adapter per platform (`lib/connectors.ts`) maps postings into a common shape. After the first ingestion, Greenhouse switches to a lightweight list (743 KB instead of 9.4 MB with content) and back-fills descriptions lazily.
- **Run control.** Each `/api/sync` call holds a 120-second lease on its source, fetches up to six pages within a 20-second budget, and saves a cursor. A closed tab or a timeout resumes where it stopped. If a source returns the same page twice, the run aborts instead of silently truncating.
- **Posting lifecycle.** Postings that are missing from a *complete* run are soft-deleted ("removed at source") and keep the user's marks. A run that hits an upstream cap (Workday 2,000 results, Amazon 10,000) is flagged partial and deactivates nothing.
- **Rate-limit etiquette.** Upstream 403, 429 and 5xx responses are retried using `Retry-After` or exponential backoff. Description enrichment always yields to pagination:
  - it never retries a 429 and runs at lower concurrency;
  - any 429, whether on a list page or a detail request, starts a one-minute cooldown for that site cluster.

  Workday clusters are keyed by `wdN` host, because 241 of the 287 tenants share `wd1` and `wd5`. The cooldown stops one employer's enrichment from rate-limiting another employer's listing.

### Seniority and visa signals

Implemented in `lib/job-signals.ts`.

- **Seniority, from the title:** Intern · Entry / New grad · Mid · Senior+ · Unspecified. The classifier handles level suffixes (`Engineer II`, `SDE III`) and program titles (*Rotational Program*, *Early Career*). It also treats titles that look like levels but are not, such as *Member of Technical Staff* or *Product Manager*, as unspecified.
- **Visa, from the description:** Clearance required · US citizen / permanent resident only · No sponsorship · Sponsorship available · Not mentioned. When several apply, the stricter verdict wins.
- **Precision over recall.** A wrong "senior" or "restricted" label hides a posting the user will never see, while a miss only costs one extra row. So ambiguous text resolves to *unspecified* or *not mentioned*, and exclusion filters keep rows whose signals have not been computed yet. False positives the rules already avoid:
  - clearance listed as *nice to have*;
  - the *Employee Polygraph Protection Act*;
  - *project sponsors* and *company-sponsored 401(k)*;
  - *deemed export control license*, which means the employer obtains the license on the candidate's behalf.
- **Evaluation harness.** `scripts/eval-signals.mjs` replays the rules over a database snapshot. It prints the class distribution, samples de-duplicated evidence for each class, and lists likely misses. Across ~30k postings with descriptions, it found 3,529 no-sponsorship, 3,346 citizenship-restricted, 967 clearance-required and 598 sponsorship-available postings. Manual review of the samples found no false positives.

### Query layer

D1 runs the statements inside one request serially, so the list endpoint issues exactly two queries (rows and count), and all facet aggregation lives in a separately cached endpoint. Measured on ~137k rows:

- page load: 1,131 ms → 18 ms
- region switch: 1,511 ms → 30 ms
- keyword search: 1,210 ms → 172 ms

A single-query variant using `count(*) OVER ()` was slower (639 ms), because the window function scans every matching row to compute the total.

## Results

Filter funnel after a full refresh on 2026-09-23:

| Filter | Postings |
|---|---:|
| All active US postings | 144,553 |
| Classified roles (drops the retail and food-service "Other" bucket) | 45,929 |
| + exclude Senior+ | 21,739 |
| + exclude visa-restricted | 16,588 |
| + full-time only | 15,287 |

## Getting started

Requires Node.js 22.13 or later.

```bash
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

Open the local URL that the dev server prints. The first visit refreshes every source that has not updated in the last six hours; an interrupted refresh resumes on the next page load. Local data is stored in `.wrangler/state`, which is git-ignored.

## Testing

| Command | Scope |
|---|---|
| `npm test` | 34 unit tests: connectors and normalization, location parsing, update scopes, resume rendering / DOCX / ZIP, and seniority and visa rules with fixtures taken from real postings |
| `npx tsc --noEmit` | Type check |
| `powershell -File tests/integration.ps1` | Runs against a live dev server: idempotent re-sync, description preservation, mark persistence, region and category filters, signal completeness, and a check that the visa classes partition the result set |
| `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/collect-live.mjs` | Live fetch of every registered source |
| `node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/eval-signals.mjs <sqlite copy>` | Evaluates the signal rules over a whole database |

## Project structure

```
app/
  page.tsx                job radar UI
  resume/                 resume workbench and print view
  api/                    route handlers: jobs, overview, sync, resumes
lib/
  connectors.ts           platform adapters, retry and cooldown, detail enrichment
  sources.ts              source registry, role classifier, normalization
  job-signals.ts          seniority and visa rules
  job-query.ts            filters → SQL
  us-locations.ts         state / metro / city parser
  resume-*.ts, zip.ts     resume model, renderer, importers, DOCX and ZIP writers
db/schema.ts, drizzle/    schema and migrations
scripts/                  registry discovery, live checks, rule evaluation
tests/                    unit and integration tests
docs/                     engineering notes
```

## Scope and limitations

- **Coverage.** The source list is not exhaustive. iCIMS, Oracle, SuccessFactors and Eightfold have no stable public API and are not integrated, and a company whose board slug differs from its name can be missed during discovery.
- **Apple.** `jobs.apple.com` rejects non-browser TLS fingerprints coming from the Workers runtime, so the source is shown as unavailable. The project does not spoof fingerprints.
- **Signals are heuristics.** A visa label reflects the wording of a posting, not the employer's actual policy or any applicant's eligibility. Years-of-experience requirements are not parsed yet.
- **Enrichment coverage.** On list-only platforms, descriptions are fetched only for classified, non-senior postings. After one full refresh, Workday coverage of that set was 50%, and it grows with each later refresh.
- **Single user.** The database is a personal workspace with no per-user isolation.
- **No automated applications.** The app links to the official posting. It never submits an application and never counts a click as one.

## Responsible data use

All data comes from employers' public career endpoints, the same JSON their own career pages load. The project does not access authenticated, paywalled or login-gated content. Requests honor `Retry-After`, back off on errors, and throttle enrichment whenever an upstream starts rate limiting.

## Roadmap

- LLM-based fit scoring against the structured resume, applied only to the filtered candidate set
- Application pipeline states (applied → assessment → interview → offer), with the resume version used for each application
- Years-of-experience extraction from job descriptions
