// --- Matter.js Setup ---
const Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Constraint = Matter.Constraint;

// --- Configuration ---
const GRID_COLS = 10;
const GRID_ROWS = 10;
const CELL_SIZE = 50;
const DOT_RADIUS = CELL_SIZE * 0.4;
const UNSELECTED_DOT_RADIUS = CELL_SIZE * 0.08;
const CONSTRAINT_STIFFNESS = 0.8;
const CONSTRAINT_DAMPING = 0.3;

// --- Physics State ---
let engine;
let world;
let physicsBodies;

// --- p5.js sketch ---
function setup() {
    // Create canvas
    createCanvas(GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);
    
    // Initialize physics
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 0;
    
    // Initialize grid of physics bodies
    physicsBodies = Array(GRID_ROWS)
        .fill(null)
        .map(() => Array(GRID_COLS).fill(null));
    
    // Start physics simulation
    Matter.Runner.run(engine);
}

function draw() {
    background(255);
    
    // Draw unselected grid points
    noStroke();
    fill(208, 208, 208);
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (!physicsBodies[r][c]) {
                const x = c * CELL_SIZE + CELL_SIZE / 2;
                const y = r * CELL_SIZE + CELL_SIZE / 2;
                circle(x, y, UNSELECTED_DOT_RADIUS * 2);
            }
        }
    }
    
    // Get all active bodies
    const bodies = Matter.Composite.allBodies(world);
    if (bodies.length === 0) return;
    
    // Draw metaballs
    loadPixels();
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let sum = 0;
            
            // Calculate metaball field
            for (let body of bodies) {
                const dx = x - body.position.x;
                const dy = y - body.position.y;
                const distSq = dx * dx + dy * dy;
                sum += (DOT_RADIUS * DOT_RADIUS) / distSq;
            }
            
            // Set pixel color based on metaball field
            const index = (x + y * width) * 4;
            if (sum > 1) {
                pixels[index] = 0;     // R
                pixels[index + 1] = 0; // G
                pixels[index + 2] = 0; // B
                pixels[index + 3] = 255; // A
            } else {
                pixels[index] = 255;     // R
                pixels[index + 1] = 255; // G
                pixels[index + 2] = 255; // B
                pixels[index + 3] = 255; // A
            }
        }
    }
    updatePixels();
}

function mousePressed() {
    const col = floor(mouseX / CELL_SIZE);
    const row = floor(mouseY / CELL_SIZE);
    
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        const existingBody = physicsBodies[row][col];
        
        if (existingBody) {
            // Remove body and its constraints
            const constraintsToRemove = Matter.Composite.allConstraints(world).filter(constraint =>
                constraint.bodyA === existingBody || constraint.bodyB === existingBody
            );
            Matter.World.remove(world, constraintsToRemove);
            Matter.World.remove(world, existingBody);
            physicsBodies[row][col] = null;
        } else {
            // Add new body
            const centerX = col * CELL_SIZE + CELL_SIZE / 2;
            const centerY = row * CELL_SIZE + CELL_SIZE / 2;
            
            const newBody = Bodies.circle(centerX, centerY, DOT_RADIUS, {
                restitution: 0.1,
                friction: 0.2,
                frictionStatic: 0.5,
                density: 0.001
            });
            
            physicsBodies[row][col] = newBody;
            Matter.World.add(world, newBody);
            
            // Connect to neighbors
            const neighbors = [
                { r: row - 1, c: col }, // Up
                { r: row + 1, c: col }, // Down
                { r: row, c: col - 1 }, // Left
                { r: row, c: col + 1 }  // Right
            ];
            
            neighbors.forEach(({ r, c }) => {
                if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
                    const neighborBody = physicsBodies[r][c];
                    if (neighborBody) {
                        const constraint = Constraint.create({
                            bodyA: newBody,
                            bodyB: neighborBody,
                            stiffness: CONSTRAINT_STIFFNESS,
                            damping: CONSTRAINT_DAMPING,
                            length: CELL_SIZE
                        });
                        Matter.World.add(world, constraint);
                    }
                }
            });
        }
    }
} 