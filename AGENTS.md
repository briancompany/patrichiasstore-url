# Layout architecture
- Keep app-wide intrinsic flex/grid shrink and fluid page-wrapper defaults in global CSS so every route reflows consistently.
- Keep intentional image, progress, carousel, and scroll-region clipping local; page wrappers must not clip content.