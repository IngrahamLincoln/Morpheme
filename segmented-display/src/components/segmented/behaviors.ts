interface Point {
  row: number;
  col: number;
}

export const getHorizontalSegments = (start: Point, end: Point): string[] => {
  // Only process if the points are horizontally adjacent
  const rowDiff = Math.abs(start.row - end.row);
  const colDiff = Math.abs(start.col - end.col);
  
  if (rowDiff !== 0 || colDiff !== 1) {
    return [];
  }
  
  // Get the leftmost column
  const leftCol = Math.min(start.col, end.col);
  const row = start.row; // Since they're in the same row
  
  // Return the horizontal connector segment
  return [`i-${row}-${leftCol}`];
};

export const getDiagonalSegments = (start: Point, end: Point): string[] => {
  // Only process if the points form a diagonal
  const rowDiff = Math.abs(start.row - end.row);
  const colDiff = Math.abs(start.col - end.col);
  
  if (rowDiff !== 1 || colDiff !== 1) {
    return [];
  }
  
  // Determine the top-left point
  const topRow = Math.min(start.row, end.row);
  const leftCol = Math.min(start.col, end.col);
  
  // Get the diamond segment
  const diamondSegment = `d-${topRow}-${leftCol}`;
  
  // Determine which quadrants to activate based on the direction
  const isTopLeft = start.row < end.row && start.col < end.col;
  const isTopRight = start.row < end.row && start.col > end.col;
  const isBottomLeft = start.row > end.row && start.col < end.col;
  const isBottomRight = start.row > end.row && start.col > end.col;
  
  let quadrants: string[] = [];
  
  if (isTopLeft) {
    // Bottom-right of top-left point and top-left of bottom-right point
    quadrants = [
      `h-${topRow}-${leftCol}`,
      `e-${topRow + 1}-${leftCol + 1}`
    ];
  } else if (isTopRight) {
    // Bottom-left of top-right point and top-right of bottom-left point
    quadrants = [
      `g-${topRow}-${leftCol + 1}`,
      `f-${topRow + 1}-${leftCol}`
    ];
  } else if (isBottomLeft) {
    // Top-right of bottom-left point and bottom-left of top-right point
    quadrants = [
      `f-${topRow + 1}-${leftCol}`,
      `g-${topRow}-${leftCol + 1}`
    ];
  } else if (isBottomRight) {
    // Top-left of bottom-right point and bottom-right of top-left point
    quadrants = [
      `e-${topRow + 1}-${leftCol + 1}`,
      `h-${topRow}-${leftCol}`
    ];
  }
  
  return [diamondSegment, ...quadrants];
};

export const parseSegmentId = (id: string): { type: string; row: number; col: number } => {
  const [type, row, col] = id.split('-');
  return {
    type,
    row: parseInt(row),
    col: parseInt(col)
  };
};

export const isInnerCircle = (id: string): boolean => {
  return id.startsWith('a-');
};

export const handleCircleDeselection = (dotId: string, activeSegments: Set<string>): string[] => {
  const { row: dotRow, col: dotCol } = parseSegmentId(dotId);
  const segmentsToDeactivate = new Set<string>();

  // Define the 4 potential diagonal connections *originating* from this dot.
  // Each connection is identified by the quadrant attached to *this* dot.
  const potentialConnections = [
    // Top-Right connection via e-dotRow-dotCol
    {
      attachedQuadrant: `e-${dotRow}-${dotCol}`, // Top-left quadrant of the cell containing the dot
      diamond: `d-${dotRow - 1}-${dotCol - 1}`, // Diamond Top-Left relative to dot's cell
      oppositeQuadrant: `h-${dotRow - 1}-${dotCol - 1}` // Bottom-right quadrant relative to diamond's cell
    },
    // Top-Left connection via f-dotRow-dotCol
    {
      attachedQuadrant: `f-${dotRow}-${dotCol}`, // Top-right quadrant
      diamond: `d-${dotRow - 1}-${dotCol}`,   // Diamond Top-Right
      oppositeQuadrant: `g-${dotRow - 1}-${dotCol + 1}` // Bottom-left quadrant relative to diamond's cell
    },
    // Bottom-Left connection via g-dotRow-dotCol
    {
      attachedQuadrant: `g-${dotRow}-${dotCol}`, // Bottom-left quadrant
      diamond: `d-${dotRow}-${dotCol - 1}`,   // Diamond Bottom-Left
      oppositeQuadrant: `f-${dotRow + 1}-${dotCol - 1}` // Top-right quadrant relative to diamond's cell
    },
    // Bottom-Right connection via h-dotRow-dotCol
    {
      attachedQuadrant: `h-${dotRow}-${dotCol}`, // Bottom-right quadrant
      diamond: `d-${dotRow}-${dotCol}`,     // Diamond Bottom-Right
      oppositeQuadrant: `e-${dotRow + 1}-${dotCol + 1}` // Top-left quadrant relative to diamond's cell
    },
  ];

  for (const conn of potentialConnections) {
    // Check bounds for diamond coordinates before proceeding
    try {
      const { row: dRow, col: dCol } = parseSegmentId(conn.diamond);
      if (dRow < 0 || dRow >= 9 || dCol < 0 || dCol >= 9) continue; // Skip if diamond is out of bounds
    } catch (e) { continue; } // Skip if diamond ID is invalid format
    
    // If the quadrant attached to the deselected dot was active...
    if (activeSegments.has(conn.attachedQuadrant)) {
      // ...then deactivate all parts of that diagonal connection.
      segmentsToDeactivate.add(conn.attachedQuadrant);
      segmentsToDeactivate.add(conn.diamond);
      // Ensure the opposite quadrant is also within bounds before adding
      try {
         const { row: oqRow, col: oqCol } = parseSegmentId(conn.oppositeQuadrant);
         if (oqRow >= 0 && oqRow < 10 && oqCol >= 0 && oqCol < 10) {
            segmentsToDeactivate.add(conn.oppositeQuadrant);
         }
      } catch (e) { /* Ignore if opposite quadrant ID is invalid */ }
    }
  }

  // Also check and deactivate horizontal connectors ('i') attached to the dot
  const leftI = `i-${dotRow}-${dotCol - 1}`; // Connector to the left
  const rightI = `i-${dotRow}-${dotCol}`;    // Connector to the right
  if (activeSegments.has(leftI)) {
     segmentsToDeactivate.add(leftI);
  }
  if (activeSegments.has(rightI)) {
     segmentsToDeactivate.add(rightI);
  }

  return Array.from(segmentsToDeactivate);
}; 