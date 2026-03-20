# Interactive Mirror: Shelf-Aware

> A playful full-body mirror screen that transforms you into your best shelf.

## The Experience

### Where Decisions Happen

Visitors step into a store environment where brands compete for attention at the **moment of purchase**. The installation recreates a supermarket aisle — complete with gondola shelves stocked with products on both sides — and places the visitor right in the middle of it.

### Mirror Avatar

Using **full-body pose tracking** (MediaPipe), the screen builds a live "mirror-self" avatar made entirely of **floating grocery products**. As the visitor stands in front of the screen, hundreds of product-shaped boxes fly off the shelves and assemble into a real-time silhouette of their body — head, torso, arms, legs — all rendered in 3D.

The type of products displayed on the shelves is **configurable**: different brands, categories, or campaigns can be loaded to tailor the experience per activation.

### Physical Interaction

Products behave with **real physics** — bobbing, colliding, and scattering as users move. The figure is never static: cubes gently wobble and rotate organically, giving the avatar a living, breathing quality. When the visitor steps away, products fly back to the shelves in satisfying flock-like arcs, swooping through the air before settling neatly into place.

### Playful Discovery

Gestures and movement trigger satisfying **bursts of motion and reassembly**, encouraging quick experimentation and repeat plays. The physicality of the interaction — seeing yourself made of products that react to your every move — reinforces the emotional connection at the moment where **in-store influence drives final decisions**.

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
index.html          Minimal shell: hidden video, loading spinner, fullscreen canvas
app.js              All application logic (~600 lines):
                    ├── Body Segments    13 segments mapping 33 landmarks → ~371 cubes
                    ├── Shelf System     6 shelves × 2 sides, ~600 extra product cubes
                    ├── Physics          Zero-gravity world, direct velocity targeting
                    ├── Animation        Flock return, organic wobble, progressive spawn
                    └── Rendering        PBR env map, hemisphere + directional lighting
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
| `SHELF_EXTRA` | 600 | Number of extra shelf-only cubes |
| `NUM_SHELVES` | 6 | Shelf rows per side |
| `SHELF_LENGTH` | 8 | Z-extent of each gondola |
| `SHELF_X` | 3.2 | Distance from center to shelf walls |
| `STIFFNESS` / `MAX_SPEED` | 6 / 8 | How fast cubes seek their target |
| `SEGMENTS` | 13 entries | Body part definitions (cube count, thickness, size multiplier) |
| Cube color | `0x1a5caa` | Single color for all product cubes |
| Shelf color | `0x1a5caa` / `0x164d90` | Gondola plank and panel colors |

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
- [ ] Multiple product category modes (beverages, snacks, cleaning, etc.)
- [ ] Sound design — satisfying swoosh/click sounds on formation and scatter
- [ ] Multi-person support
- [ ] Analytics overlay — heatmap of which body parts attract most attention
