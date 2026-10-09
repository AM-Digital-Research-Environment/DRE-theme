# Release deployment and generated data

Release archives contain code and static inputs. Visualization generations are
server-owned data and must survive replacement of the module directory.

Since DreVisualizations 2.29.0 the published snapshot lives in private storage
outside the document root (`DRE_VISUALIZATIONS_DATA_DIR`, a durable volume set
for PHP-FPM and job workers alike) and is served only through
`/s/{site}/dre-data/current.json` and the generation it names. Replacing the
module directory no longer touches it; the upgrade from a pre-2.29 version
purges the old public `asset/data` generations itself. Unset, the store falls
back to an OS temporary directory that a host cleanup can empty.

**Every Omeka API write withdraws the publication** — item, media, item-set,
site, template or vocabulary edits, imports and sync runs alike. The site then
shows "The visualisation could not be loaded." until **Admin → DRE
Visualizations → Regenerate now** succeeds. Finish an import or edit batch, then
regenerate. Wait for the job to succeed; clicking the button alone does not
establish readiness. `GET /s/{site}/dre-data/source.json` answering 200 while
`current.json` answers 404 means the store is healthy and only withdrawn.

From the theme checkout (Node.js installed, `npx playwright install chromium`
run once), run:

```sh
npx playwright test tests/browser/visualizations.spec.mjs -g snapshot --retries=0
npm run test:live -- --retries=0
```

Set `LIVE_BASE_URL` to validate another installation. Both commands are read-only;
the first is the snapshot health gate alone (the full suite includes it too) and
fails for a missing pointer, missing required artifact, malformed JSON, or empty
overview/network. A deployment job should require both commands to
succeed before reporting success. The existing GitHub **Live-site smoke test**
workflow can also be dispatched after a manual release installation.

Install the entire DRESearch `asset/dist` tree, including its hashed chunks.
Retain previous hashed chunks during rolling deployment and use the release's
versioned entry URL to avoid immutable-cache collisions.

## Counts and refresh times

DRESearch profiles define shared public membership. The search index reflects
the last indexing run; visualization totals reflect the manifest's `createdAt`;
theme totals are cached for at most one hour. These are separate refresh clocks.
Regenerate/reindex after membership changes rather than changing labels to conceal
stale totals. Standalone theme installations use exact template labels and public
item sets (Publications is counted by its item set, like DRESearch); their five
title-to-ID mappings expire after 24 hours. Renaming an item set can therefore
take up to a day to affect that fallback (plus the one-hour count cache). It is
not the shared-profile deployment's count source. The masthead never reads the
DRE Visualizations snapshot: with DRESearch installed it would only copy the
same counts, and it is withdrawn on every write.

The live server's replacement/mount mechanism is not accessible from this
checkout. This procedure and executable gate are ready; applying persistence to
the actual server remains an operator step.
