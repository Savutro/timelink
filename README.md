# TimeLink

[![Static Site](https://github.com/savutro/timelink/actions/workflows/static-site.yml/badge.svg)](https://github.com/savutro/timelink/actions/workflows/static-site.yml)
[![App Version](https://img.shields.io/github/v/tag/savutro/timelink?label=app%20version&sort=semver)](https://github.com/savutro/timelink/tags)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://www.conventionalcommits.org/)
[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

TimeLink is a small Vite + vanilla TypeScript web app for finding a shared meeting window across two or more timezones. It is built for GitHub Pages and runs entirely in the browser without a backend.

## Why This Exists

Timezone planning is easiest when every participant can see the same day aligned on one timeline. TimeLink keeps the workflow visual:

- add two or more timezones
- search by city, IANA timezone, abbreviation, or UTC/GMT offset
- adjust each person's local availability
- compare every row against the same UTC day
- use the highlighted overlap as the common meeting window

## Usage

Open `index.html` in a browser or deploy the repository with GitHub Pages.

The default view starts with today's date, your current timezone, and New York. Use the form to add more timezones, then adjust the local `From` and `To` fields per row.

Timezone search accepts values such as `Europe/Zurich`, `Zurich`, `CEST`, `UTC-5`, and `GMT+1`. The date is available under `Advanced` for daylight saving checks on a specific day. The theme toggle follows the system preference by default and stores manual light or dark mode choices in the browser.

## GitHub Pages

This repository uses the static site workflow in [.github/workflows/static-site.yml](.github/workflows/static-site.yml).

The flow:

- Pull requests: install dependencies, type-check, build, and validate version metadata.
- Pushes to `main`: build and deploy `dist` to GitHub Pages.
- Tags like `v1.2.3`: create a GitHub release using notes from `CHANGELOG.md`.

## Versioning

Releases use semantic versioning with a plain text [VERSION](VERSION) file:

```text
1.0.0
```

Keep [CHANGELOG.md](CHANGELOG.md) in sync with each release and tag releases as `vX.Y.Z`.

## Project Layout

```text
index.html                    Application markup
src/main.ts                   Timezone calculations and UI state
src/styles.css                Responsive layout and visual design
public/favicon.svg            Browser icon
vite.config.ts                Vite static build config
package.json                  Development and build scripts
VERSION                       Plain semantic version
CHANGELOG.md                  Release notes
.github/workflows/            Validation, Pages deploy, and release workflow
```

## Development

Install dependencies:

```powershell
npm ci
```

Run the development server:

```powershell
npm run dev
```

Build the static site:

```powershell
npm run build
```

## License

GPLv3. See [LICENSE](LICENSE).
