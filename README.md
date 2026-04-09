# Interactive Mirror: Shelf-Aware

> A playful full-body mirror screen that transforms you into your best shelf.

## The Experience

### Where Decisions Happen

Visitors step into a store environment where brands compete for attention at the **moment of purchase**. The installation recreates a supermarket aisle — complete with gondola shelves stocked with products on both sides — and places the visitor right in the middle of it.

### Mirror Avatar

Using **full-body pose tracking** (MediaPipe), the screen builds a live "mirror-self" avatar made of instanced supermarket products driven by physics proxies. The **webcam feed stays visible as the background**, and products only fly into frame once a person is detected, assembling into a real-time silhouette of the body — head, torso, arms, legs — rendered in 3D.

The branded version currently supports three selectable hero products: **Heinz Mustard**, **Oreo Cookie**, and **Coca-Cola Classic Bottle**. Each one is loaded from its own GLB and rendered with its **native textures and materials**, while preserving the same pose-driven body formation system.

### Physical Interaction

Products behave with **real physics** — bobbing, colliding, and scattering as users move. The figure is never static: cubes gently wobble and rotate organically, giving the avatar a living, breathing quality. When the visitor steps away, products fly back **out of frame** in satisfying flock-like arcs instead of resting on visible shelves.

### Playful Discovery

Gestures and movement trigger phase transitions and reassembly, encouraging quick experimentation and repeat plays. Hand-raise interactions move the experience into the gesture phase, and brand selection is currently finalized through **mouse/tap clicks** on the on-screen selector cards. The physicality of the interaction — seeing yourself made of products that react to your every move — reinforces the emotional connection at the moment where **in-store influence drives final decisions**.

---

## Technical Stack

| Layer | Technology | Role |
|-------|-----------|------|
| 3D Rendering | Three.js v0.170.0 | Scene, PBR materials, environment lighting, shadows |
| Pose Detection | MediaPipe Tasks Vision v0.10.18 | Real-time 33-landmark body tracking via webcam |
| Physics | cannon-es v0.20.0 | Collision resolution, velocity-driven movement |
| Delivery | 100% CDN | Zero installs — runs in any modern browser |

## Architecture

```
index.html          App shell + UI overlay (loading, selector, copy, debug controls)
js/main.js          Entry point and startup orchestration
js/config.js        Single source of truth for tuning constants
js/scene.js         Three.js setup, environment map, shelf visuals, resize handling
js/physics.js       cannon-es world and proxy bodies
js/mediapipe.js     Webcam + PoseLandmarker initialization and per-frame detection
js/bodyTargets.js   Landmark smoothing and body target generation
js/cubeData.js      Active/static shelf population + shelf home targets
js/productCatalog.js Loads per-product GLBs or a shared catalog and normalizes bounds
js/productOptions.js Branded option definitions (Kraft Heinz / Mondelez / Coca-Cola)
js/productRenderer.js Instanced rendering pipeline for active + static products
js/gestureDetector.js Phase state machine and gesture logic
js/uiPhases.js      Phase-driven UX copy/overlay/animation triggers
js/signatures/*     Signature motion layers for stack / calibration / fizz
js/animationLoop.js Main frame loop: detect → phase → drive → simulate → render
```

## Key Design Decisions

- **No gravity** — Products are driven by direct velocity targeting toward body landmarks, not gravitational forces. This gives precise, responsive formation without floaty lag.
- **Flock return** — When the pose is lost, cubes don't just lerp back. They swoop in arcs with sinusoidal oscillation (per-cube phase offsets) before settling upright on their shelf positions.
- **Organic wobble** — Cubes forming the body are never still. Gentle sin-wave angular velocities with unique phase per cube create a morphing, alive feel.
- **Ordered shelves** — Products sit axis-aligned on shelves, packed side by side with proper y-offset (half-height above plank surface). No random jitter while resting.
- **Environment lighting** — Scene is lit primarily through an environment map (bright sky dome + fluorescent ceiling strips + floor bounce) and hemisphere light, not point lights. This produces natural ambient occlusion and soft, realistic shading.

## Configuration Points

| Parameter | Current Value | Description |
|-----------|--------------|-------------|
| `PRODUCT_TYPES` | 8 types | Array of `{w, h, d}` — add/change product shapes here |
| `SHELF_EXTRA` | 120 | Number of active shelf-return items |
| `STATIC_SHELF_ITEMS` | 200 | Decorative static shelf fill items |
| `NUM_SHELVES` | 6 | Shelf rows per side |
| `SHELF_LENGTH` | 8 | Z-extent of each gondola |
| `SHELF_X` | 3.2 | Distance from center to shelf walls |
| `STIFFNESS` / `MAX_SPEED` | 3 / 4 | How fast cubes seek their target |
| `SEGMENTS` | 13 entries | Body part definitions (cube count, thickness, size multiplier) |
| Product options | `kraft-heinz` / `mondelez` / `coca-cola` | Branded selector options for active items |
| Shelf color | `AMC_COLORS.blue` / `AMC_COLORS.navy` | Gondola plank and panel colors |
| Hero assets | `./assets/glb/mustard.glb`, `./assets/glb/oreo.glb`, `./assets/glb/cocacola.glb` | Source GLBs used for branded body formation |

## Running Locally

```bash
cd mirror
python3 -m http.server 8080
# Open http://localhost:8080
```

Requires a webcam and a modern browser with WebGL2 support.

---

## Roadmap

- [ ] Configurable product textures / brand logos on cubes
- [ ] Gesture-triggered scatter bursts (wave, clap detection)
- [x] Category-aware product distribution from GLB variant names
- [x] Branded 3-option selector with click/tap selection
- [x] Per-brand harmony signatures (stack / calibration / fizz), v1
- [ ] Gesture-based dwell selection
- [ ] Explicit runtime category mode switching (beverages, snacks, cleaning, etc.)
- [ ] Sound design — satisfying swoosh/click sounds on formation and scatter
- [ ] Multi-person support
- [ ] Analytics overlay — heatmap of which body parts attract most attention
