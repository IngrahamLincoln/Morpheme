// ===============================================
//          sketch.js (Revised Version 2)
// ===============================================
let grid = [];
let canvas;

// Ball properties
const ballRadius = 25;
const offsetRadius = ballRadius * 0.5; // Offset = 12.5
const totalRadius = ballRadius + offsetRadius; // Radius of the larger offset circle = 37.5

// Grid layout
const numCols = 7;
const numRows = 7;

// --- CRITICAL FIX: Adjust spacing ---
// REVISED: Increase spacing to prevent outer circles from overlapping inner circles
// Centers should be separated by: ballRadius + totalRadius + ballRadius
// This ensures outer circles don't overlap with inner circles of adjacent balls
const diagonalDistance = ballRadius * 2 + totalRadius; // 25 + 37.5 + 25 = 87.5
// spacing is the distance between CENTERS (horizontally/vertically)
let spacing; // Declare spacing globally, calculate in setup()

// Colors
const bgColor = [230, 230, 230]; // Light gray background
const activeColor = [0, 0, 0];   // Black for active balls/connections
const inactiveColor = [255, 255, 255]; // White for inactive balls
const lineColor = [150, 150, 150]; // Gray for visualization lines


function setup() {
  canvas = createCanvas(600, 600);
  
  // Calculate spacing in setup where p5.js functions are available
  spacing = diagonalDistance / sqrt(2); // Approx 53.03
  
  console.log(`DEBUG: Ball Radius=${ballRadius}, Offset=${offsetRadius}, Total Radius=${totalRadius}`);
  console.log(`DEBUG: Required Diagonal Distance (Offset Touch): ${diagonalDistance}`);
  console.log(`DEBUG: Calculated Center Spacing: ${spacing}`); // Verify spacing (~53.03)

  // Calculate total grid size for centering
  let totalGridWidth = (numCols - 1) * spacing;
  let totalGridHeight = (numRows - 1) * spacing;
  let startX = (width - totalGridWidth) / 2.0;
  let startY = (height - totalGridHeight) / 2.0;

  grid = []; // Clear grid before setup
  for (let i = 0; i < numCols; i++) { // Columns (x)
    for (let j = 0; j < numRows; j++) { // Rows (y)
      let xPos = startX + i * spacing;
      let yPos = startY + j * spacing;
      grid.push(new Ball(xPos, yPos, ballRadius, i, j));
    }
  }

  // Example Initial State
  setActiveState(1, 1, true);
  setActiveState(0, 2, true);
  setActiveState(1, 2, true);
  setActiveState(2, 2, true);
  setActiveState(1, 3, true);
  setActiveState(0, 4, true);
  setActiveState(2, 4, true);
  setActiveState(1, 5, true);
  setActiveState(5, 3, true);
  setActiveState(6, 4, true);
  setActiveState(5, 5, true);
  setActiveState(4, 1, true);
  setActiveState(5, 2, true);
  setActiveState(3, 4, true);
  setActiveState(4, 5, true);
}

// Helper to set active state based on grid indices
function setActiveState(col, row, isActive) {
    if (col >= 0 && col < numCols && row >= 0 && row < numRows) {
        const index = col * numRows + row; // Calculate flat array index
        if (index < grid.length) {
             grid[index].isActive = isActive;
        }
    }
}


function draw() {
  background(bgColor);

  // 1. Draw Connections between active diagonal neighbors first
  noStroke();
  fill(activeColor);
  drawAllConnections();

  // 2. Draw outer circles (masking circles) for inactive balls
  noStroke();
  fill(inactiveColor);
  for (let ball of grid) {
    if (!ball.isActive) {
      circle(ball.x, ball.y, totalRadius * 2);
    }
  }

  // 3. Draw inner core circles
  for (let ball of grid) {
    fill(ball.isActive ? activeColor : inactiveColor);
    circle(ball.x, ball.y, ball.r * 2);
  }

  // 4. Draw Visualization Lines (outer circle outlines)
  strokeWeight(1);
  stroke(lineColor);
  noFill();
  for (let ball of grid) {
    circle(ball.x, ball.y, totalRadius * 2);
  }

  // 5. Add A/B labels
  textSize(14);
  textAlign(CENTER, CENTER);
  for (let ball of grid) {
    // Inner circle label (uppercase)
    fill(ball.isActive ? 255 : 0);
    text(ball.isActive ? 'B' : 'A', ball.x, ball.y);
    
    // Outer circle label (lowercase)
    fill(0);
    text(ball.isActive ? 'b' : 'a', ball.x, ball.y - totalRadius + 15);
  }
}

