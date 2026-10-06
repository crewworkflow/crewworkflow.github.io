# crewflow-pages

Static customer-facing pages for CrewFlow share links (completion pages and quote approvals). Data and files are served by the CrewFlow Supabase functions; this repo only hosts the renderer.

`ops/` is the owner-only diagnostics dashboard: it reads app-reported sync issues from the `diagnostics-ops` function and is gated by that function's admin key (never stored in this repo).
