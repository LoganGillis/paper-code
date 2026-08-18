# Shipping Paper

Installers, identity, and in-app updates. Drop the final icon in `build/` when you have it (`icon.png` 1024×1024, plus `icon.icns` / `icon.ico`). Until then the placeholders there are used.

## Identity

| Field | Value |
| --- | --- |
| App name | Paper |
| App id | `com.logangillis.paper` |
| Version | `package.json` → `version` |
| Menu / dock (even in `pnpm dev`) | `app.setName('Paper')` |

Dev still runs the Electron binary, but the menu bar should say **Paper**, not Electron.

## Build locally (no publish)

```bash
pnpm dist
```

Outputs land in `dist/`. macOS gets a `.dmg` and a `.zip` (the zip is what the updater needs). Windows gets `Paper-<version>-setup.exe`.

## Publish a release

GitHub will not create a **published** release unless the git tag already exists. Tag first, then publish.

1. Commit and push the code you are shipping.
2. Bump `version` in `package.json` if needed (keep it in sync with the tag).
3. Create and push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

4. Export a GitHub token that can create releases (`GH_TOKEN` or `GITHUB_TOKEN`).
5. `pnpm release` (macOS **and** Windows NSIS, then upload)

If packaging already succeeded and only the GitHub upload failed, skip the rebuild:

```bash
npx electron-builder --mac --win --publish always
```

`better-sqlite3` is a native addon. Local `pnpm release` on this Mac now downloads the official **Windows** Electron prebuild before packing the `.exe` (it will refuse to ship a macOS `.node`). Prefer the **Release** GitHub Action for Windows when you can — it compiles on `windows-latest`.

That uploads to [LoganGillis/paper-code](https://github.com/LoganGillis/paper-code) via electron-builder’s GitHub provider. The repo must be **public** for other people’s installs to see updates.

Packaged apps check that repo a few seconds after launch (`electron-updater`). Settings → Updates, and **Paper → Check for Updates…**, share the same status. When a download finishes, **Restart to update** calls `quitAndInstall`.

Updates are skipped in `pnpm dev` (check reports “latest”).

## Icon

Replace these, then rebuild:

- `build/icon.png`
- `build/icon.icns`
- `build/icon.ico`
- `resources/icon.png` (window / Linux fallback)

## Signing (certification)

Unsigned builds work, but Gatekeeper (Mac) and SmartScreen (Windows) will warn. There is no single “app store cert” — each OS has its own publisher identity.

### macOS — Apple Developer ID + notarize

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In Certificates, Identifiers & Profiles, create a **Developer ID Application** certificate (this is what Gatekeeper wants — not an Apple Development / Mac App Store cert).
3. Install the cert in Keychain on the Mac that builds, or export a `.p12` and set `CSC_LINK` + `CSC_KEY_PASSWORD`.
4. Create an [app-specific password](https://appleid.apple.com) for notarization.
5. In `electron-builder.yml` set `mac.notarize: true`, then publish with:

```bash
APPLE_ID=you@apple.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
```

After that, first-open should not show the unidentified-developer block.

### Windows — Authenticode

Microsoft does not notarize apps. You buy a **code signing certificate** from a public CA and sign the `.exe`. SmartScreen reputation then builds with downloads; an **EV** cert is trusted sooner.

Since 2023 the private key cannot just be a file on disk. Typical options:

| Path | Who it’s for | Notes |
| --- | --- | --- |
| [Azure Trusted Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/) | CI, cheapest for an individual | Cloud HSM, identity check, signs from GitHub Actions |
| SSL.com / DigiCert / Sectigo **OV** | Small org | USB token or their cloud signer (~a few hundred USD/year) |
| Same vendors **EV** | If SmartScreen must be quiet on day one | Stricter identity check, more expensive |

electron-builder signs when it sees `CSC_LINK` + `CSC_KEY_PASSWORD`, or Azure Trusted Signing env vars in CI. Leave them unset to keep shipping unsigned.
