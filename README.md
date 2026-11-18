# Agent Access Index

A category-level index of how retail and commerce sites treat AI agents. Logged-out weekly check of public policy files, n=83 sites from the NRF Top 100 Retailers 2026, checked 4 dates, Oct 31 to Nov 16, 2026.

**Finding:** 83% of top US retailers (69 of 83) publish no AI-agent rules. 35% (29 of 83) refused our labeled agent.

Dashboard: https://aidvalor.github.io/agent-access-index-site/

**Agent Shelf:** when an AI assistant with web search answered 20 headphone-shopping prompts (Nov 16–18, 2026; 58 of 60 calls), store pages got 18.3% of the cited links (116 of 634) and review and media sites got 57.6%. Stores are shown by type only; brands in aggregate only. The dashboard replays one recorded answer, link by link. It is a recording: the page calls no model and loads nothing from other sites.

Full site-level report: [request access](https://docs.google.com/forms/d/e/1FAIpQLScYukIjtdoUHKAbPR_PF6Rcn-_-QXFUb2s7fFT-fSTxp5CREQ/viewform?usp=header)

Related: [DNR Agent](https://github.com/aIdvalor/dnr-agent) — governed “delivered but not received” resolution agent (synthetic evals). Live demo: https://aidvalor.github.io/dnr-agent/demo/

Tests (local, no network): `cd tests && npm install && npm test` serves the site, drives every control, and fails on any non-local request or CSP violation.
