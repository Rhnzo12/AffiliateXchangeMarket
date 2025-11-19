# Migrating off tsconfig `baseUrl`/`paths`

This repository currently uses `baseUrl` and `paths` in `tsconfig.json`. TypeScript has marked `baseUrl` as deprecated and it will stop functioning in TS 7.0. You already have `"ignoreDeprecations": "6.0"` set to silence the warning for now.

This guide + script help you migrate imports that use `@/` and `@shared/` to relative imports so you can safely remove `baseUrl` and `paths` later.

Quick steps

1. Commit your current branch (so you can revert if needed).
2. Run the automated conversion script to update imports:

```powershell
npm run migrate:aliases
```

3. Run the TypeScript checker or start the dev server and fix any remaining import edge-cases.
4. Once satisfied, remove `baseUrl` and `paths` from `tsconfig.json` and run your type-check/build.

Notes and caveats

- The script performs a best-effort replacement for imports that start with `@/` (maps to `client/src`) and `@shared/` (maps to `shared`). It replaces module specifiers with computed relative paths. It does not add file extensions — your bundler should resolve them.
- Review the changes before committing. The script will print updated files.
- Some complex import scenarios (dynamic imports, template strings, unusual code-generation) may need manual fixes.
- After migration you may want to rely on your bundler's aliases (Vite `resolve.alias`) for runtime builds but keep imports relative for TypeScript correctness.

If you'd like, I can also:

- Try converting imports across other folders (server, scripts)
- Create an automated rollback patch
- Remove `baseUrl` and `paths` automatically once the repo passes a typecheck
