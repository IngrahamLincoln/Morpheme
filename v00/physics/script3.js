// --- Matter.js Modules ---
const Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body, // Might need this for type checking or specific Body functions
    Constraint = Matter.Constraint,
    Runner = Matter.Runner,
    Composite = Matter.Composite,
    Events = Matter.Events;

// --- Canvas Setup ---
const canvas = document.getElementById('metaballCanvas');
const ctx = canvas.getContext('2d');

// --- Configuration ---
const GRID_COLS = 10;
const GRID_ROWS = 10;
let CELL_SIZE = 50; // Now variable, controlled by slider
const UNSELECTED_DOT_RADIUS = CELL_SIZE * 0.08; // Radius for unselected grid points
const UNSELECTED_DOT_COLOR = '#808080'; // Medium gray for unselected dots
const ACTIVE_DOT_COLOR = '#000000'; // Black for active dots
const BLOCKER_DOT_COLOR = '#000000'; // Black for blocker dots
const CONSTRAINT_STIFFNESS = 1;  // Maximum stiffness
const CONSTRAINT_DAMPING = 1;    // Maximum damping
const BACKGROUND_CIRCLE_COLOR = '#e8e8e8'; // Light grey for background circles

// Slider setup
const connectionStrengthSlider = document.getElementById('connectionStrength');
const strengthValueDisplay = document.getElementById('strengthValue');
const dotSizeSlider = document.getElementById('dotSize');
const sizeValueDisplay = document.getElementById('sizeValue');
const blockerSizeSlider = document.getElementById('blockerSize');
const blockerValueDisplay = document.getElementById('blockerValue');
const gridSpacingSlider = document.getElementById('gridSpacing');
const spacingValueDisplay = document.getElementById('spacingValue');

// Update value displays when sliders move
connectionStrengthSlider.addEventListener('input', (e) => {
    strengthValueDisplay.textContent = e.target.value;
});

dotSizeSlider.addEventListener('input', (e) => {
    sizeValueDisplay.textContent = e.target.value;
});

blockerSizeSlider.addEventListener('input', (e) => {
    blockerValueDisplay.textContent = e.target.value;
});

gridSpacingSlider.addEventListener('input', (e) => {
    spacingValueDisplay.textContent = e.target.value;
    updateGridSpacing(parseInt(e.target.value));
});

// Function to get current dot radius
function getDotRadius() {
    return CELL_SIZE * parseFloat(dotSizeSlider.value);
}

// Function to get current blocker radius
function getBlockerRadius() {
    return CELL_SIZE * parseFloat(blockerSizeSlider.value);
}

// Function to get background circle radius (larger than dot radius)
function getBackgroundCircleRadius() {
    return CELL_SIZE * 0.75; // Makes circles that overlap but don't intersect inner circles
}

let CANVAS_WIDTH = GRID_COLS * CELL_SIZE;
let CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE;

// Set initial canvas dimensions
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// --- Physics Setup ---
const engine = Engine.create();
const world = engine.world;
world.gravity.y = 0; // No gravity needed for this

// Keep track of physics bodies and their states by grid position
let physicsBodies = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill(null));

let dotStates = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill('none')); // 'none', 'metaball', or 'blocker'

// Function to update grid spacing
function updateGridSpacing(newSpacing) {
    CELL_SIZE = newSpacing;
    CANVAS_WIDTH = GRID_COLS * CELL_SIZE;
    CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Update all body positions
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (physicsBodies[r][c]) {
                Body.setPosition(physicsBodies[r][c], {
                    x: c * CELL_SIZE + CELL_SIZE / 2,
                    y: r * CELL_SIZE + CELL_SIZE / 2
                });
            }
        }
    }

    // Update constraints
    const constraints = Composite.allConstraints(world);
    World.remove(world, constraints);

    // Recreate constraints with new spacing
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (dotStates[r][c] === 'metaball') {
                const body = physicsBodies[r][c];
                if (body) {
                    const neighbors = [
                        { r: r - 1, c: c },     // Up
                        { r: r + 1, c: c },     // Down
                        { r: r, c: c - 1 },     // Left
                        { r: r, c: c + 1 },     // Right
                        { r: r - 1, c: c - 1 }, // Up-Left
                        { r: r - 1, c: c + 1 }, // Up-Right
                        { r: r + 1, c: c - 1 }, // Down-Left
                        { r: r + 1, c: c + 1 }  // Down-Right
                    ];

                    neighbors.forEach(({ r: nr, c: nc }) => {
                        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && 
                            dotStates[nr][nc] === 'metaball') {
                            const neighborBody = physicsBodies[nr][nc];
                            if (neighborBody) {
                                const constraint = Constraint.create({
                                    bodyA: body,
                                    bodyB: neighborBody,
                                    stiffness: CONSTRAINT_STIFFNESS,
                                    damping: CONSTRAINT_DAMPING,
                                    length: Math.abs(nr - r) === 1 && Math.abs(nc - c) === 1 
                                        ? CELL_SIZE * 1.2
                                        : CELL_SIZE
                                });
                                World.add(world, constraint);
                            }
                        }
                    });
                }
            }
        }
    }
}

