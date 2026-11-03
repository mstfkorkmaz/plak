# Contributing to Plak

Thanks for helping! Bug reports, ideas and pull requests are all welcome. Türkçe yazabilirsin.

## Getting started

```bash
git clone https://github.com/OWNER/plak.git
cd plak
npm install
npm run demo-library
npm run dev
```

Open <http://localhost:5173>. The API restarts on save and the UI reloads instantly.

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same commands on Linux and Windows.

## Guidelines

- **Keep dependencies few.** Plak has two runtime dependencies. Please open an issue before adding a new one.
- **No native modules.** Everything must install without a compiler, on every platform.
- **Server code is TypeScript run directly by Node.** Use only erasable syntax: no `enum`, no `namespace`, no parameter properties. Import local files with the `.ts` extension.
- **Schema changes go in a new migration.** Append to the `migrations` list in `server/src/db.ts`. Never edit one that has been released.
- **Add a test** for API behavior in `server/test/`.
- **UI text goes in both languages** in `web/src/i18n.tsx`.
- **Never commit music.** Use `npm run demo-library` for test data.

## Reporting bugs

Include your operating system, Node.js version, how you installed Plak, and, for scanner problems, the file format and how it is tagged.

## Security issues

Please do not open a public issue. Email **info@solidcode.com.tr** instead.
