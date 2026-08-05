# MAYA Aesthetic vs Apple's Design Language

A reference for the aesthetics folder. The MAYA look (bone white over cosmos, liquid glass panels, Cormorant Garamond + Jost) sits remarkably close to Apple's current direction. This file collects the official sources and maps them to what MAYA already does.

## The official Apple sources

| Resource | Link | What it covers |
|---|---|---|
| Human Interface Guidelines (the master library) | https://developer.apple.com/design/human-interface-guidelines | Apple's entire design theory in one place: foundations, patterns, components |
| Materials | https://developer.apple.com/design/human-interface-guidelines/materials | The glass and blur system: how translucent panels sit over content |
| Typography | https://developer.apple.com/design/human-interface-guidelines/typography | Hierarchy through weight and size, legibility rules, tracking |
| Color | https://developer.apple.com/design/human-interface-guidelines/color | Semantic color, dark interfaces, accessibility contrast |
| Liquid Glass, the 2025 design language (WWDC video) | https://developer.apple.com/videos/play/wwdc2025/219/ | Apple's own introduction of Liquid Glass: refraction, lensing, depth |
| The new design system (WWDC video) | https://developer.apple.com/videos/play/wwdc2025/356/ | How hierarchy, harmony and consistency drive the new system |

## How MAYA compares

**Where MAYA already matches Apple:**

- Materials. MAYA's panels (backdrop blur 22px, saturate 180 percent, half pixel white borders, inset specular highlights) are the same idea as Apple's Liquid Glass: translucent surfaces that let the world behind them glow through. MAYA was on this look before it became Apple's headline.
- Dark canvas discipline. The cosmos background with restrained, softly glowing content follows Apple's dark interface guidance: desaturated surfaces, color used as signal (green means alive, rose means broken), never decoration.
- Hierarchy through type, not boxes. MAYA uses Cormorant Garamond for identity and Jost caps with wide tracking for labels, which mirrors Apple's rule that size, weight and tracking carry hierarchy.
- Restrained accent palette. One green, one amber, one rose, everything else is ink at varying opacities. Apple's color guidance says exactly this.

**Where MAYA intentionally diverges:**

- Serif identity. Apple is exclusively sans (SF Pro). MAYA's Cormorant serif wordmarks are a fashion house signature, keep them. Apple's own rule (typography carries brand) justifies the divergence.
- Letterspaced uppercase serif. Apple would not track a serif that wide. It works for MAYA because it reads as couture, not as UI.

**What is worth adopting from Apple that MAYA does not do yet:**

- Consistent spacing rhythm. Apple sizes everything on a fixed grid. MAYA's pages each pick their own paddings; a single spacing scale (8, 12, 16, 22) across index, status and backend would tighten the family resemblance.
- Contrast floors. Apple enforces minimum contrast for small text. Some of MAYA's faint labels (35 percent white) sit below comfortable legibility; the systems map now uses a brighter label tone for exactly this reason.
- Touch target minimums. Apple mandates 44 point targets. Some MAYA chips and pills are smaller; worth a pass before the subscription launch puts it on more phones.
