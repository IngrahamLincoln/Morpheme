Okay, let's dive deep and create a detailed, step-by-step refactoring plan. This plan leverages the holistic view of your code and aims for an iterative process where you can test functionality at each stage. We'll break down the monolithic `GridScene` and build towards the modular, data-driven architecture discussed previously.

**Assumptions:**

*   We'll use **Zustand** for state management due to its simplicity and performance. You'll need to install it (`npm install zustand` or `yarn add zustand`).
*   We'll aim to eliminate Leva controls from the core rendering/state logic, moving necessary controls (like visual scale) potentially to `AppController` or replacing editor controls with standard UI buttons/inputs.
*   The primary goal is to make the system scalable and extensible for complex UI elements.

---

**Phase 0: Preparation & Cleanup**

*   **Goal:** Standardize constants and improve type safety before major changes.
*   **Risk:** Low.

1.  **Step 0.1: Consolidate Constants**
    *   **File:** `components/constants.ts`
    *   **Action:** Review `GridScene.tsx`, `GridViewer.tsx`, `CircleMaterial.tsx`, `ConnectorMaterial.tsx`, `CmdHorizConnectorMaterial.tsx`. Ensure *all* numeric constants related to rendering logic (radii, spacing, connector types) are defined *only* in `constants.ts` and imported where needed. Remove any duplicate definitions within components.
    *   **Check:** Verify `FIXED_SPACING`, `BASE_RADIUS_A`, `BASE_RADIUS_B`, and all `CONNECTOR_` types are solely defined here.
    *   **Test:** The application should function exactly as before.

2.  **Step 0.2: Improve Typing**
    *   **Files:** `GridScene.tsx`, `GridViewer.tsx`, `CircleMaterial.tsx`, `ConnectorMaterial.tsx`, `CmdHorizConnectorMaterial.tsx`, `AppController.tsx`
    *   **Action:** Replace instances of `any` with more specific types where possible.
        *   For material refs (`materialRef`, `connectorMaterialRef`, etc.), define interfaces for their expected uniforms and methods if possible, or use `React.RefObject<THREE.ShaderMaterial & { uniforms: { ... } }>`.
        *   For event handlers (`handleCircleClick`, etc.), use `THREE.Intersection` or related event types from R3F/Three.js if available/accurate for instanced mesh clicks.
    *   **Goal:** Better type safety and code clarity.
    *   **Test:** The application compiles without Typescript errors and functions as before.

---

**Phase 1: Core State & Rendering Refactor**

*   **Goal:** Establish the central `GridStateStore`, separate rendering logic into `GridRenderer`, and unify shaders to use a single state texture. This is the most significant architectural change.
*   **Risk:** High. Functionality will break temporarily between steps. Test carefully after each step.

1.  **Step 1.1: Create `GridStateStore`**
    *   **File:** Create `components/GridStateStore.ts`
    *   **Action:**
        *   Install Zustand: `npm install zustand`
        *   Define the store structure using `create`:
            ```typescript
            import create from 'zustand';
            import * as THREE from 'three'; // If needed for types

            // Define distinct state values
            export const CELL_STATE_EMPTY = 0;
            export const CELL_STATE_ACTIVE = 1;
            // Add more later for text, buttons, etc.
            // Example:
            // export const CELL_STATE_TEXT = 100;
            // export const CELL_STATE_BUTTON = 200;
            // Example state for cmd-horiz links (needs careful thought - see Step 1.7)
            export const CELL_STATE_ACTIVE_CMD_HORIZ_LEFT = 2; // Active circle that STARTS a cmd-horiz link to its right
            
            interface GridState {
              gridWidth: number;
              gridHeight: number;
              gridData: Uint16Array | null; // Using Uint16 for flexibility later
              setGridSize: (width: number, height: number) => void;
              initializeGrid: () => void; // Helper to create/reset gridData
              setCell: (x: number, y: number, value: number) => void;
              getCell: (x: number, y: number) => number;
              getGridData: () => Uint16Array | null;
              // Add more actions later: setRegion, loadState, saveState, toggleCell, toggleCmdHorizLink
            }

            const useGridStore = create<GridState>((set, get) => ({
              gridWidth: 10, // Default initial size
              gridHeight: 10,
              gridData: null,

              setGridSize: (width, height) => {
                console.log(`Store: Setting grid size to ${width}x${height}`);
                set({ gridWidth: width, gridHeight: height });
                get().initializeGrid(); // Re-initialize gridData when size changes
              },

              initializeGrid: () => {
                const { gridWidth, gridHeight } = get();
                if (gridWidth > 0 && gridHeight > 0) {
                  console.log(`Store: Initializing grid data (${gridWidth}x${gridHeight})`);
                  const size = gridWidth * gridHeight;
                  set({ gridData: new Uint16Array(size).fill(CELL_STATE_EMPTY) });
                } else {
                  set({ gridData: null });
                }
              },

              setCell: (x, y, value) => {
                set(state => {
                  if (!state.gridData || x < 0 || x >= state.gridWidth || y < 0 || y >= state.gridHeight) {
                    console.warn(`Store: setCell(${x}, ${y}) out of bounds or grid not initialized.`);
                    return {}; // No change
                  }
                  const index = y * state.gridWidth + x;
                  // Only create new array if value actually changes
                  if (state.gridData[index] !== value) {
                    const newGridData = new Uint16Array(state.gridData); // Create copy
                    newGridData[index] = value;
                    // console.log(`Store: Setting cell (${x}, ${y}) index ${index} to ${value}`);
                    return { gridData: newGridData };
                  }
                  return {}; // No change needed
                });
              },

              getCell: (x, y) => {
                const { gridData, gridWidth, gridHeight } = get();
                if (!gridData || x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
                  return CELL_STATE_EMPTY; // Treat out-of-bounds as empty
                }
                const index = y * gridWidth + x;
                return gridData[index];
              },
              
              getGridData: () => get().gridData,

            }));
            
            // Initialize grid on load
            useGridStore.getState().initializeGrid();

            export default useGridStore;
            ```
    *   **Goal:** Central store defined with basic state and actions.
    *   **Test:** Import `useGridStore` in `AppController` or `GridScene` and log its state. Call actions from the console.

