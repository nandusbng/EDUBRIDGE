# Sapphire Logic Design System

### 1. Overview & Creative North Star
**Creative North Star: The Academic Architect**
Sapphire Logic is a design system built for clarity, authority, and structured discovery. It moves away from the "social media feed" aesthetic toward an editorial, repository-focused experience. The system is defined by high-density information architecture balanced by generous gutters and a crisp, ink-on-paper digital feel. It uses sharp geometry and a deep "Sapphire" primary to instill trust and focus.

### 2. Colors
The palette is rooted in a high-fidelity blue (`#0056b2`) that symbolizes institutional knowledge.

- **The "No-Line" Rule:** Sectioning is achieved through background shifts. For example, a sidebar uses a pure `surface` (`#ffffff`) against a `background` (`#f5f7f8`) workspace. 1px borders are only permitted for individual card containers to maintain object-permanence in a dense grid.
- **Surface Hierarchy & Nesting:** Use `surface_container_low` for search bars and `surface_container` for secondary action buttons to create tactile depth without heavy shadows.
- **The "Glass & Gradient" Rule:** Hero elements and card headers should utilize "The Tinted Veil"—a 20% opacity primary gradient (`primary/20`) that allows the underlying surface to breathe while categorizing content visually.
- **Signature Textures:** Interactive states use subtle 5% color overlays rather than dramatic shifts, maintaining the "Academic" sobriety of the system.

### 3. Typography
The system relies exclusively on **Inter**, a typeface designed for maximum legibility in complex interfaces.

- **Display & Headline:** The system uses a bold, "Black" weight (900) for page titles (`1.875rem` or `2.25rem`) to create a strong editorial anchor.
- **Body & Rhythm:** The standard body size is `0.875rem` (14px), optimized for reading long-form note descriptions. 
- **The Meta-Scale:** A specialized `10px` bold uppercase style is reserved for taxonomy tags (e.g., "MATH", "SCIENCE"), acting as a visual "stamp" of classification.
- **Tracking:** Headlines use `-0.025em` tracking to feel tighter and more "printed," while body text remains at `0` for readability.

### 4. Elevation & Depth
Elevation is communicated through "Tonal Stacking" rather than elevation levels.

- **The Layering Principle:** The sidebar and header are "Anchored" elements, using `surface` (`#ffffff`) with a subtle `outline_variant` border. 
- **Ambient Shadows:** 
    - **Level 1 (Cards):** A `shadow-sm` (tight, low-blur) for standard items.
    - **Level 2 (CTAs):** A `shadow-lg` specifically tinted with the primary color (`shadow-primary/20`) to make the "Upload" or "Primary" action feel physically elevated.
- **Backdrop Blurs:** Floating menus (like user profiles) must use a `12px` backdrop blur to separate them from the dense content grid below.

### 5. Components
- **The Institutional Card:** Rounded at `0.75rem` (xl), featuring a "Veil" header and a clean footer for meta-data.
- **Status Chips:** Full-pill shapes (`rounded-full`) using `surface_container_high` for inactive states and `primary` for active selections.
- **Action Buttons:** Primary buttons use a `primary` background with white text and a bold weight. Secondary buttons use `surface_container` to appear integrated into the page.
- **The Search Bar:** A "Ghost Input" style—fully integrated into the header layout with no border, using `surface_container_low` as its base.

### 6. Do's and Don'ts
- **Do:** Use color as a category—Science is Emerald, History is Amber, Physics is Indigo.
- **Do:** Maintain a strict 24px (1.5rem) or 32px (2rem) padding rhythm to prevent the dense information from feeling cluttered.
- **Don't:** Use rounded corners larger than `0.75rem` for structural elements; the system should feel precise, not "bubbly."
- **Don't:** Use pure black (#000000) for text; always use `on_surface` (#0f172a) to maintain the ink-like softness.