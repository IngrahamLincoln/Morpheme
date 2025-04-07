
I want to have a 2d xy grid of circles. they could be 10 x 10 or 100 x 100 it shouldnt matter
at each intersection of the grid there should be two circles one of say .4 radii and one of .5 radii so a little larger. the outer circles overlap on the grid by (outer circle radii - inner circle radii)
3 the inner circle is going to be "activateable" in that it toggles from empty to solid black.
the outer circle's purpose is to be a boundary for diagonal connectors between the activated solid inner circles. the code will show this done... but not perfectly.
there are 3 connector types diagonal \ diagonal / and horizontal. the construction of the diagonal connectors are VERY particularly important. they are made of an area that is a. outside the two inner circles that they connect
b. outside the two OUTER circles that they are not connecting
c. inside a bounding box that does not extend past the center points of the 4 cirlces that they are in between.
d. at a layer under the circles.

Okay, let's structure this as a comprehensive implementation document for building your scalable WebGL grid application using Next.js and `react-three-fiber`. We'll adopt a feature-based development approach, providing detailed prompts suitable for guiding an LLM developer, and incorporate testing considerations.

## Project Implementation Plan: Scalable WebGL Grid


# the number 1 priority is that this is done in such a way as to be efficiently loaded in a phone or desktop browser
**1. Overview**

*   **Goal:** Develop a highly scalable web application displaying a 2D grid of interactive circles and connectors using WebGL for rendering performance.
*   **Core Features:**
    *   Dynamically sized grid (e.g., 10x10 to 100x100+).
    *   Each grid intersection features an inner (activatable) and outer circle.
    *   Inner circles toggle state (empty/solid black) on click.
    *   Connectors (Horizontal, Diagonal \, Diagonal /) appear between *active* inner circles.
    *   Connectors have specific geometric constraints (outside certain circles, inside bounding box).
    *   Connectors render *below* circles.
    *   Interaction allows toggling/cycling connectors directly (with rules preventing overlaps).
*   **Tech Stack:**
    *   Frontend Framework: Next.js (React)
    *   WebGL Library: `three.js`
    *   React Wrapper for Three.js: `react-three-fiber` (R3F), `@react-three/drei`
    *   State Management: React state (`useState`), potentially Zustand/Jotai for very large grids if needed.
    *   UI Controls (Development): `leva`
    *   Shading Language: GLSL
*   **Target User:** An LLM assistant performing the coding tasks based on detailed prompts.

**2. Core Architecture**

*   **Data-Driven Rendering:** The application state (primarily which inner circles are active and potentially intended connector states) will be the single source of truth. All rendering updates reactively based on this state.
*   **Circle Rendering:** `InstancedMesh` will be used to render all circles efficiently. Each instance will have its position and activation state passed via instance attributes. A custom GLSL shader will draw the inner/outer circles based on instance state and uniforms.
*   **Connector Rendering:** A single large `PlaneGeometry` covering the entire grid area will be used. A sophisticated GLSL fragment shader will run for every pixel of this plane.
    *   **State Input:** A `DataTexture` (`stateTexture`) will encode the activation state of all inner circles, sampled by the connector shader.
    *   **Logic:** The shader will determine the fragment's position relative to the grid, sample the state of nearby circles from the `stateTexture`, and calculate Signed Distance Functions (SDFs) to draw the appropriate connector types (Horizontal, Diagonal \, Diagonal /) based on the activation states and geometric rules. It will also need information about which connector type is *intended* if cycling/toggling is implemented (see Feature 8).
    *   **Layering:** The connector plane will be positioned behind the circle `InstancedMesh` in Z-space.
*   **Interaction:**
    *   Clicks on the circle `InstancedMesh` will be detected using R3F's event system (`event.instanceId`). These clicks will toggle the corresponding circle's activation state.
    *   Clicks on the connector plane (or a dedicated interaction plane) will be used to toggle/cycle connectors, requiring hit detection logic to determine which potential connector area was clicked.

**3. Testing Strategy**

Since visual output and GPU-based rendering are central, a mix of testing strategies is required:

