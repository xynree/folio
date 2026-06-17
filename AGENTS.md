# AGENTS.md

Guidance for future agents and contributors working in this repository.

## Product Principles

Folio is a local-first studio workspace for personal creative practice. Preserve these product goals when making implementation decisions:

- **Interactive studio wall**: users should be able to upload work, arrange it, track it, and watch a body of output evolve over time.
- **Reference and inspiration graph**: users should be able to collect references like a personal Pinterest board, then connect references, notes, work-in-progress, and finished pieces to projects.
- **Local-first ownership**: files stay readable in `~/Documents/Folio`; metadata stays portable and inspectable in `.folio/*.json`.
- **Fast capture first**: importing work, references, and notes should stay low-friction. Do not force users to classify everything before capture.
- **Process is first-class**: sketches, references, WIP, final output, notes, revisions, gaps, and self-review all belong in the record.
- **Spatial thinking plus time**: boards show relationships in space; archive, project, and studio views show how work changes over time.
- **Gentle organization**: tags, projects, statuses, relationships, and stages should help discovery without turning Folio into a heavy task manager.
- **Personal review, not collaboration**: project review means private self-review. Do not add comments, approvals, assignments, shared cursors, collaborators, or team workflow unless the product direction changes explicitly.
- **Outside sharing only**: collaboration-adjacent affordances should be exports and folder access, such as board snapshots, contact sheets, Markdown timelines, portable project folders, and Finder actions.

## Code Quality Bar

Code in this app should be readable by humans at all times. Favor clarity over cleverness.

- Use descriptive names for variables, functions, components, hooks, and types.
- Do not use single-letter variable names except for widely understood, tiny local cases such as coordinate pairs in math-heavy code where names like `x` and `y` are clearer than alternatives.
- Prefer explicit control flow over dense chained expressions when behavior is non-trivial.
- Keep functions and components focused. Extract helpers when a block has a nameable purpose.
- Add comments only where they clarify intent, invariants, edge cases, or non-obvious platform behavior. Avoid comments that restate the code.
- Keep comments current when changing behavior.
- Preserve TypeScript types as the main documentation for data shape and contracts.
- Avoid unrelated refactors while implementing a feature.
- Keep schema changes additive and documented unless there is a deliberate migration.

## React Guidance

Follow current React best practices and the patterns already used in `src/components`.

- Prefer function components and hooks.
- Keep state as local as practical; lift state only when multiple components genuinely need it.
- Use memoized selectors/helpers for derived view data when the computation is meaningful or repeated.
- Avoid storing derived state that can be computed from `FolioData`.
- Keep event handlers explicit and named when the interaction is complex.
- Preserve accessibility basics: semantic buttons, labels, `aria-label` for icon-only controls, keyboard access, and focus behavior.
- Keep canvas interactions predictable: normal drag moves objects, Shift-drag creates edges, Pen mode draws strokes.
- Do not hide important behavior inside CSS-only interactions if it affects application state.

## Electron Guidance

Preserve the Electron security boundary.

- Renderer code must not directly access Node APIs or the filesystem.
- Main-process filesystem work belongs behind typed preload IPC methods exposed through `window.folio`.
- Keep `contextIsolation: true` and `nodeIntegration: false`.
- Validate and sanitize IPC inputs before filesystem or shell operations.
- Use the existing `folio://` protocol for local thumbnails and file access.
- Keep file operations non-destructive unless the user explicitly requests deletion. Reconciliation should preserve metadata and mark missing files rather than deleting records.
- Use atomic JSON writes for persisted metadata.

## Data And Storage

Folio currently uses split JSON metadata and readable user folders.

- `folio.json` stores archive item metadata.
- `tags.json` stores user-defined tags.
- `canvases.json` stores boards, positions, notes, references, edges, and strokes.
- `items/` and `references/` should remain understandable outside the app.
- Thumbnail files are cache artifacts and should stay regenerable.
- Board membership is currently derived from `canvas.itemIds`; do not duplicate it onto items unless query needs justify the tradeoff.
- Prefer derived renderer view models for Studio Wall, project timelines, backlinks, and search before adding new persisted indexes.

## Testing And Verification

Update tests with behavior changes.

- Every React component should have corresponding tests that exercise its visible behavior, important states, and user-facing callbacks. Do not rely only on broad integration tests when a component has meaningful local behavior.
- Extract plain TypeScript helpers for logic that can be isolated from React rendering or hooks, then cover those helpers with focused unit tests.
- Maintain more than 85% project coverage for statements, functions, and lines. Use `npm run test:coverage` to verify the enforced thresholds.
- Use focused tests for user-facing workflows, especially import, board, canvas, relationship, and persistence behavior.
- Add model/helper tests when changing pure data logic.
- Run `npm test` and `npm run lint` before considering feature work complete.
- `npm run package` is the practical production build check for this project.
- A raw `npx tsc --noEmit` may fail with the current TypeScript/dependency version mix because newer dependency `.d.ts` files can outpace the repository TypeScript version. Do not treat that failure as app-code failure unless the errors point into this repo.

## Documentation

Keep product and architecture docs aligned with shipped behavior.

- Update `docs/folio-mvp-plan.md` when checklist items change from planned to complete.
- Update `docs/folio-architecture.md` when data shape, process boundaries, or long-term direction changes.
- Update `README.md` when current user-facing capabilities change.
- Keep future plans clearly separated from implemented behavior.
