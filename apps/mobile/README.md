# HalfThePrice Mobile (Expo)

Expo Router app for browsing listings, seller tools, and login against the HalfThePrice API.

## Prerequisites

- Node 20+
- pnpm (from repo root)
- [EAS CLI](https://docs.expo.dev/build/setup/) for cloud preview/production builds

```bash
npm install -g eas-cli
eas login
```

## Local development

```bash
# From repo root
pnpm install
pnpm docker:up   # API + Postgres on localhost:3000

# Point mobile at local API (default in eas.json development profile)
export EXPO_PUBLIC_API_URL=http://localhost:3000

cd apps/mobile
pnpm start
```

Use Expo Go or a development build (`eas build --profile development`).

## Preview build (staging API)

Preview builds talk to **Fly staging**: `https://half-the-price-staging.fly.dev`

```bash
cd apps/mobile

# iOS + Android internal distribution (APK on Android)
eas build --profile preview --platform all

# Or single platform
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

### Install preview build

1. After `eas build` completes, open the build URL from the CLI or [expo.dev](https://expo.dev) → your project → Builds.
2. **iOS**: Register test devices (`eas device:create`), then install via the Ad Hoc/Internal link or QR code from the build page.
3. **Android**: Download the `.apk` from the build page and sideload (enable “Install unknown apps” if prompted).

`EXPO_PUBLIC_API_URL` is baked in at build time via `eas.json` → `preview.env`.

## Production build

```bash
eas build --profile production --platform all
```

Update `production.env.EXPO_PUBLIC_API_URL` in `eas.json` when the production Fly app URL is final.

## Local bundle validation (no EAS account)

Validate that the app bundles without cloud builds:

```bash
cd apps/mobile
npx expo export --platform web
```

## Environment

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | API base URL (`lib/api.ts`) |

Profiles in `eas.json` set this per build type.