*   **Unit Testing (Jest/Vitest):**
    *   **Helper Functions:** Test pure functions for calculations (grid index <-> coordinates, center offsets, scaling logic).
    *   **State Management Logic:** If using reducers or state management libraries, test the state update logic in isolation. Test the initial state creation.
    *   **Component Mounting:** Basic tests (`@testing-library/react`) to ensure components render without crashing.
*   **Visual Regression Testing (Storybook + Chromatic/Percy):**
    *   **Critical:** This is the best way to ensure visual features remain consistent.
    *   Create stories for the `GridScene` component in various states:
        *   Different grid sizes and spacings.
        *   No circles active.
        *   Single circle active.
        *   Pairs of circles active (horizontal, diagonal).
        *   Specific complex patterns demonstrating connector rules.
        *   States demonstrating the toggled/cycled connector states (Feature 8).
    *   Automated services compare screenshots against baselines, catching unintended visual changes in UI, shaders, or layout.
*   **Interactive Testing (Manual):**
    *   Use `leva` controls extensively during development to manipulate parameters (`gridSpacing`, `zoom`, radii, debug flags).
    *   Manually click circles and connector areas to verify interaction logic and visual feedback behaves exactly as expected according to the rules.
    *   Test edge cases (grid boundaries, rapid clicking, large grid sizes).

---

**4. Phased Development Plan & Feature Prompts**

**(LLM Instructions: Implement each feature sequentially. Ensure code is clean, follows React/R3F best practices, and is well-commented. Use TypeScript if feasible.)**

---

**Feature 0: Base Setup**

