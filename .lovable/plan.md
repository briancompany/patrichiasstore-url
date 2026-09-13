# Fix offline homepage blank screen

## Changes
- Correct the existing offline cache so the homepage HTML and required JavaScript/CSS are available without internet.
- Route the homepage navigation through a network-first cache, while keeping built assets cache-first.
- Replace automatic worker injection with one guarded registration path that never runs in Lovable preview or development.
- Keep the existing installable-app name, icons, and manifest behavior.

## Verification
- Run the production build and tests.
- Serve the production build, load it once online, then use a browser offline and confirm only the homepage reloads without a blank screen.
- Confirm no service worker registers in the development preview.

## Technical details
- Continue using the existing `vite-plugin-pwa` generated worker; no hand-written worker.
- Exclude OAuth paths from offline navigation fallback and support `?sw=off` cleanup.
