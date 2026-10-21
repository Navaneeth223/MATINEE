# PWA Icons TODO

This directory needs the following icon files for PWA support:

## Required Files

1. **icon-192.png** (192x192px)
   - Used for: App icon on home screen
   - Format: PNG with transparency
   - Design: Matinee logo on dark background (#08070B)

2. **icon-512.png** (512x512px)
   - Used for: High-resolution app icon
   - Format: PNG with transparency
   - Design: Same as 192px, higher resolution

## Optional Files

3. **screenshot-wide.png** (1280x720px)
   - Used for: PWA install prompt preview (desktop)
   - Format: PNG
   - Content: Matinee in use, two users watching together

4. **screenshot-narrow.png** (750x1334px)
   - Used for: PWA install prompt preview (mobile)
   - Format: PNG
   - Content: Matinee mobile view

## Design Guidelines

- **Colors**: 
  - Background: #08070B (dark)
  - Accent: #E7C98E (gold)
  - Rose: #E07A8F (for highlights)
- **Style**: Minimal, romantic, couple-focused
- **Icon Shape**: Rounded square (safe area: 80% of canvas)
- **Maskable**: Ensure important elements stay within 80% safe area

## Tools

- [Figma](https://figma.com) - Design
- [Squoosh](https://squoosh.app) - Compression
- [maskable.app](https://maskable.app) - Test maskable icons

## Temporary Workaround

Until icons are designed:
- The app will use browser defaults
- PWA install will work but show generic icon
- No impact on functionality

## When Icons Are Ready

1. Place icons in `apps/web/public/`
2. Verify manifest.webmanifest paths match
3. Test PWA install on:
   - Chrome (desktop + Android)
   - Safari (iOS)
   - Edge (desktop)
4. Delete this file