// Function to find and draw all necessary connections
function drawAllConnections() {
  const drawnPairs = new Set(); // Keep track of pairs we've already drawn

  for (let i = 0; i < numCols; i++) {
    for (let j = 0; j < numRows; j++) {
      const currentBallIndex = i * numRows + j;
      const currentBall = grid[currentBallIndex];

      if (!currentBall.isActive) continue; // Only check from active balls

      // Define potential neighbors (relative grid coords) - only need to check forward/down
      const neighborsRelative = [
        // { di: 1, dj: 0 },  // Right - Add if you want axial connections later
        // { di: 0, dj: 1 },  // Down - Add if you want axial connections later
        { di: 1, dj: 1 },  // Down-Right (Diagonal)
        { di: 1, dj: -1 } // Up-Right (Diagonal)
      ];

      for (const neighbor of neighborsRelative) {
        const ni = i + neighbor.di;
        const nj = j + neighbor.dj;

        // Check bounds
        if (ni >= 0 && ni < numCols && nj >= 0 && nj < numRows) {
          const neighborBallIndex = ni * numRows + nj;
          const neighborBall = grid[neighborBallIndex];

          if (neighborBall.isActive) {
            // --- Pair Tracking ---
            const key = currentBallIndex < neighborBallIndex
              ? `${currentBallIndex}-${neighborBallIndex}`
              : `${neighborBallIndex}-${currentBallIndex}`;

            if (!drawnPairs.has(key)) {
                // Check if DIAGONAL for the special connection shape
                if (abs(neighbor.di) === 1 && abs(neighbor.dj) === 1) {
                    drawDiagonalConnection(currentBall, neighborBall);
                }
                 drawnPairs.add(key);
            }
          }
        }
      }
    }
  }
}


// --- MATHEMATICALLY PRECISE connector calculation ---
function drawDiagonalConnection(ball1, ball2) {
  const d = dist(ball1.x, ball1.y, ball2.x, ball2.y);
  const dx = (ball2.x - ball1.x) / d;
  const dy = (ball2.y - ball1.y) / d;
  
  const perpX = -dy;
  const perpY = dx;
  
  // Wider arc for fuller connection
  const arcWidth = PI/3;
  const centerAngle1 = atan2(dy, dx);
  const centerAngle2 = atan2(-dy, -dx);
  
  const startAngle1 = centerAngle1 - arcWidth;
  const endAngle1 = centerAngle1 + arcWidth;
  
  const startAngle2 = centerAngle2 - arcWidth;
  const endAngle2 = centerAngle2 + arcWidth;
  
  // Start from inner circle edges
  const p1Start = {
    x: ball1.x + ballRadius * cos(startAngle1),
    y: ball1.y + ballRadius * sin(startAngle1)
  };
  
  const p1End = {
    x: ball1.x + ballRadius * cos(endAngle1),
    y: ball1.y + ballRadius * sin(endAngle1)
  };
  
  const p2Start = {
    x: ball2.x + ballRadius * cos(startAngle2),
    y: ball2.y + ballRadius * sin(startAngle2)
  };
  
  const p2End = {
    x: ball2.x + ballRadius * cos(endAngle2),
    y: ball2.y + ballRadius * sin(endAngle2)
  };
  
  // Control points calculation
  const midX = (ball1.x + ball2.x) / 2;
  const midY = (ball1.y + ball2.y) / 2;
  const perpDist = totalRadius * 0.8;
  
  // Calculate control points relative to midpoint
  const ctrlRight = {
    x: midX + perpX * perpDist,
    y: midY + perpY * perpDist
  };
  
  const ctrlLeft = {
    x: midX - perpX * perpDist,
    y: midY - perpY * perpDist
  };
  
  push();
  fill(activeColor);
  noStroke();

  beginShape();
  
  // Draw first circle arc
  const numSteps = 16;
  for (let i = 0; i <= numSteps; i++) {
    const angle = lerp(startAngle1, endAngle1, i / numSteps);
    vertex(ball1.x + ballRadius * cos(angle), ball1.y + ballRadius * sin(angle));
  }
  
  // Connect to second circle with bezier curves
  bezierVertex(
    p1End.x + dx * perpDist, p1End.y + dy * perpDist,
    ctrlRight.x, ctrlRight.y,
    p2Start.x, p2Start.y
  );
  
  // Draw second circle arc
  for (let i = 0; i <= numSteps; i++) {
    const angle = lerp(startAngle2, endAngle2, i / numSteps);
    vertex(ball2.x + ballRadius * cos(angle), ball2.y + ballRadius * sin(angle));
  }
  
  // Connect back to first circle
  bezierVertex(
    p2End.x - dx * perpDist, p2End.y - dy * perpDist,
    ctrlLeft.x, ctrlLeft.y,
    p1Start.x, p1Start.y
  );

  endShape(CLOSE);
  pop();
}

// Ball class with state and grid indices
class Ball {
  constructor(x, y, r, gridI, gridJ) {
    this.x = x;
    this.y = y;
    this.r = r; // Core radius
    this.isActive = false;
    this.gridI = gridI; // Store column index
    this.gridJ = gridJ; // Store row index
  }

  // Check if a point is inside the core ball
  isHovered(px, py) {
    let d = dist(px, py, this.x, this.y);
    return d < this.r;
  }
}

// --- Mouse Interaction ---
function mousePressed() {
  // Check if click hits any ball core and toggle its state
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i].isHovered(mouseX, mouseY)) {
      grid[i].isActive = !grid[i].isActive;
      console.log(`Toggled ball [${grid[i].gridI}, ${grid[i].gridJ}] to ${grid[i].isActive}`);
      break; // Only toggle the first one hit
    }
  }
}

// ===============================================
//           END OF sketch.js
// ===============================================