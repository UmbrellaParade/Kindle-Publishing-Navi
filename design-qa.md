# Design QA — floating scroll-to-top button

## Comparison target

- Source visual truth: `C:\Users\myabe\OneDrive\Desktop\スクリーンショット 2026-08-09 011229.png`
- Final desktop implementation: `C:\Users\myabe\AppData\Local\Temp\kindle-navi-scroll-top-qa\implementation-desktop-final2-1920x1032.png`
- Final mobile implementation: `C:\Users\myabe\AppData\Local\Temp\kindle-navi-scroll-top-qa\implementation-mobile-final-390x844.png`
- Focused side-by-side comparison: `C:\Users\myabe\AppData\Local\Temp\kindle-navi-scroll-top-qa\comparison-bottom-right.png`
- State: the manual is open and scrolled to a middle section.
- Desktop viewport: 1920 x 1032 CSS px, device scale factor 1.
- Source pixels: 1920 x 1032. Implementation pixels: 1920 x 1032.
- Mobile viewport and pixels: 390 x 844, device scale factor 1.

The source includes Chrome browser chrome while the implementation capture is page content only. Full-page typography and vertical offsets are therefore not treated as a fidelity target. The user-marked bottom-right region was cropped at identical pixel coordinates and compared side by side; that focused comparison is the authoritative placement evidence.

## Full-view comparison evidence

- At 1920px, the button remains fixed beside the right edge of the `max-w-7xl` content frame while the manual is scrolled.
- At 390px, the button remains fixed 16px from the viewport right edge and above the mobile safe area.
- The main content has additional bottom padding so the final content can scroll clear of the fixed control.
- No horizontal overflow was introduced: mobile body width 385px in a 390px viewport.

## Focused comparison evidence

The focused comparison shows the source's red-circled target area on the left and the final implementation on the right. The final button occupies that marked gutter without colliding with the manual article or the browser-side utility controls.

## Required fidelity surfaces

- Fonts and typography: the existing app font, 14px bold label, line height, and Japanese copy are preserved. `w-max` and `whitespace-nowrap` keep `上に戻る` on one line.
- Spacing and layout rhythm: the desktop button begins 16px outside the 1280px content frame at widths of 1600px or more; narrower screens use a 16px viewport inset. The bottom inset adds the device safe area.
- Colors and visual tokens: the existing dark surface, neon-cyan text/border, focus ring, and shadow are reused. Contrast remains clear against the manual background.
- Image quality and asset fidelity: no new raster assets are required. The existing Lucide `ArrowUp` icon is retained and renders sharply at all checked sizes.
- Copy and content: visible text remains `上に戻る`; the accessible name remains `ページの上に戻る`.

## Interaction and accessibility verification

- The control is a native `button`, has a minimum 44px target, visible focus treatment, and an accessible Japanese name.
- Mouse/touch activation scrolls to `scrollY: 0` and moves focus to `#kindle-navi-page-title`.
- Reduced-motion behavior remains covered by the source regression test.
- The app update banner is offset above the floating button and keeps its higher overlay priority.
- Manual and Kindle manuscript guide middle states both expose one global scroll-to-top button.
- Console errors and warnings: 0 in the checked local browser session.

## Comparison history

1. Baseline: the control was inline after the main content and was unavailable until the user reached the page bottom.
2. First fixed pass: placement matched the requested gutter, but an intermediate max-width-frame implementation allowed the Japanese label to wrap vertically at 1920px (P1).
3. Fix: added intrinsic width and no-wrap behavior, recaptured the same viewport/state, and confirmed the horizontal label in the requested location.

## Findings

No actionable P0, P1, or P2 findings remain. No P3 visual follow-up is required for this scoped change.

## Final result

final result: passed
