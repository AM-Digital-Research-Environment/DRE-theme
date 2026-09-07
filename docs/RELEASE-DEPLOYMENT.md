# Release deployment and generated data

Release archives contain code and static inputs. Visualization generations are
server-owned data and must survive replacement of the module directory.

Before replacing DreVisualizations, back up its complete `asset/data` directory
outside the module directory. Preserve `current.json` together with the complete
`generations` tree it references. Never restore only the pointer. A persistent
volume is preferable for repeated deployments, but mount it without hiding the
release's static geography and word-cloud inputs. Keep these static inputs
updated from the release.

After installing the release, restore the saved generated files with the same
web-server ownership and access rules. Do not overwrite newer static inputs with
older copies. Run **Admin → Modules → DRE Visualizations → Regenerate now** when
the release changes data definitions. Wait for the job to succeed; clicking the
button alone does not establish readiness. Keep the previous complete published
generation available while the atomic publisher builds its replacement.

From the theme checkout (Node.js installed), run:

```sh
node scripts/check-live-snapshot.mjs
npm run test:live -- --retries=0
```

Set `LIVE_BASE_URL` to validate another installation. Both commands are read-only;
the first exits nonzero for a missing pointer, missing required artifact, malformed
JSON, or empty overview/network. A deployment job should require both commands to
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
item sets; their four title-to-ID mappings expire after 24 hours. Renaming an item
set can therefore take up to a day to affect that fallback (plus the one-hour
count cache). It is not the shared-profile deployment's count source.

The live server's replacement/mount mechanism is not accessible from this
checkout. This procedure and executable gate are ready; applying persistence to
the actual server remains an operator step.