2.  **Step 1.2: Connect Store to Dimensions (Leva/`AppController`)**
    *   **Files:** `GridScene.tsx` (temporarily), `AppController.tsx`
    *   **Action:**
        *   In `GridScene` (or where Leva controls are defined):
            *   Import `useGridStore`.
            *   Read `gridWidth` and `gridHeight` from the store: `const { gridWidth, gridHeight, setGridSize } = useGridStore();`
            *   Replace Leva's `GRID_WIDTH`, `GRID_HEIGHT` control `value` with `gridWidth`, `gridHeight`.
            *   Update Leva's `onChange` or similar handlers (if any) to call `setGridSize(newWidth, newHeight)`. *Remove* the direct `useState` or Leva state management for these dimensions.
        *   In `AppController`: If `AppController` handles loading data (like `loadPatternFromFile`), make sure it calls `useGridStore.getState().setGridSize(parsedData.gridWidth, parsedData.gridHeight)` *before* processing nodes/edges.
    *   **Goal:** Grid dimensions are controlled solely by the Zustand store. Leva/AppController interacts with the store.
    *   **Test:** Changing dimensions via Leva (if still used) or loading a file updates the store. The grid dimensions used by `GridScene`'s `useMemo` for `TOTAL_CIRCLES` should now reflect the store's values. The visual grid size should update.

