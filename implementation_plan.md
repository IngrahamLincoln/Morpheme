# Implementation Plan: WebGL Dot Grid with Custom Connectors MVP

**Goal:** Create a 2x2 WebGL dot grid prototype in a Next.js app to experiment with rendering specific circle and connector shapes using interactive controls.

**Phase 1: Project Setup & Basic Scene**

1.  **Initialize Next.js App:**
    ```bash
    npx create-next-app@latest webgl-dot-grid-mvp
    cd webgl-dot-grid-mvp
    ```
2.  **Install Dependencies:**
    ```bash
    npm install three @react-three/fiber @react-three/drei leva
    # or
    yarn add three @react-three/fiber @react-three/drei leva
    ```
    * `three`: The core WebGL library.
    * `@react-three/fiber`: React reconciler for Three.js (makes using Three.js declarative in React).
    * `@react-three/drei`: Helper components and hooks for `@react-three/fiber`.
    * `leva`: Simple GUI library for interactive controls (sliders).
3.  **Create Basic Canvas Component:**
    * Create `components/WebGLCanvas.js`.
    * Set up a basic `@react-three/fiber` `Canvas` component.
    * Add an orthographic camera suitable for 2D rendering.
    * Add basic lighting (AmbientLight might suffice).
4.  **Integrate into Next.js Page:**
    * Modify `pages/index.js`.
    * Import and render the `WebGLCanvas` component. Ensure it's client-side rendered (`next/dynamic` with `ssr: false`).

**Phase 2: Interactive Controls & Parameter Setup**

1.  **Integrate `leva`:**
    * In `components/WebGLCanvas.js`, use the `useControls` hook from `leva`.
2.  **Define Control Parameters:**
    * `radiusB`: Radius of the main visible circles (default: e.g., 0.4).
    * `radiusA`: Radius of the conceptual underlying circle influencing the connector (default: e.g., 0.5).
    * `spacing`: Distance between the centers of the grid points (default: e.g., 1.5).
3.  **Pass Parameters:** Ensure these values are accessible within the WebGL scene components.

**Phase 3: Rendering the Test Geometry (Diagonal Pair)**

1.  **Define Geometry Positions:** Calculate the center coordinates for two diagonally adjacent points based on the `spacing` parameter (e.g., `[-spacing/2, spacing/2]` and `[spacing/2, -spacing/2]`).
2.  **Create Shader Material:**
    * Define placeholder Vertex and Fragment shaders (e.g., in separate `shaders/connectorShader.js` file or inline).
    * Create a `shaderMaterial` using Three.js/R3F, passing the control parameters (`radiusA`, `radiusB`, `spacing`) and the positions of the two circle centers as `uniforms`.
3.  **Create Plane Geometry:**
    * Create a `PlaneGeometry` large enough to encompass both circles and the space between them (e.g., size based on `spacing` and `radiusB`).
    * Position this plane correctly in the scene to cover the area of the two diagonal points.
4.  **Apply Material:** Apply the `shaderMaterial` to the `PlaneGeometry`.

**Phase 4: Implementing the Fragment Shader Logic**

1.  **Receive Uniforms:** Access `radiusA`, `radiusB`, `spacing`, circle center positions (`center1`, `center2`), and the fragment's UV coordinates or world position within the shader.
2.  **Distance Calculations:** Calculate the distance from the current pixel (`gl_FragCoord` or derived world position) to `center1` and `center2`.
3.  **Circle B Rendering:**
    * If `distance(pixel, center1) < radiusB` or `distance(pixel, center2) < radiusB`, set the pixel color to black.
4.  **Connector Shape Logic (Core Task):**
    * **Define Connector Region:** Determine the area *between* the circles where the connector should live.
    * **Calculate Concavity:** This is where `radiusA` comes in.
        * *Hypothesis:* Model the connector boundary as two curves. The "tightness" or position of these curves is influenced by `radiusA`. A larger `radiusA` might push the curves "inward", creating a thinner neck. A smaller `radiusA` might let them bulge outward more.
        * *SDF Approach (Advanced):* Define SDFs for Circle B1, Circle B2, and potentially a "negative" SDF based on Circle A positioned between them. Combine these using smooth minimum operations.
        * *Geometric Approach:* Find the tangent points between the two Circle Bs. Define Bezier curves or arcs connecting these tangents, with control points or curvature influenced by `radiusA` and `spacing`.
    * **Pixel Check:** Determine if the current pixel falls within this calculated connector region.
    * **Coloring:** If inside the connector region, set the pixel color to black.
5.  **Final Output:** Set `gl_FragColor` based on the checks above (black if inside circle B or connector, background/transparent otherwise).

**Phase 5: Iteration and Refinement**

1.  **Adjust Shader Math:** Tweak the fragment shader logic while manipulating the `leva` sliders until the connector shape visually matches the target image and responds intuitively to `radiusA`, `radiusB`, and `spacing`.
2.  **Code Cleanup & Documentation:** Add comments explaining the shader logic.

**Future Steps (Post-MVP):**

1.  **Grid State Management:** Implement a data structure (e.g., a 2D array or a flat array) in React state to hold the on/off status of each dot (1000x2000).
2.  **Efficient Circle Rendering:** Use `InstancedMesh` to draw all Circle Bs based on the grid state. Pass the on/off state per instance (e.g., via an attribute or a data texture) to control visibility or color.
3.  **Efficient Connector Rendering:** This is the hardest scaling part.
    * **Option A (Shader-based):** Render the state of all circles (B) to an offscreen texture. Use a full-screen shader pass that reads this texture. For each pixel, check its neighbors in the texture; if neighbors are "on", calculate and render the appropriate connector shape (horizontal, vertical, diagonal) using shader logic similar to the MVP.
    * **Option B (Instanced Geometry):** Pre-calculate the geometry for each *type* of connector (H, V, D-TLBR, D-TRBL). Use `InstancedMesh` for each type. In your JS code, determine which connectors are active based on the grid state and update the instance data (positions, transformations) accordingly. Requires more complex CPU-side logic but potentially less complex shaders.
4.  **Interaction:** Add click handlers (e.g., using raycasting) to toggle the state of dots in the grid.