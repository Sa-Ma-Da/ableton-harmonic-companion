---
description: Post-build regression validation workflow
---

# Regression-First Validation Workflow

This workflow enforces the regression-first development contract.

## After Every Code Change

// turbo-all

1. Run the full regression suite:
```bash
npm test
```

2. If tests pass, run the regression gate for detailed component validation:
```bash
npm run test:gate
```

3. If the gate reports **BUILD ACCEPTED** → changes are safe to commit.

4. If the gate reports **BUILD REJECTED**:
   - Read the output to identify the failing component and affected files
   - Isolate the newly introduced logic in those files
   - Rewrite the affected module to restore baseline behavior
   - Re-run `npm run test:gate`
   - Repeat until **BUILD ACCEPTED**

## Available Commands

| Command | Purpose |
|---|---|
| `npm test` | Run all test suites |
| `npm run test:contract` | Run only the 9-item functional contract |
| `npm run test:gate` | Run regression gate with component analysis |
| `npm start` | Launch Electron app for manual verification |