3.  **Step 1.3: Migrate Activation State to Store**
    *   **File:** `GridScene.tsx`
    *   **Action:**
        *   Remove the `activationState` `useState`.
        *   Remove the `useEffect` that resets `activationState` when `TOTAL_CIRCLES` changes (the store's `setGridSize` handles re-initialization).
        *   In `handleCircleClick` (still temporarily here):
            *   Get `getCell` and `setCell` from `useGridStore`.
            *   Read the current state using `currentState = getCell(x, y)`.
            *   Write the new state using `setCell(x, y, newState)`. The new state should be `CELL_STATE_ACTIVE` (1) or `CELL_STATE_EMPTY` (0).
        *   In the `InstancedMesh` setup for `<planeGeometry>`:
            *   Remove the `activationAttributeRef`.
            *   Remove the `<instancedBufferAttribute ... attach="attributes-a_activated">`. We will pass state via texture later.
        *   In `CircleMaterial.tsx`: Remove the `attribute float a_activated;` and `varying float v_activated;`. The vertex shader becomes simpler. The fragment shader will temporarily break as it still uses `v_activated`.
        *   Update the `saveGridStateWithDirectValues` and load logic to read/write activation from/to the store's `gridData` instead of the old `activationState` array or buffer attribute. Use `getCell` and `setCell`.
    *   **Goal:** Circle activation state is managed solely by the store's `gridData`. Click logic interacts with the store. Removed direct buffer attribute for activation.
    *   **Test:** Clicking circles should update the `gridData` in the store (verify with console logs). Circle rendering will be broken (all look inactive) because the shader no longer gets activation data. Save/load should correctly store/restore the activation pattern in the store's `gridData`.

4.  **Step 1.4: Create `GridRenderer` Component**
    *   **File:** Create `components/GridRenderer.tsx`. Modify `GridScene.tsx`.
    *   **Action:**
        *   Create `GridRenderer.tsx`.
        *   **Move from `GridScene` to `GridRenderer`:**
            *   The `useMemo` calculation for `TOTAL_CIRCLES`, `centerOffset`, `planeWidth`, `planeHeight`, `currentSpacing`. This `useMemo` should now depend on `gridWidth`, `gridHeight` from the store and a `visualScale` prop passed to `GridRenderer`.
            *   The `meshRef` (for circles) and the `InstancedMesh` JSX.
            *   The `connectorMaterialRef`, `cmdHorizMaterialRef` and the *two* connector plane `mesh` JSX elements.
            *   Helper functions needed for rendering: `getCoords`, `getCenterOffset`, `getWorldPosition`.
        *   **In `GridRenderer`:**
            *   Import `useGridStore` and get `gridWidth`, `gridHeight`, `getGridData`.
            *   Accept `visualScale` as a prop: `interface GridRendererProps { visualScale: number; }`.
            *   Use store data and `visualScale` prop in the `useMemo`.
            *   Render the `InstancedMesh` and the two connector planes.
        *   **In `GridScene`:**
            *   Render `<GridRenderer visualScale={controls.visualScale} />`.
            *   Remove the moved JSX and `useMemo`. `GridScene` becomes much smaller, mainly handling interaction logic (for now) and Leva controls.
    *   **Goal:** Separate the rendering responsibilities into a dedicated component driven by store state and props.
    *   **Test:** `GridRenderer` should mount. `GridScene` should render `GridRenderer`. Circle instances should be created with correct positions/scaling based on store dimensions and `visualScale` prop. Visuals are still broken (circles inactive, connectors not working).

5.  **Step 1.5: Create and Use Unified State Texture (`u_gridStateTexture`)**
    *   **File:** `components/GridRenderer.tsx`
    *   **Action:**
        *   Inside `GridRenderer`, create the state texture:
            ```typescript
            const stateTexture = useMemo(() => {
              const { gridWidth, gridHeight } = useGridStore.getState(); // Read latest size
              if (!gridWidth || !gridHeight) return null;

              const texture = new THREE.DataTexture(
                new Uint16Array(gridWidth * gridHeight), // Use Uint16Array
                gridWidth,
                gridHeight,
                THREE.RedFormat, // Store state in red channel
                THREE.UnsignedShortType // Match Uint16Array
                // Note: WebGL 2 is required for integer textures (UnsignedShortType).
                // If only WebGL 1 is available, you might need to use FloatType
                // and normalize/denormalize values in the shader, or pack data differently.
              );
              texture.minFilter = THREE.NearestFilter;
              texture.magFilter = THREE.NearestFilter;
              texture.needsUpdate = true;
              console.log(`Renderer: Created state texture ${gridWidth}x${gridHeight}`);
              return texture;
            }, [useGridStore(state => state.gridWidth), useGridStore(state => state.gridHeight)]); // Recreate if size changes

            // Update texture data when gridData changes
            useEffect(() => {
              const gridData = useGridStore.getState().getGridData();
              if (stateTexture && gridData && gridData.length === stateTexture.image.data.length) {
                (stateTexture.image.data as Uint16Array).set(gridData);
                stateTexture.needsUpdate = true;
                // console.log('Renderer: Updated state texture data.');
              } else if (stateTexture && gridData) {
                 console.warn('Renderer: Mismatch between gridData length and texture size. Texture update skipped.');
              }
            }, [useGridStore(state => state.gridData), stateTexture]); // Depend on gridData state
            ```
        *   Pass `stateTexture` as a uniform (`u_gridStateTexture`) to the `circleMaterial`, `connectorMaterial`, and `cmdHorizConnectorMaterial` (for now). Ensure the material definitions accept this new uniform.
    *   **Goal:** A single data texture representing the entire grid state is created and passed to all materials.
    *   **Test:** The texture should be created and updated when the store's `gridData` changes (verify with logs). No visual change yet.

6.  **Step 1.6: Update `CircleMaterial` Shader**
    *   **File:** `components/CircleMaterial.tsx`
    *   **Action:**
        *   Add `u_gridStateTexture`, `u_gridDimensions`, `u_textureResolution` (can be same as gridDimensions if 1 pixel = 1 cell), `u_worldCellSize` (calculated from `visualScale * FIXED_SPACING`), `u_centerOffset` uniforms to the `shaderMaterial` definition.
        *   **Vertex Shader:** Can remain simple (pass `vUv`).
        *   **Fragment Shader:**
            *   Remove `varying float v_activated;`.
            *   Calculate the integer grid coordinates `ivec2 cellCoord` for the current fragment based on `vUv`, `u_planeSize` (size of the instance plane, likely `vec2(1.0)`), instance world position (implicit via `instanceMatrix`), `u_centerOffset`, `u_worldCellSize`. This calculation needs care to map fragment UV to the correct grid cell index. *Alternatively, simpler approach for instanced circles:* Pass the cell coordinates `(x, y)` as another instanced attribute.
            *   Sample the state: `float state = texelFetch(u_gridStateTexture, cellCoord, 0).r;` (Adjust sampling if using `FloatType`).
            *   Modify the rendering logic:
                ```glsl
                // ... (calculate dist)
                // Discard if outside the outer circle
                if (dist > u_radiusA) {
                    discard;
                }

                // Sample state (assuming cellCoord is correctly calculated)
                // Use texelFetch for precise lookup with integer coords
                ivec2 texSize = textureSize(u_gridStateTexture, 0);
                ivec2 clampedCoord = clamp(cellCoord, ivec2(0), texSize - ivec2(1));
                float stateValue = 0.0;
                if (cellCoord == clampedCoord) {
                   // Read the state - adjust for texture type
                   // If UnsignedShortType:
                   uint uState = texelFetch(u_gridStateTexture, cellCoord, 0).r;
                   stateValue = float(uState);
                   // If FloatType:
                   // stateValue = texelFetch(u_gridStateTexture, cellCoord, 0).r;
                }


                // Render based on state
                if (stateValue >= float(CELL_STATE_ACTIVE)) { // Treat ACTIVE and potentially higher states as 'on'
                    // If activated, only draw the inner circle (black)
                    if (dist <= u_radiusB) {
                        gl_FragColor = vec4(u_innerColorActive, 1.0);
                    } else {
                        discard; // Make outer ring transparent when activated
                    }
                } else {
                    // Not activated - draw both inner and outer circles (inactive style)
                    if (dist > u_radiusB) {
                        gl_FragColor = vec4(u_outerColor, 1.0);
                    } else {
                        gl_FragColor = vec4(u_innerColorEmpty, 1.0);
                    }
                }
                ```
        *   In `GridRenderer.tsx`, pass the corresponding uniforms (`u_gridDimensions`, `u_worldCellSize`, etc.) to the `circleMaterial`.
    *   **Goal:** Circles render their active/inactive state based *only* on sampling the `u_gridStateTexture`. `a_activated` attribute is gone.
    *   **Test:** Circles should now render correctly again, reflecting the state in `useGridStore`. Clicking toggles their appearance.

7.  **Step 1.7: Unify Connector Shaders (`UnifiedConnectorMaterial`)**
    *   **File:** Create `components/UnifiedConnectorMaterial.tsx`. Delete `components/ConnectorMaterial.tsx`, `components/CmdHorizConnectorMaterial.tsx`. Modify `components/GridRenderer.tsx`.
    *   **Action:**
        *   Create `UnifiedConnectorMaterial.tsx`. Define a `shaderMaterial` similar to the old ones.
        *   **Uniforms:** Include `u_gridStateTexture`, `u_gridDimensions`, `u_textureResolution`, `u_radiusA`, `u_radiusB`, `u_gridSpacing` (visual scale), `u_fixedSpacing`, `u_centerOffset`, `u_planeSize`.
        *   **Vertex Shader:** Simple pass-through `vUv`.
        *   **Fragment Shader:**
            *   Combine logic from *both* old connector shaders.
            *   Calculate fragment world position (`fragWorldPos`).
            *   Calculate the base cell coordinates (`cell_bl`, `cell_br`, `cell_tl`, `cell_tr`) surrounding the fragment.
            *   **Sample all 4 neighbours from `u_gridStateTexture`**. Get their `uint state_bl, state_br, state_tl, state_tr`.
            *   **Decision Logic (Crucial Part):** Based *only* on these 4 state values, determine which connectors to draw.
                ```glsl
                // Example Logic (Adapt state values as needed)
                float finalSdf = 1e6; // Initialize to "outside"

                // Diagonal \\ (TL to BR)
                // Condition: TL is active AND BR is active
                if (state_tl >= uint(CELL_STATE_ACTIVE) && state_br >= uint(CELL_STATE_ACTIVE)) {
                   // Optional: Add check to prevent diagonal if cmd-horiz exists?
                   // bool blocked_by_cmd_horiz = (state_tl == uint(CELL_STATE_ACTIVE_CMD_HORIZ_LEFT)) || ...
                   // if (!blocked_by_cmd_horiz) {
                      float sdf_diag1 = sdCapsule(fragWorldPos, center_tl, center_br, worldRadiusB);
                      // Add subtractions for other circle intersections if needed
                      finalSdf = min(finalSdf, sdf_diag1);
                   // }
                }

                // Diagonal / (BL to TR)
                if (state_bl >= uint(CELL_STATE_ACTIVE) && state_tr >= uint(CELL_STATE_ACTIVE)) {
                   float sdf_diag2 = sdCapsule(fragWorldPos, center_bl, center_tr, worldRadiusB);
                   finalSdf = min(finalSdf, sdf_diag2);
                }

                // Horizontal Bottom (BL to BR)
                if (state_bl >= uint(CELL_STATE_ACTIVE) && state_br >= uint(CELL_STATE_ACTIVE)) {
                   float sdf_h_bottom = sdCapsule(fragWorldPos, center_bl, center_br, worldRadiusB);
                   finalSdf = min(finalSdf, sdf_h_bottom);
                }
                
                // Horizontal Top (TL to TR)
                 if (state_tl >= uint(CELL_STATE_ACTIVE) && state_tr >= uint(CELL_STATE_ACTIVE)) {
                   float sdf_h_top = sdCapsule(fragWorldPos, center_tl, center_tr, worldRadiusB);
                   finalSdf = min(finalSdf, sdf_h_top);
                }

                // Cmd-Horizontal Connector (Using CELL_STATE_ACTIVE_CMD_HORIZ_LEFT)
                // Check the state of the *left* cell in a potential horizontal pair
                // We need to check pairs potentially starting in cell_bl OR cell_tl position
                
                // Check pair starting at cell_bl (Connects cell_bl to cell_br)
                if (state_bl == uint(CELL_STATE_ACTIVE_CMD_HORIZ_LEFT) && state_br >= uint(CELL_STATE_ACTIVE)) {
                    // Calculate SDF for a horizontal rectangle/box between center_bl and center_br
                    float sdf_cmd_horiz_bl = sdBox2D(fragWorldPos - (center_bl + center_br) * 0.5, vec2(worldSpacing * 0.5, worldRadiusB));
                    finalSdf = min(finalSdf, sdf_cmd_horiz_bl);
                }
                // Check pair starting at cell_tl (Connects cell_tl to cell_tr)
                 if (state_tl == uint(CELL_STATE_ACTIVE_CMD_HORIZ_LEFT) && state_tr >= uint(CELL_STATE_ACTIVE)) {
                    float sdf_cmd_horiz_tl = sdBox2D(fragWorldPos - (center_tl + center_tr) * 0.5, vec2(worldSpacing * 0.5, worldRadiusB));
                    finalSdf = min(finalSdf, sdf_cmd_horiz_tl);
                }

                // Final Output (smooth alpha based on finalSdf)
                // ... (same as before)
                ```
            *   **State Representation for Cmd-Horiz:** Decide how to store this. Option 1 (used in example): Give the *left* cell of a cmd-horiz pair a special state (e.g., `CELL_STATE_ACTIVE_CMD_HORIZ_LEFT = 2`). The shader checks if `state_bl == 2 && state_br == 1`. Option 2: Use a separate bit in the `Uint16Array`? Option 3: Have `toggleCmdHorizLink` set *both* linked cells to a special state? Option 1 seems feasible.
        *   **In `GridRenderer.tsx`:**
            *   Remove the two old connector meshes.
            *   Add *one* mesh using `<unifiedConnectorMaterial ... />`. Pass the `u_gridStateTexture` and other necessary uniforms.
            *   Delete the imports for `ConnectorMaterial` and `CmdHorizConnectorMaterial`.
        *   **In `GridScene.tsx`:**
            *   Remove the `intendedConnectors` and `cmdHorizConnectors` `useState`.
            *   Remove the `intendedConnectorsRef` and `cmdHorizConnectorsRef`.
            *   Remove the `useEffect` hooks that update/depend on these states (like the one that clears connectors when a circle deactivates, or updates textures).
            *   Remove the `handleConnectorClick` logic entirely (we'll handle interaction differently later).
            *   Update `handleCircleClick`'s cmd-click logic: Instead of toggling `cmdHorizConnectors` state, it should call a *new store action* like `store.toggleCmdHorizLink(x, y)`. This action will update the state of the cell at `(x, y)` (and potentially `(x+1, y)`) in `gridData` using the chosen representation (e.g., set `gridData[y*width+x]` to `CELL_STATE_ACTIVE_CMD_HORIZ_LEFT` or back to `CELL_STATE_ACTIVE`).
        *   **In `GridStateStore.ts`:** Add the `toggleCmdHorizLink(x, y)` action implementing the state change logic.
    *   **Goal:** Single connector material/shader/plane driven *only* by `u_gridStateTexture`. Removed all separate connector state management and textures. Cmd-click logic now updates the main state store.
    *   **Test:** All types of connectors (diagonals, standard horizontals, cmd-horiz horizontals) should now render correctly based purely on the states of adjacent cells in the `gridData` array within the Zustand store. Clicking circles activates/deactivates them; cmd-clicking active adjacent circles should toggle the cmd-horiz visual state by changing the cell state value(s) in the store. `GridScene` is significantly simpler. Save/load needs updating to handle the new state representation if cmd-horiz uses special values.

8.  **Step 1.8: Refine Visual Scale Handling**
    *   **Files:** `GridRenderer.tsx`, `UnifiedConnectorMaterial.tsx`, `CircleMaterial.tsx`, `AppController.tsx` (or wherever scale control lives)
    *   **Action:**
        *   Decide: Does `visualScale` control camera zoom or world size? Let's assume world size for consistency with current setup.
        *   In `GridRenderer`: Calculate `worldCellSize = FIXED_SPACING * visualScale`. Pass `u_worldCellSize` (or similar name like `u_scaledSpacing`) and `u_gridSpacing` (the `visualScale` itself might still be useful) to shaders. Also pass correctly scaled `u_radiusA_world = BASE_RADIUS_A * visualScale` and `u_radiusB_world = BASE_RADIUS_B * visualScale` if shaders need world-space radii.
        *   In `GridRenderer`: Ensure `InstancedMesh` instances always have scale `(1, 1, 1)`. Remove any logic that tries to scale instances based on `visualScale`. The size comes from the spacing used in `getWorldPosition` and the shader rendering correctly within its unit plane.
        *   In Shaders (`CircleMaterial`, `UnifiedConnectorMaterial`): Ensure all calculations involving distances, radii, capsule sizes, box sizes use consistent world-space units derived from the passed uniforms (`u_worldCellSize`, `u_radiusA_world`, `u_radiusB_world`, etc.). Do not rely on scaling the instance matrix. `BASE_RADIUS_A/B` uniforms in the shader should probably represent radii relative to the unit plane size (0.0-0.5), while world-space calculations use the scaled uniform values.
    *   **Goal:** Consistent visual scaling controlled by `visualScale` prop, applied correctly in world-space calculations and shaders, not by scaling instances.
    *   **Test:** Adjusting the `visualScale` slider in `AppController` should smoothly zoom the grid in/out without distorting the circle/connector shapes or their relative positions/overlap. Interactions should still hit the correct cells.

---

**Phase 2: Interaction Refactor**

*   **Goal:** Decouple input handling from `GridScene` and rendering components.
*   **Risk:** Medium.

1.  **Step 2.1: Create `InteractionManager`**
    *   **File:** Create `components/InteractionManager.tsx`. Modify `GridScene.tsx` (or main App component).
    *   **Action:**
        *   Create `InteractionManager.tsx` as a component that renders `null` but attaches event listeners.
            ```typescript
            import React, { useCallback } from 'react';
            import { useThree, useFrame } from '@react-three/fiber';
            import * as THREE from 'three';
            import useGridStore, { CELL_STATE_EMPTY, CELL_STATE_ACTIVE, CELL_STATE_ACTIVE_CMD_HORIZ_LEFT } from './GridStateStore';
            import { FIXED_SPACING } from './constants'; // Assuming visualScale is handled by camera/uniforms now

            interface InteractionManagerProps {
              visualScale: number; // Needed for coord conversion if not using camera zoom only
            }

            const InteractionManager: React.FC<InteractionManagerProps> = ({ visualScale }) => {
              const { camera, size, scene } = useThree();
              const { getCell, setCell, toggleCmdHorizLink, gridWidth, gridHeight } = useGridStore(); // Get store actions

              const getGridCoordsFromEvent = useCallback((event: PointerEvent): { x: number; y: number } | null => {
                const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
                const mouse = new THREE.Vector2(
                  ((event.clientX - rect.left) / rect.width) * 2 - 1,
                  -((event.clientY - rect.top) / rect.height) * 2 + 1
                );

                // Assuming OrthographicCamera - adjust if perspective
                if (!(camera instanceof THREE.OrthographicCamera)) return null;

                const vec = new THREE.Vector3(mouse.x, mouse.y, -1).unproject(camera);
                const dir = vec.sub(camera.position).normalize();
                const distance = -camera.position.z / dir.z; // Assuming grid is at z=0
                const worldPos = camera.position.clone().add(dir.multiplyScalar(distance));

                // Convert world coords to grid coords (needs center offset calculation)
                // Note: Center offset depends on visualScale! Recalculate or get from store/prop.
                const scaledSpacing = FIXED_SPACING * visualScale;
                const totalWorldWidth = (gridWidth - 1) * scaledSpacing;
                const totalWorldHeight = (gridHeight - 1) * scaledSpacing;
                const centerOffsetX = -totalWorldWidth / 2;
                const centerOffsetY = -totalWorldHeight / 2;

                const gridX = Math.round((worldPos.x - centerOffsetX) / scaledSpacing);
                const gridY = Math.round((worldPos.y - centerOffsetY) / scaledSpacing);

                if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                  return { x: gridX, y: gridY };
                }
                return null;

              }, [camera, size, gridWidth, gridHeight, visualScale]);

              const handlePointerDown = useCallback((event: PointerEvent) => {
                event.preventDefault(); // Prevent default browser actions like text selection
                const coords = getGridCoordsFromEvent(event);
                if (!coords) return;

                const { x, y } = coords;
                const isCmdClick = event.metaKey || event.ctrlKey;

                console.log(`Interaction: Click at grid (${x}, ${y}), Cmd: ${isCmdClick}`);

                if (isCmdClick) {
                  // Attempt to toggle cmd-horiz link (store action handles validation)
                   if (x < gridWidth - 1) { // Check if not on the rightmost edge
                      // We need the store action to check if both cells are active
                      useGridStore.getState().toggleCmdHorizLink(x, y);
                   }
                } else {
                  // Regular click: Toggle basic activation
                  const currentState = getCell(x, y);
                  const newState = currentState === CELL_STATE_EMPTY ? CELL_STATE_ACTIVE : CELL_STATE_EMPTY;
                  setCell(x, y, newState);
                }

              }, [getGridCoordsFromEvent, getCell, setCell, toggleCmdHorizLink, gridWidth]);

              // Attach listener to canvas
              useEffect(() => {
                const canvas = scene.userData.gl?.domElement; // Access internal canvas reference
                if (canvas) {
                    canvas.addEventListener('pointerdown', handlePointerDown);
                    return () => canvas.removeEventListener('pointerdown', handlePointerDown);
                }
              }, [handlePointerDown, scene.userData.gl]);


              return null; // This component doesn't render anything itself
            };

            export default InteractionManager;
            ```
        *   **In `GridScene.tsx`:** Remove the `handleCircleClick` function and its usage (`onClick` prop on `InstancedMesh`). Render `<InteractionManager visualScale={controls.visualScale} />` inside the `Canvas` context (maybe within `GridScene` or alongside it in `AppController`). *Ensure the canvas reference is correctly obtained in `InteractionManager`*. You might need to pass the canvas ref down or use a context. Accessing via `scene.userData.gl` is one way if using R3F defaults.
        *   **In `GridStateStore.ts`:** Implement `toggleCmdHorizLink(x, y)`:
            ```typescript
            // Inside create<GridState>((set, get) => ({ ...
            toggleCmdHorizLink: (x, y) => {
                const { gridData, gridWidth, gridHeight, getCell, setCell } = get();
                if (!gridData || x < 0 || x >= gridWidth - 1 || y < 0 || y >= gridHeight) return; // Check bounds

                const leftState = getCell(x, y);
                const rightState = getCell(x + 1, y);

                // Condition: Both must be at least active
                if (leftState >= CELL_STATE_ACTIVE && rightState >= CELL_STATE_ACTIVE) {
                    if (leftState === CELL_STATE_ACTIVE_CMD_HORIZ_LEFT) {
                        // If already linked, unlink (set left back to normal active)
                        setCell(x, y, CELL_STATE_ACTIVE);
                        console.log(`Store: Unlinked cmd-horiz at (${x}, ${y})`);
                    } else {
                        // If not linked, link (set left to cmd-horiz state)
                        setCell(x, y, CELL_STATE_ACTIVE_CMD_HORIZ_LEFT);
                        console.log(`Store: Linked cmd-horiz at (${x}, ${y})`);
                    }
                } else {
                    console.log(`Store: Cmd-horiz link condition not met at (${x}, ${y})`);
                }
            },
            // ... other actions
            ```
    *   **Goal:** Input handling is centralized and interacts directly with the store. Rendering components are dumb regarding input.
    *   **Test:** Clicking anywhere on the grid should trigger the `InteractionManager`. Clicks on cells should toggle their state in the store, updating the `GridRenderer`. Cmd-clicks should toggle the cmd-horiz state correctly by calling the store action.

---

**Phase 3: UI Element Abstraction**

*   **Goal:** Introduce the concept of logical UI elements that manipulate the store, starting with Text.
*   **Risk:** Medium. Requires font data handling.

1.  **Step 3.1: Define and Load Font Data**
    *   **File:** Create `common/fontData.json` (or `.ts`).
    *   **Action:** Create a simple fixed-width font representation. Example for a 3x5 font:
        ```json
        // common/fontData.json
        {
          "fontWidth": 3,
          "fontHeight": 5,
          "glyphs": {
            "A": [
              [0,1,0],
              [1,0,1],
              [1,1,1],
              [1,0,1],
              [1,0,1]
            ],
            "B": [
              [1,1,0],
              [1,0,1],
              [1,1,0],
              [1,0,1],
              [1,1,0]
            ],
            " ": [ // Space character
              [0,0,0],
              [0,0,0],
              [0,0,0],
              [0,0,0],
              [0,0,0]
            ]
            // ... other characters
          }
        }
        ```
    *   Load this data where needed (e.g., in the component that will use `<TextElement>`).

2.  **Step 3.2: Create `TextElement` Logical Component**
    *   **File:** Create `components/ui/TextElement.tsx`
    *   **Action:**
        ```typescript
        import React, { useEffect } from 'react';
        import useGridStore, { CELL_STATE_TEXT } from '../GridStateStore'; // Assuming CELL_STATE_TEXT = 100

        // Define font data structure type (replace with actual structure)
        interface FontData {
            fontWidth: number;
            fontHeight: number;
            glyphs: Record<string, number[][]>;
        }

        interface TextElementProps {
            text: string;
            x: number; // Top-left grid coordinates
            y: number;
            fontData: FontData;
        }

        // Helper to generate pattern data (could be moved to a utility file)
        function generateTextPattern(text: string, fontData: FontData): { width: number; height: number; data: number[] } | null {
            const { fontWidth, fontHeight, glyphs } = fontData;
            const textWidth = text.length * fontWidth;
            const patternData: number[] = new Array(textWidth * fontHeight).fill(0); // CELL_STATE_EMPTY

            for (let i = 0; i < text.length; i++) {
                const char = text[i].toUpperCase(); // Assuming uppercase font data
                const glyph = glyphs[char] || glyphs[' ']; // Default to space if char not found
                if (!glyph) continue;

                const charOffsetX = i * fontWidth;

                for (let row = 0; row < fontHeight; row++) {
                    for (let col = 0; col < fontWidth; col++) {
                        if (glyph[row] && glyph[row][col] === 1) {
                            const patternIndex = row * textWidth + (charOffsetX + col);
                            patternData[patternIndex] = CELL_STATE_TEXT; // Use specific text state
                        }
                    }
                }
            }
            return { width: textWidth, height: fontHeight, data: patternData };
        }

        const TextElement: React.FC<TextElementProps> = ({ text, x, y, fontData }) => {
            const { setRegion } = useGridStore(); // Only need setRegion action

            useEffect(() => {
                console.log(`TextElement: Rendering "${text}" at (${x}, ${y})`);
                const pattern = generateTextPattern(text, fontData);

                if (pattern) {
                    // Call the store's setRegion action
                    useGridStore.getState().setRegion(x, y, pattern.width, pattern.height, pattern.data);

                    // Return cleanup function to clear the text area on unmount or text change
                    return () => {
                        console.log(`TextElement: Clearing "${text}" at (${x}, ${y})`);
                        const clearData = new Array(pattern.width * pattern.height).fill(0); // CELL_STATE_EMPTY
                         useGridStore.getState().setRegion(x, y, pattern.width, pattern.height, clearData);
                    };
                }
            }, [text, x, y, fontData]); // Re-run if props change

            return null; // This component doesn't render directly to DOM
        };

        export default TextElement;
        ```
    *   **In `GridStateStore.ts`:** Implement the `setRegion` action. It needs to efficiently update a rectangular area of the `gridData` array.
    *   **Update Shaders:** Modify `CircleMaterial` (and potentially `UnifiedConnectorMaterial` if text should affect connectors) to recognize `CELL_STATE_TEXT` and render it differently (e.g., different inner color, maybe disable the outer ring).
    *   **Usage:** In `GridScene` or your main app component, import the font data and render `<TextElement text="HELLO" x={2} y={2} fontData={myLoadedFontData} />`.
    *   **Goal:** Demonstrate rendering non-interactive text by having a logical component update the central store.
    *   **Test:** The text "HELLO" should appear on the grid at the specified coordinates, rendered using the assigned `CELL_STATE_TEXT` visual style. Changing the `text` prop should update the grid. Removing the component should clear the text.

---

**Phase 4: Editor/Viewer Separation & Advanced Features**

*   **Goal:** Clean up editor/viewer logic, implement serialization, add interactive buttons, and consider performance.
*   **Risk:** Medium.

1.  **Step 4.1: Implement Store Serialization**
    *   **File:** `components/GridStateStore.ts`. Modify `AppController.tsx` (or wherever save/load buttons are).
    *   **Action:**
        *   In `GridStateStore`:
            *   Add `saveState(): string` action: Gets `gridWidth`, `gridHeight`, `gridData`. Serializes them into a JSON string (convert `Uint16Array` to a regular array for JSON).
            *   Add `loadState(jsonData: string): void` action: Parses JSON. Validates data. Calls `setGridSize` and then updates `gridData` (convert array back to `Uint16Array`). Ensure errors are handled.
        *   In `AppController`: Update `saveState` button to call `const json = useGridStore.getState().saveState();` and trigger download. Update `loadState` button to read file, parse JSON, and call `useGridStore.getState().loadState(jsonContent);`.
        *   Remove the old `saveGridStateWithDirectValues` and related logic from `GridScene`.
    *   **Goal:** Robust save/load functionality handled entirely through the state store.
    *   **Test:** Save the current grid state (including text, active cells, cmd-horiz links). Clear the grid or load a different pattern. Load the saved state. The grid should be restored perfectly.

2.  **Step 4.2: Create `ButtonElement` Logical Component**
    *   **File:** Create `components/ui/ButtonElement.tsx`. Modify `components/InteractionManager.tsx`.
    *   **Action:**
        *   Define button-specific state values (e.g., `CELL_STATE_BUTTON_BG = 200`, `CELL_STATE_BUTTON_BORDER = 201`).
        *   Create `ButtonElement.tsx`: Takes props like `label`, `x`, `y`, `width`, `height`, `onClick`.
            *   `useEffect`: Uses `setRegion` to draw a border and background using button state values. Potentially uses `TextElement`'s logic to draw the label inside (or generates text pattern directly).
            *   **Interaction Registry:** Needs a way to register its clickable area and `onClick` handler. This could be a simple global object/map managed outside Zustand, or a React Context. The button registers `{ id, bounds: { x, y, w, h }, onClick }` on mount and unregisters on unmount.
        *   In `InteractionManager.tsx`:
            *   Import or access the interaction registry.
            *   In `handlePointerDown`: Before toggling a cell, check if the clicked coordinates `(x, y)` fall within any registered button bounds.
            *   If it hits a button, call that button's registered `onClick` handler and *do not* proceed with the default cell toggling.
        *   Update shaders to style button cells distinctly.
    *   **Goal:** Create interactive button elements. Demonstrate decoupling interaction logic using a registry or similar pattern.
    *   **Test:** Add a `<ButtonElement ... />`. It should appear visually distinct. Clicking the button area should trigger its `onClick` function (e.g., log to console) and *not* toggle the underlying cells' active state.

3.  **Step 4.3: Refine Editor/Viewer Separation**
    *   **Files:** `AppController.tsx`, `GridScene.tsx`, `GridViewer.tsx`
    *   **Action:**
        *   Decide what constitutes "Editor" vs. "Viewer".
        *   **Editor (`GridScene`?):** Renders `GridRenderer`, `InteractionManager`, and logical elements like `<TextElement>`, `<ButtonElement>`. Contains controls for adding/modifying these elements.
        *   **Viewer (`GridViewer`):** Might only render `GridRenderer`. It could receive the *entire* grid state (`width`, `height`, `gridData`) as props from `AppController` after loading a file, making it display static data. Or, it could subscribe to the store but not render `InteractionManager`.
        *   Refactor `AppController` to manage the active mode (`showEditor`). Conditionally render `GridScene` (Editor) or `GridViewer` (Viewer). Pass necessary data/props accordingly.
        *   Remove any remaining Leva controls tied directly to rendering/state from `GridScene`/`GridRenderer`. Editor controls should be standard React UI interacting with the store or logical components.
    *   **Goal:** Clear separation of concerns between viewing static grid data and interactively editing it.
    *   **Test:** Switching between Editor and Viewer modes works. Viewer displays the loaded state correctly (and is non-interactive). Editor is fully interactive.

4.  **Step 4.4: Performance Testing and Optimization (100x100)**
    *   **Action:**
        *   Set grid size to 100x100 or larger using store actions.
        *   Test interaction responsiveness (clicking, potentially dragging if implemented).
        *   Test rendering performance (FPS). Use browser dev tools or `stats.js`.
        *   **If Slow:**
            *   **State:** Ensure Zustand updates are efficient (they usually are). Avoid unnecessary state updates or deep copies.
            *   **Rendering:** Profile GPU usage.
            *   **Optimize Shaders:** Minimize calculations per fragment. Use `discard` early for empty areas. Ensure texture lookups are efficient.
            *   **Consider Draw Calls:** The single connector plane is efficient in draw calls, but fragment shader cost might be high. If it's a bottleneck, more advanced techniques (geometry shaders, compute shaders, multiple smaller connector planes) could be explored, but add complexity.
            *   **Optimize `setRegion`:** Ensure the store's `setRegion` action is optimized for updating large blocks of the `gridData` array efficiently.
    *   **Goal:** Maintain acceptable performance on large grids.
    *   **Test:** The application remains reasonably responsive and interactive with a 100x100 grid.

---

This detailed plan provides a roadmap. Each step builds upon the previous one, allowing for testing along the way. Remember to adapt the state values (`CELL_STATE_*`), shader logic, and interaction registry details based on your specific needs as you implement. Good luck!