# Codex Token-Optimization Plan

## Finding

The long-running project session has grown to roughly 77–81 MB, while recent separate sessions are generally below 1.4 MB. The main causes are repeated one-word continuation turns, full test logs, repeated repository-wide searches, screenshots, and reloading project history that has already been settled.

## Working protocol

1. Use one fresh Codex thread per tested milestone or bug.
2. Begin a new thread with the current objective, affected screen, and latest commit instead of copying the full conversation.
3. Group related interface changes into one request. Avoid repeated `next` turns when the intended milestone can be named directly.
4. Inspect only the affected files and their direct tests. Use `rg` with narrow paths before opening files.
5. Run focused tests while implementing. Run full backend/frontend verification only once before committing.
6. Return only the test summary and failures; suppress routine passing-test output.
7. Do not reopen full roadmap, contracts, or design documents unless the change affects them.
8. Use browser control, web search, PDFs, and screenshots only when local code and logs cannot answer the question.
9. Commit each complete tested milestone. Start the next milestone from that clean commit.
10. Use normal/medium reasoning for routine UI, tests, documentation, and small fixes. Reserve high reasoning for authentication, database transactions, concurrency, RBAC, and security reviews.

## Compact verification commands

During implementation, run only the relevant test files. Before a milestone commit, run:

```powershell
cd backend
npm test

cd ../frontend
npm test
npm run lint
npm run build
```

Tool output should be capped or summarized to the final pass/fail counts while preserving the process exit code.

## Current checkpoint

- Latest pushed commit: `041e8bf` (`fix(department): prevent blank portal after password change`).
- One tested milestone is currently uncommitted: live Department Account service monitoring and immediate capped credit at Time-Out.
- Verification already completed for that milestone:
  - Backend: 109 tests passed.
  - Frontend: 87 tests passed.
  - Frontend lint passed.
  - Frontend production build passed.
- Next action: review the current diff, commit it as one milestone, push it, then test the live Department Account workflow.

## Template for a new thread

```text
Project: STI Vio-Log
Latest commit: <commit>
Milestone: <one concrete outcome>
Affected area: <screen/API>
Required verification: focused tests, then full tests once
Rules: preserve RBAC, audit history, department isolation, and existing user data
```
