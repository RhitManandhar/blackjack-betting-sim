## What and why

<!-- One or two sentences. Name the roadmap phase. -->

Phase:
Spec sections: <!-- e.g. docs/spec.md §4.3, §7.3 -->

## Checklist

- [ ] Tests added or updated (table-driven for rules, strategy transitions and statistics; no snapshots of random output)
- [ ] Spec section referenced above; `docs/spec.md` updated with a version bump and changelog entry if behaviour changed
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass locally
- [ ] Money stays in integer cents; no floating-point money
- [ ] No `Math.random()`, clock or browser APIs in `src/engine` or `src/shared`
- [ ] No wording that presents a betting system as winning, guaranteed or beating the house
- [ ] `CLAUDE.md` updated if commands, structure or rules changed
