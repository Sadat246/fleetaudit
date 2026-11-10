# FleetAudit

Driver qualification (DQ) file compliance for motor carriers, under 49 CFR Part 391.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # compliance rule tests
npm run typecheck
npm run lint
```

## Layout

- `src/lib/engine/` — the compliance rules. Pure functions, no database or network. Every rule has tests.
- `src/app/` — the Next.js web app.

The AI only suggests values read from documents. A person confirms them, and the engine decides compliance.