*   **Goal:** Initialize the Next.js project, install dependencies, and set up the basic R3F Canvas with camera and controls.
*   **Dependencies:** None.
*   **Tasks:**
    1.  Create a new Next.js application (`npx create-next-app@latest`).
    2.  Install necessary dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `leva`.
    3.  Create a main page (e.g., `pages/index.js` or `app/page.tsx`) that renders a full-screen R3F `Canvas`.
    4.  Inside the `Canvas`, add an `OrthographicCamera` (`@react-three/drei`) suitable for 2D viewing. Make it the default camera. Configure initial `zoom` and `position`.
    5.  Add basic lighting (e.g., `<ambientLight intensity={1.0} />`).
    6.  Integrate `leva` for UI controls. Add initial controls for `cameraZoom` (adjusting the OrthographicCamera's zoom) and potentially a background color.
    7.  Create a placeholder `GridScene` component and render it inside the `Canvas`.
*   **Testing:** Verify the Next.js app runs, displays an empty R3F canvas, the camera is orthographic, and the `leva` controls appear and affect the camera zoom.

---

**Feature 1: Grid Data & Configuration**

*   **Goal:** Define grid parameters, scaling logic, and helper functions for grid calculations.
*   **Dependencies:** Feature 0.
*   **Tasks:**
    1.  Define constants or state within `GridScene` (or a dedicated config/hook) for:
        *   `GRID_WIDTH` (e.g., 10)
        *   `GRID_HEIGHT` (e.g., 10)
        *   `BASE_GRID_SPACING` (e.g., 1.0)
        *   `BASE_RADIUS_A` (Outer radius, e.g., 0.5)
        *   `BASE_RADIUS_B` (Inner radius, e.g., 0.4)
    2.  Add a `leva` control for `currentGridSpacing`, defaulting to `BASE_GRID_SPACING`.
    3.  Calculate derived values:
        *   `TOTAL_CIRCLES = GRID_WIDTH * GRID_HEIGHT`
        *   `scaledRadiusA = BASE_RADIUS_A * (currentGridSpacing / BASE_GRID_SPACING)`
        *   `scaledRadiusB = BASE_RADIUS_B * (currentGridSpacing / BASE_GRID_SPACING)`
    4.  Implement helper functions:
        *   `getIndex(row, col, gridWidth)`: Converts 2D grid coordinates to a flat array index.
        *   `getCoords(index, gridWidth)`: Converts a flat array index back to 2D grid coordinates.
        *   `getCenterOffset(gridWidth, gridHeight, spacing)`: Calculates the offset needed to center the grid at (0,0).
        *   `getWorldPosition(row, col, gridWidth, gridHeight, spacing)`: Calculates the world (x, y) position for a given grid cell, applying the centering offset. (Ensure consistent Y direction - e.g., positive Y up).
*   **Testing:** Use `console.log` or unit tests (Jest/Vitest) to verify the helper functions produce correct results for various inputs. Verify derived values update correctly when `currentGridSpacing` changes via `leva`.

---

**Feature 2: Static Circle Rendering**

*   **Goal:** Render the grid of circles (inner and outer rings) at their correct positions using `InstancedMesh` and a basic shader. Activation state is ignored for now.
*   **Dependencies:** Feature 0, Feature 1.
*   **Tasks:**
    1.  Inside `GridScene`, create a `useRef` for the `InstancedMesh`.
    2.  Create the `InstancedMesh` component: `<instancedMesh ref={meshRef} args={[null, null, TOTAL_CIRCLES]}>`.
    3.  Define the instance geometry: Use `<planeGeometry args={[size, size]} />` where `size` is large enough to contain the outer circle (e.g., `2 * BASE_RADIUS_A * scaleFactor` or simply `1` and handle scale in shader/matrix).
    4.  **Calculate Instance Matrices:** Use a `useEffect` hook (depending on `GRID_WIDTH`, `GRID_HEIGHT`, `currentGridSpacing`) to:
        *   Loop through all indices from 0 to `TOTAL_CIRCLES - 1`.
        *   For each index, get `row`, `col` using `getCoords`.
        *   Calculate the world `x`, `y` using `getWorldPosition`.
        *   Use a temporary `THREE.Object3D` (`dummy` object pattern) to `dummy.position.set(x, y, 0)` and `dummy.updateMatrix()`.
        *   Set the matrix: `meshRef.current.setMatrixAt(index, dummy.matrix)`.
        *   After the loop, set `meshRef.current.instanceMatrix.needsUpdate = true`.
    5.  **Create Basic Circle Shader (`CircleMaterial.js`):**
        *   Use `drei/shaderMaterial` or write vanilla `THREE.ShaderMaterial`.
        *   **Uniforms:** `u_radiusA`, `u_radiusB`, `u_bgColor`, `u_outerColor`, `u_innerColorEmpty`. Pass the *scaled* radii as uniforms.
        *   **Vertex Shader:** Standard, pass instance matrix (`instanceMatrix`) and UVs (`vUv`) to fragment shader.
        *   **Fragment Shader:**
            *   Calculate `dist` from fragment center (`vec2(0.5)` if using unit plane geometry UVs).
            *   `if (dist > u_radiusA) discard;`
            *   `if (dist > u_radiusB) gl_FragColor = u_outerColor;`
            *   `else gl_FragColor = u_innerColorEmpty;` (e.g., transparent or background color)
        *   Make sure the material has `transparent: true`.
    6.  Apply the material to the `InstancedMesh`. Update `u_radiusA`, `u_radiusB` uniforms when `currentGridSpacing` changes.
*   **Testing:** Visually verify that a grid of circles (outer rings visible, inner area matching background) appears, centered correctly. Check that changing `currentGridSpacing` via `leva` scales the grid and circle sizes proportionally. Use Storybook to capture this static state.

---

**Feature 3: Circle Activation State**

*   **Goal:** Implement the state management for inner circle activation using a flat array.
*   **Dependencies:** Feature 1.
*   **Tasks:**
    1.  In `GridScene`, create the React state for activation:
        ```javascript
        const [activationState, setActivationState] = useState(() =>
            new Float32Array(TOTAL_CIRCLES).fill(0.0) // 0.0 inactive, 1.0 active
        );
        ```
    2.  Attach an `InstancedBufferAttribute` named `a_activated` to the `InstancedMesh`'s geometry (from Feature 2). Use `useMemo` to create the attribute initially and `useRef` to access it. Item size is 1.
        ```javascript
        // Inside InstancedMesh geometry definition
        <instancedBufferAttribute
            ref={activationAttributeRef}
            attach="attributes-a_activated"
            args={[activationState, 1]} // Use initial state
        />
        ```
    3.  Create a `useEffect` hook that depends on `activationState`:
        *   Get the attribute reference: `const attribute = activationAttributeRef.current;`
        *   If the attribute exists, update its array: `attribute.array.set(activationState);`
        *   Mark for update: `attribute.needsUpdate = true;`
*   **Testing:** Use React DevTools to inspect the `activationState`. Manually change values in the console (e.g., `setActivationState(prev => { const next = new Float32Array(prev); next[0]=1.0; return next; })`) and verify the state updates. Verify the `InstancedBufferAttribute` data updates (can be tricky to inspect directly, rely on visual feedback in next feature). Unit test the state initialization.

---

**Feature 4: Circle Interaction**

*   **Goal:** Allow users to click on the *inner* part of a circle to toggle its activation state, visually changing it from empty to solid black.
*   **Dependencies:** Feature 2, Feature 3.
*   **Tasks:**
    1.  **Modify Circle Shader (`CircleMaterial.js`):**
        *   Add `attribute float a_activated;` to vertex shader, pass to fragment as `varying float v_activated;`.
        *   Add `u_innerColorActive` (e.g., black) uniform.
        *   In fragment shader, modify the inner circle logic:
            ```glsl
            if (dist <= u_radiusB) {
                if (v_activated == 1.0) {
                    gl_FragColor = u_innerColorActive;
                } else {
                    gl_FragColor = u_innerColorEmpty;
                }
            } else if (dist <= u_radiusA) {
                gl_FragColor = u_outerColor;
            } else {
                discard;
            }
            ```
    2.  **Add Click Handler to `InstancedMesh`:**
        *   `const handleCircleClick = (event) => { ... }`
        *   Attach it: `<instancedMesh ... onClick={handleCircleClick}>`
        *   Inside the handler:
            *   `event.stopPropagation();`
            *   Check for `event.instanceId`. If undefined, return.
            *   Get the clicked instance index: `const index = event.instanceId;`
            *   Get the click point in world space: `const point = event.point;`
            *   Get the center position of the clicked instance: Retrieve matrix `meshRef.current.getMatrixAt(index, tempMatrix)` and extract position, OR recalculate using `getCoords(index, GRID_WIDTH)` and `getWorldPosition`.
            *   Calculate distance: `const distFromCenter = point.distanceTo(instanceCenter);`
            *   Get the *current* scaled inner radius: `const currentScaledRadiusB = BASE_RADIUS_B * (currentGridSpacing / BASE_GRID_SPACING);`
            *   **Check if click is inside inner circle:** `if (distFromCenter <= currentScaledRadiusB)`:
                *   Update the state:
                    ```javascript
                    setActivationState(current => {
                        const newState = new Float32Array(current); // Important: Copy!
                        newState[index] = newState[index] === 1.0 ? 0.0 : 1.0; // Toggle
                        return newState;
                    });
                    ```
*   **Testing:** Click on various inner circles. Verify they toggle between empty and solid black. Verify clicking the outer ring or empty space does nothing. Verify interaction works correctly after changing grid spacing. Use Storybook to capture states with active circles.

---

**Feature 5: State Data Texture**

*   **Goal:** Create and maintain a `THREE.DataTexture` that mirrors the `activationState` array, ready to be consumed by the connector shader.
*   **Dependencies:** Feature 3.
*   **Tasks:**
    1.  In `GridScene`, create the `DataTexture` using `useMemo`:
        ```javascript
        const stateTexture = useMemo(() => {
            const texture = new THREE.DataTexture(
                new Float32Array(GRID_WIDTH * GRID_HEIGHT), // Initial data buffer
                GRID_WIDTH,
                GRID_HEIGHT,
                THREE.RedFormat, // Store activation (0.0 or 1.0) in Red channel
                THREE.FloatType
            );
            texture.minFilter = THREE.NearestFilter; // Crucial: No interpolation
            texture.magFilter = THREE.NearestFilter;
            texture.needsUpdate = true; // Initial update needed
            return texture;
        }, [GRID_WIDTH, GRID_HEIGHT]);
        ```
    2.  Create a `useEffect` hook depending on `activationState`:
        *   `stateTexture.image.data.set(activationState);` // Update texture data
        *   `stateTexture.needsUpdate = true;` // Mark for GPU upload
*   **Testing:** Use debugging tools (like Spector.js browser extension) to inspect the GPU state and verify the texture exists with the correct dimensions and format. Verify its data updates visually in the next feature when the shader samples it.

---

**Feature 6: Connector Plane & Base Shader**

*   **Goal:** Set up the plane mesh where connectors will be drawn and a basic shader structure that can sample the state texture.
*   **Dependencies:** Feature 1, Feature 5.
*   **Tasks:**
    1.  **Calculate Plane Size:** Determine the required width and height of the plane to cover the entire grid area plus a margin (e.g., one grid unit).
        *   `const planeWidth = GRID_WIDTH * currentGridSpacing;`
        *   `const planeHeight = GRID_HEIGHT * currentGridSpacing;`
        *   Use slightly larger values to avoid clipping at edges.
    2.  Create a `Mesh` component in `GridScene`: `<mesh position={[0, 0, -0.1]}>` (place behind circles).
    3.  Use a `<planeGeometry args={[planeWidth, planeHeight]} />`. Ensure the plane is centered correctly relative to the grid.
    4.  **Create Basic Connector Shader (`ConnectorMaterial.js`):**
        *   **Uniforms:** `sampler2D u_stateTexture`, `vec2 u_gridDimensions`, `vec2 u_textureResolution`.
        *   **Vertex Shader:** Pass UVs (`vUv`) to fragment shader.
        *   **Fragment Shader:**
            *   Get UV: `vec2 uv = vUv;`
            *   Calculate continuous grid coord: `vec2 gridCoord = uv * u_gridDimensions;`
            *   Calculate integer cell coord: `ivec2 cell = ivec2(floor(gridCoord));`
            *   Sample the state texture for the *current* cell: `float state = texelFetch(u_stateTexture, cell, 0).r;` (Use `u_textureResolution` for bounds checking if needed).
            *   **Temporary Visualization:** `if (state == 1.0) { gl_FragColor = vec4(1.0, 0.0, 0.0, 0.5); } else { discard; }` (Draw red squares where circles are active).
    5.  Create the `shaderMaterial`, pass the `stateTexture` and dimension uniforms, set `transparent: true`, and apply it to the plane mesh. Update uniforms if grid dimensions/spacing change.
*   **Testing:** Activate some circles. Verify that semi-transparent red squares appear on the connector plane directly underneath the active circles. This confirms the texture sampling and coordinate mapping are working.

---

**Feature 7: Connector Rendering Logic (Shader)**

*   **Goal:** Implement the full connector drawing logic (Horizontal, Diagonal \, Diagonal /) in the connector fragment shader using SDFs and respecting geometric constraints.
*   **Dependencies:** Feature 1, Feature 5, Feature 6.
*   **Tasks:**
    1.  **Expand Connector Shader (`ConnectorMaterial.js`):**
        *   **Add Uniforms:** `u_radiusA`, `u_radiusB`, `u_gridSpacing`. Pass scaled values.
        *   **GLSL Helper Functions (Highly Recommended):**
            *   `sdCircle(vec2 p, float r)`: Returns distance from point `p` to circle radius `r` at origin.
            *   `sdBox(vec2 p, vec2 b)`: SDF for a 2D box with half-extents `b`.
            *   `sdSegment(vec2 p, vec2 a, vec2 b)`: SDF for a line segment from `a` to `b`.
            *   `opUnion(float d1, float d2)`: `min(d1, d2)`
            *   `opIntersection(float d1, float d2)`: `max(d1, d2)`
            *   `opSubtraction(float d1, float d2)`: `max(d1, -d2)`
            *   `getWorldPosFromUV(vec2 uv, vec2 planeSize)`: Convert plane UV to world coords.
            *   `getGridCellCenter(ivec2 cell, vec2 gridDimensions, float spacing)`: Get world coords of a cell center.
        *   **Fragment Shader Logic:**
            *   Get fragment's world position `fragWorldPos`.
            *   Get the `cell` the fragment is primarily associated with (`floor(gridCoord)`).
            *   **Sample Neighbors:** Fetch activation state for `cell` (BL), `cell + (1,0)` (BR), `cell + (0,1)` (TL), `cell + (1,1)` (TR). Handle texture boundaries. Let's call them `state_bl, state_br, state_tl, state_tr`.
            *   **Calculate Centers:** Get world positions for the centers of these 4 cells (`center_bl`, `center_br`, etc.).
            *   Initialize `finalSdf = 1e6;` (large positive number).
            *   **Horizontal (BL -> BR):**
                *   `if (state_bl == 1.0 && state_br == 1.0)`:
                    *   Calculate SDF for a horizontal rectangle (or capsule/thick segment) between `center_bl` and `center_br` with height `2.0 * u_radiusB`. Let this be `sdf_h`.
                    *   `finalSdf = opUnion(finalSdf, sdf_h);`
            *   **Diagonal \ (TL -> BR):**
                *   `if (state_tl == 1.0 && state_br == 1.0)`:
                    *   `sdf_outside_inner = opIntersection(sdCircle(fragWorldPos - center_tl, u_radiusB), sdCircle(fragWorldPos - center_br, u_radiusB));` (Must be outside both inner - SDF should be > 0).
                    *   `sdf_outside_outer_others = opIntersection(sdCircle(fragWorldPos - center_tr, u_radiusA), sdCircle(fragWorldPos - center_bl, u_radiusA));` (Must be outside other outer - SDF should be > 0).
                    *   `sdf_inside_bbox = sdBox(fragWorldPos - bboxCenter, bboxHalfSize);` (Define bounding box based on the 4 centers. SDF should be < 0).
                    *   `sdf_diag1_area = opIntersection(opIntersection(sdf_outside_inner, sdf_outside_outer_others), -sdf_inside_bbox);` (Intersection of all conditions. Positive means outside the valid region). Note the negation for inside bbox.
                    *   `finalSdf = opUnion(finalSdf, -sdf_diag1_area);` // We want to fill *inside* the valid area.
            *   **Diagonal / (BL -> TR):**
                *   Similar logic as Diag \, using `state_bl`, `state_tr` and relevant centers/radii, calculating `sdf_diag2_area`.
                *   `finalSdf = opUnion(finalSdf, -sdf_diag2_area);`
            *   **(Optional) Add other horizontal/vertical checks (e.g., TL -> TR).**
            *   **Final Output:**
                *   `if (finalSdf < 0.0)`: // If inside *any* valid connector region
                    *   `gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);` // Black connector
                *   `else`:
                    *   `discard;`
*   **Testing:** Activate various pairs and groups of circles.
    *   Verify horizontal connectors appear correctly between adjacent active circles.
    *   Verify diagonal connectors appear correctly between diagonally adjacent active circles.
    *   Verify the geometric constraints: connectors should visually clip against the inner radius of connected circles and the outer radius of non-connected circles within the 4-cell group.
    *   Test edge cases near grid boundaries. Use Storybook extensively to capture valid connector patterns. Use `leva` to tweak radii/spacing and ensure constraints hold.

---

**Feature 8: Connector Interaction & Rules**

*   **Goal:** Allow clicking on potential connector areas to cycle/toggle the connector *type* if the underlying circles are active, enforcing the rule that connectors cannot overlap.
*   **Dependencies:** Feature 4, Feature 7.
*   **Complexity Note:** This adds significant complexity compared to just rendering based on activation. It requires managing an additional state representing user *intent* for connectors, especially when multiple types might be possible (e.g., both diagonals).
*   **Approach:** Introduce a state variable to manage the 'active' connector type for the central 2x2 area being considered by the shader/interaction. Let's simplify for the 2x2 case shown in the original code, acknowledging this specific interaction model doesn't scale well *conceptually* to N x N without defining interaction zones more rigorously. *We will focus on implementing the cycling behavior for a specific 2x2 area first, as a proof-of-concept for the interaction pattern.* Adapting this precisely to N x N requires defining how clicks map to specific connector *instances*. A simpler N x N approach might forgo direct connector clicking.

    *(Alternative N x N approach: Clicking a connector area *only works if exactly one* connector type is possible based on activation state. If multiple are possible (e.g., both Diag \ and Diag /), the click does nothing, forcing the user to deactivate circles to resolve ambiguity. This avoids extra state but sacrifices the cycling requirement.)*

    **Let's proceed with implementing the cycling logic, assuming we can identify the relevant 2x2 group from a click:**
*   **Tasks:**
    1.  **Connector Intent State:** Add a React state variable, perhaps focused on a specific central region for now, or potentially an array/object mapping grid locations to intended connector types. For simplicity, let's reuse the original `activeConnector` state concept (0: none, 1: Diag\, 2: Diag/, 3: HorizTop, 4: HorizBottom) *but* derive its possibility from `activationState`.
        ```javascript
        // Example state (may need refinement for N x N)
        const [intendedConnector, setIntendedConnector] = useState(0);
        ```
    2.  **Update Connector Shader:**
        *   Add `uniform int u_intendedConnector;`.
        *   Modify the final SDF combination logic:
            *   Calculate potential SDFs for all types (`sdf_h_bl_br`, `sdf_h_tl_tr`, `sdf_diag1`, `sdf_diag2`) as before *based only on activation*.
            *   Now, *selectively* contribute to `finalSdf` based on `u_intendedConnector`.
            *   Example: `if (u_intendedConnector == 1 && state_tl == 1.0 && state_br == 1.0) { finalSdf = opUnion(finalSdf, -sdf_diag1_area); }`
            *   Similarly for other types (2: Diag /, 3: Horiz Top (TL-TR), 4: Horiz Bottom (BL-BR)). If `u_intendedConnector == 0`, `finalSdf` remains large positive (no connectors drawn by intent).
    3.  **Click Handler on Connector Plane:** Add `onClick={handleConnectorClick}` to the connector plane mesh.
    4.  **Implement `handleConnectorClick`:**
        *   `event.stopPropagation();`
        *   Get click `point` (world space).
        *   **Determine Clicked Area:** This is the hard part for N x N. For a 2x2 prototype: Calculate distance/position relative to the 4 grid cell centers. Determine if the click falls primarily within the bounding box for HorizTop, HorizBottom, Diag \, or Diag /. Use the helper functions from the original code (`isPointInHorizontalConnectorArea`, `isPointInConnectorArea`) adapted for the current geometry and coordinate system.
        *   **Get Relevant Activation States:** Sample `activationState` for the 4 relevant cells (e.g., TL, TR, BL, BR).
        *   **Implement Cycling/Toggling Logic (Example for Diagonal Area Click):**
            *   `bool possibleDiag1 = state_tl && state_br;`
            *   `bool possibleDiag2 = state_bl && state_tr;`
            *   `bool currentIsDiag1 = intendedConnector === 1;`
            *   `bool currentIsDiag2 = intendedConnector === 2;`
            *   **Rule Check:** Cannot enable a diagonal if it conflicts with an existing *horizontal* intent using the same points (e.g., if `intendedConnector` is 3 or 4). Add checks for this.
            *   If click in diagonal area:
                *   If `possibleDiag1 && possibleDiag2`: Cycle `0 -> 1 -> 2 -> 0`. `setIntendedConnector(prev => (prev === 0 ? 1 : (prev === 1 ? 2 : 0)));`
                *   Else if `possibleDiag1`: Toggle `0 -> 1 -> 0`. `setIntendedConnector(prev => (prev === 1 ? 0 : 1));`
                *   Else if `possibleDiag2`: Toggle `0 -> 2 -> 0`. `setIntendedConnector(prev => (prev === 2 ? 0 : 2));`
                *   Else: `setIntendedConnector(0);`
        *   **Implement Logic for Horizontal Area Click:**
            *   Determine if top or bottom row area was clicked.
            *   Check activation state for the two horizontal endpoints.
            *   **Rule Check:** Cannot enable horizontal if a *diagonal* intent uses one of its endpoints (e.g., cannot enable HorizTop if `intendedConnector` is 1 or 2).
            *   If valid: Toggle the corresponding state (e.g., `0 -> 3 -> 0` or `0 -> 4 -> 0`).
    5.  **Ensure State Coherence:** When a circle is *deactivated* (Feature 4), check if it invalidates the `intendedConnector`. If so, reset `intendedConnector` to 0.
        ```javascript
        // Inside Feature 4's circle click handler, after state update:
        if (!newActivationValue) { // If circle was turned OFF
            // Check if intendedConnector relies on this circle index
            // If so, setIntendedConnector(0);
        }
        ```
*   **Testing:** This requires careful interactive testing.
    *   Activate necessary circles. Click between them in diagonal/horizontal areas. Verify the correct connector appears/disappears based on the cycling/toggling rules.
    *   Verify the overlap prevention: Activate all 4 circles. Cycle through diagonals. Then try clicking horizontal areas – it should do nothing. Clear intent (`setIntendedConnector(0)`), activate a horizontal, then try clicking diagonal areas – it should do nothing if it conflicts.
    *   Verify deactivating a circle correctly removes the associated connector intent. Use Storybook to capture states representing each `intendedConnector` value.

---

**Feature 9: Refinement & Optimization**

*   **Goal:** Clean up code, optimize shaders and performance, add final touches.
*   **Dependencies:** All previous features.
*   **Tasks:**
    1.  **Code Review:** Refactor code for clarity, remove unused variables/code, add comments. Organize into custom hooks or components where logical.
    2.  **Shader Optimization:** Review GLSL code for efficiency. Minimize calculations per fragment, use `smoothstep` for anti-aliasing SDF edges instead of sharp cutoffs (`if (sdf < 0.0)` -> `smoothstep(0.0, fwidth(sdf) * 1.5, -sdf)`).
    3.  **Performance Profiling:** For large grids, use browser dev tools and React/WebGL profilers (e.g., Spector.js) to identify bottlenecks. Check CPU usage (state updates, matrix calculations) and GPU usage (shader complexity, draw calls).
    4.  **Parameterization:** Ensure all key values (colors, radii ratios, grid defaults) are easily configurable, perhaps via props or a context.
    5.  **Final Visual Polish:** Adjust colors, line widths (via SDF thickness), and ensure consistent look and feel.
*   **Testing:** Final round of visual regression testing. Performance testing on target devices/browsers with large grid sizes. Manual testing of all interactions.

---

This plan provides a structured approach. Each feature prompt details the specific requirements and technical considerations, guiding the LLM developer step-by-step while incorporating testing checkpoints to build assurance along the way. Remember that the Connector Interaction (Feature 8) is the most complex and may require iterative refinement, especially when scaling the interaction model beyond a fixed 2x2 prototype.


in the folder old_webgl_attempt there is a previous attempt at this that went all wonky and was not designed for efficiency or scale but the connectors at least "looked" approrpiate. so when the time comes you may refer to how they did it. 

specifically for the diagonal connectors as referenced before"there are 3 connector types diagonal \ diagonal / and horizontal. the construction of the diagonal connectors are VERY particularly important. they are made of an area that is a. outside the two inner circles that they connect
b. outside the two OUTER circles that they are not connecting
c. inside a bounding box that does not extend past the center points of the 4 cirlces that they are in between.
d. at a layer under the circles."

keep in mind the following was an assessment of that attempt:

Good:
Using react-three-fiber (R3F) is great for managing WebGL in React.
Using InstancedMesh for the circles is the right approach for performance when dealing with many similar objects.
Using custom shaders (ConnectorMaterial, GridConnectorMaterial, SimpleConnectorMaterial) is necessary for the specific rendering requirements (circles, complex connector shapes).
Using leva for controls is helpful for development.
Bad (Scalability Blockers):
GRID_SIZE = 2: Hardcoded everywhere. This needs to be a variable/parameter.
gridState Array (2x2): Doesn't scale. Managing a 100x100 nested array in React state with deep copies on update will be slow.
activeConnector State: This state (0-4) is a specific workaround for the limited connection possibilities in a 2x2 grid. It doesn't generalize to N x N where many connectors could exist simultaneously. The visual state of the connectors should emerge directly from the activation state of the circles.
gridStateTexture (2x2): Tied to the grid size. Needs to be dynamically sized.
Click Handling Logic: isPointInConnectorArea, handleHorizontalConnectorClick, handleDiagonalConnectorCycle are all built around the 2x2 assumption and the activeConnector state. Clicking should only toggle circle activation; the connectors should update automatically based on that.
Connector Shaders (GridConnectorMaterial, SimpleConnectorMaterial): They likely rely heavily on the non-scalable u_activeConnector uniform and the 2x2 u_gridState texture. They will need significant rewrites