// --- Drawing Function ---
function draw() {
    // 1. Clear the canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw background grid circles
    ctx.strokeStyle = BACKGROUND_CIRCLE_COLOR;
    ctx.lineWidth = 1;
    const bgRadius = getBackgroundCircleRadius();
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const centerX = c * CELL_SIZE + CELL_SIZE / 2;
            const centerY = r * CELL_SIZE + CELL_SIZE / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, bgRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    const currentDotRadius = getDotRadius();

    // 2. Draw unselected grid points (thin gray circles)
    ctx.lineWidth = 1;
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const centerX = c * CELL_SIZE + CELL_SIZE / 2;
            const centerY = r * CELL_SIZE + CELL_SIZE / 2;
            
            if (dotStates[r][c] === 'none') {
                // Unselected: thin gray circle
                ctx.strokeStyle = UNSELECTED_DOT_COLOR;
                ctx.beginPath();
                ctx.arc(centerX, centerY, currentDotRadius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (dotStates[r][c] === 'metaball') {
                // Active: solid black circle
                ctx.fillStyle = ACTIVE_DOT_COLOR;
                ctx.beginPath();
                ctx.arc(centerX, centerY, currentDotRadius, 0, Math.PI * 2);
                ctx.fill();
            } else if (dotStates[r][c] === 'blocker') {
                // Blocker: thin black circle
                ctx.strokeStyle = BLOCKER_DOT_COLOR;
                ctx.beginPath();
                ctx.arc(centerX, centerY, currentDotRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    // 3. Draw metaballs using field calculation
    const bodies = Composite.allBodies(world);
    if (bodies.length > 0) {
        const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const pixels = imageData.data;
        const connectionStrength = parseFloat(connectionStrengthSlider.value);
        
        // Optimization: Calculate bounds to only process pixels near bodies
        let minX = CANVAS_WIDTH;
        let minY = CANVAS_HEIGHT;
        let maxX = 0;
        let maxY = 0;
        const padding = currentDotRadius * 3;
        
        bodies.forEach(body => {
            minX = Math.max(0, Math.min(minX, body.position.x - padding));
            minY = Math.max(0, Math.min(minY, body.position.y - padding));
            maxX = Math.min(CANVAS_WIDTH, Math.max(maxX, body.position.x + padding));
            maxY = Math.min(CANVAS_HEIGHT, Math.max(maxY, body.position.y + padding));
        });

        minX = Math.floor(minX);
        minY = Math.floor(minY);
        maxX = Math.ceil(maxX);
        maxY = Math.ceil(maxY);

        for (let x = minX; x < maxX; x++) {
            for (let y = minY; y < maxY; y++) {
                let sum = 0;
                let blockingFactor = 1.0;
                let nearDot = false;
                
                const gridCol = Math.floor(x / CELL_SIZE);
                const gridRow = Math.floor(y / CELL_SIZE);
                
                // First calculate metaball influence and check if we're near a dot
                for (let r = Math.max(0, gridRow - 1); r <= Math.min(GRID_ROWS - 1, gridRow + 1); r++) {
                    for (let c = Math.max(0, gridCol - 1); c <= Math.min(GRID_COLS - 1, gridCol + 1); c++) {
                        if (dotStates[r][c] === 'metaball') {
                            const body = physicsBodies[r][c];
                            if (body) {
                                const dx = x - body.position.x;
                                const dy = y - body.position.y;
                                const distSq = dx * dx + dy * dy;
                                const radius = currentDotRadius * connectionStrength;
                                const influence = Math.exp(-distSq / (2 * radius * radius));
                                sum += influence;
                                
                                // Check if we're near the dot itself
                                if (distSq < (currentDotRadius * currentDotRadius * 1.2)) {
                                    nearDot = true;
                                }
                            }
                        }
                    }
                }
                
                // Only apply blocking in connection areas (not near dots)
                if (!nearDot && sum > 0.2) {  // If we're in a connection area
                    const blockerRadius = getBlockerRadius();
                    for (let r = Math.max(0, gridRow - 1); r <= Math.min(GRID_ROWS - 1, gridRow + 1); r++) {
                        for (let c = Math.max(0, gridCol - 1); c <= Math.min(GRID_COLS - 1, gridCol + 1); c++) {
                            if (dotStates[r][c] === 'blocker') {
                                const centerX = c * CELL_SIZE + CELL_SIZE / 2;
                                const centerY = r * CELL_SIZE + CELL_SIZE / 2;
                                const dx = x - centerX;
                                const dy = y - centerY;
                                const distSq = dx * dx + dy * dy;
                                const normalizedDist = Math.sqrt(distSq) / blockerRadius;
                                if (normalizedDist < 1.0) {
                                    const t = 1.0 - normalizedDist;
                                    const smoothT = t * t * (3 - 2 * t);
                                    blockingFactor = Math.min(blockingFactor, 1.0 - smoothT);
                                }
                            }
                        }
                    }
                }
                
                const index = (x + y * CANVAS_WIDTH) * 4;
                // Apply the metaball effect with blocking only in connection areas
                if (nearDot) {
                    // If near a dot, show full strength
                    if (sum > 0.5) {
                        pixels[index] = 0;
                        pixels[index + 1] = 0;
                        pixels[index + 2] = 0;
                        pixels[index + 3] = 255;
                    }
                } else {
                    // In connection areas, apply blocking
                    if (sum * blockingFactor > 0.5) {
                        pixels[index] = 0;
                        pixels[index + 1] = 0;
                        pixels[index + 2] = 0;
                        pixels[index + 3] = 255;
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }
}

// --- Event Handling ---
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const col = Math.floor(clickX / CELL_SIZE);
    const row = Math.floor(clickY / CELL_SIZE);

    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        const currentState = dotStates[row][col];
        
        // Remove any existing body and constraints
        if (physicsBodies[row][col]) {
            const constraintsToRemove = Composite.allConstraints(world).filter(constraint =>
                constraint.bodyA === physicsBodies[row][col] || constraint.bodyB === physicsBodies[row][col]
            );
            World.remove(world, constraintsToRemove);
            World.remove(world, physicsBodies[row][col]);
            physicsBodies[row][col] = null;
        }

        // Cycle through states: none -> metaball -> blocker -> none
        if (currentState === 'none') {
            // Switch to metaball
            dotStates[row][col] = 'metaball';
            const centerX = col * CELL_SIZE + CELL_SIZE / 2;
            const centerY = row * CELL_SIZE + CELL_SIZE / 2;
            const currentDotRadius = getDotRadius();

            const newBody = Bodies.circle(centerX, centerY, currentDotRadius, {
                isStatic: true,
                restitution: 0,
                friction: 1,
                frictionStatic: Infinity,
                density: 1
            });

            physicsBodies[row][col] = newBody;
            World.add(world, newBody);

            // Connect to neighbors
            const neighbors = [
                { r: row - 1, c: col },     // Up
                { r: row + 1, c: col },     // Down
                { r: row, c: col - 1 },     // Left
                { r: row, c: col + 1 },     // Right
                { r: row - 1, c: col - 1 }, // Up-Left
                { r: row - 1, c: col + 1 }, // Up-Right
                { r: row + 1, c: col - 1 }, // Down-Left
                { r: row + 1, c: col + 1 }  // Down-Right
            ];

            neighbors.forEach(({ r, c }) => {
                if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && dotStates[r][c] === 'metaball') {
                    const neighborBody = physicsBodies[r][c];
                    if (neighborBody) {
                        const constraint = Constraint.create({
                            bodyA: newBody,
                            bodyB: neighborBody,
                            stiffness: CONSTRAINT_STIFFNESS,
                            damping: CONSTRAINT_DAMPING,
                            length: Math.abs(r - row) === 1 && Math.abs(c - col) === 1 
                                ? CELL_SIZE * 1.2
                                : CELL_SIZE
                        });
                        World.add(world, constraint);
                    }
                }
            });
        } else if (currentState === 'metaball') {
            // Switch to blocker
            dotStates[row][col] = 'blocker';
        } else {
            // Switch back to none
            dotStates[row][col] = 'none';
        }
    }
});

// --- Run the Physics Engine and Renderer ---
const runner = Runner.create();
Events.on(engine, 'afterUpdate', draw);
Runner.run(runner, engine);

// Initial draw to show empty grid markers
draw(); 