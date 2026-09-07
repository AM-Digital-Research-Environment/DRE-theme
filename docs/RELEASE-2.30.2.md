# DRE theme 2.30.2

This release packages the reviewed reliability, accessibility and layout improvements.

- Simplify interior mastheads: the site title wraps without truncation and gives the page heading priority.
- Bound editorial paragraph and list width for easier reading.
- Keep cached collection labels independent of the visitor's language.
- Use DRESearch 1.21.0 public corpus definitions for homepage totals, with explicit public site scope and standalone fallbacks.
- Strengthen live smoke readiness checks and retain failed requests, screenshots and traces.

## Upgrade

Install **DRE-theme.zip**, **DRESearch.zip 1.21.0**, and **DreVisualizations.zip 2.28.3** from their release assets. Install the complete Search module package, including Composer vendor files and all hashed JavaScript/CSS chunks. Preserve Visualizations asset/data when replacing module code, then run **Regenerate now**. Theme statistics refresh within one hour.

The coordinated module releases add compact mobile search controls, substantially smaller header assets, stale-autocomplete protection, visible dashboard recovery states, and consistent corpus membership rules. New release versions change public asset URLs to invalidate older cached bundles.

## Validation

All 18 live smoke tests passed after snapshot regeneration. The released frontend changes were also checked in local compiled fixtures at mobile and desktop widths. Local lint/build, frontend/PHP regression tests and static analysis passed for the implementation; GitHub release workflows additionally validate installable archive structure.
