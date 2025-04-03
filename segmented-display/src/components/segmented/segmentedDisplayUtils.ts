// segmentedDisplayUtils.ts

import type { Point, IntersectionPoints } from './segmentedDisplayTypes';

// --- Original Behaviors ---

/**
 * Parses a segment ID string (e.g., "a-10-20") into its components.
 */
export const parseSegmentId = (id: string): { type: string; row: number; col: number } => {
  const parts = id.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid segment ID format: ${id}`);
  }
  const [type, rowStr, colStr] = parts;
  const row = parseInt(rowStr, 10);
  const col = parseInt(colStr, 10);
  if (isNaN(row) || isNaN(col)) {
    throw new Error(`Invalid row/col in segment ID: ${id}`);
  }
  return { type, row, col };
};

/**
 * Checks if a given point represents an inner circle ('a' segment).
 * This seems less useful now as we check `id.startsWith('a-')` but kept for completeness if used elsewhere.
 */
export const isInnerCircle = (point: { type?: string }): boolean => {
  return point.type === 'a';
};

/**
 * Determines the segments involved in a horizontal connection between two adjacent dots.
 */
export const getHorizontalSegments = (startDot: { row: number; col: number }, endDot: { row: number; col: number }): string[] => {
  // Ensure dots are horizontally adjacent
  if (startDot.row !== endDot.row || Math.abs(startDot.col - endDot.col) !== 1) {
    return []; // Not horizontally adjacent
  }

  const leftDotCol = Math.min(startDot.col, endDot.col);
  const row = startDot.row;

  // The connector ('i') segment is between the dots
  const iSegment = `i-${row}-${leftDotCol}`;

  // The two dots themselves ('a' segments)
  const aSegment1 = `a-${startDot.row}-${startDot.col}`;
  const aSegment2 = `a-${endDot.row}-${endDot.col}`;

  // The horizontal lens ('c') segment containing the connector
  const cSegment = `c-${row}-${leftDotCol}`;

  // While 'c' itself isn't activated directly by connection,
  // activating 'i' implies the conceptual space of 'c'.
  // We return 'i' and the two 'a' segments as the core activated elements.
  return [aSegment1, aSegment2, iSegment];
};


/**
 * Determines the segments involved in a diagonal connection between two diagonally adjacent dots.
 */
 export const getDiagonalSegments = (startDot: { row: number; col: number }, endDot: { row: number; col: number }): string[] => {
    // Ensure dots are diagonally adjacent
    if (Math.abs(startDot.row - endDot.row) !== 1 || Math.abs(startDot.col - endDot.col) !== 1) {
        return []; // Not diagonally adjacent
    }

    const topRow = Math.min(startDot.row, endDot.row);
    const leftCol = Math.min(startDot.col, endDot.col);

    // The diamond ('d') segment is between the four dots forming the square
    const dSegment = `d-${topRow}-${leftCol}`;

    // Determine which quadrants are involved based on the diagonal direction
    let quadrant1: string, quadrant2: string;
    const dot1Id = `a-${startDot.row}-${startDot.col}`;
    const dot2Id = `a-${endDot.row}-${endDot.col}`;

    // Case 1: Top-left to Bottom-right diagonal (\)
    if ((startDot.row < endDot.row && startDot.col < endDot.col) || (startDot.row > endDot.row && startDot.col > endDot.col)) {
        quadrant1 = `h-${topRow}-${leftCol}`;             // 'h' quadrant of the top-left dot
        quadrant2 = `e-${topRow + 1}-${leftCol + 1}`;       // 'e' quadrant of the bottom-right dot
    }
    // Case 2: Top-right to Bottom-left diagonal (/)
    else {
        quadrant1 = `g-${topRow}-${leftCol + 1}`;         // 'g' quadrant of the top-right dot
        quadrant2 = `f-${topRow + 1}-${leftCol}`;         // 'f' quadrant of the bottom-left dot
    }

    return [dot1Id, dot2Id, dSegment, quadrant1, quadrant2];
};


// --- Geometry Helpers ---

/**
 * Calculates the two intersection points of two circles.
 */
export const calculateIntersectionPoints = (x1: number, y1: number, x2: number, y2: number, radius: number): IntersectionPoints | null => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Check if circles are too far apart or identical
  if (distance > 2 * radius || distance < 0.001) return null;

  // Distance from center 1 to the midpoint of the intersection segment
  const a = (radius * radius - radius * radius + distance * distance) / (2 * distance);
  // Half the length of the intersection segment (chord)
  const hSquared = radius * radius - a * a;
  const h = hSquared > 0 ? Math.sqrt(hSquared) : 0;

  // Coordinates of the midpoint of the intersection segment
  const xMid = x1 + (a * dx) / distance;
  const yMid = y1 + (a * dy) / distance;

  // Calculate the coordinates of the two intersection points
  const ix1 = xMid + (h * dy) / distance;
  const iy1 = yMid - (h * dx) / distance;

  const ix2 = xMid - (h * dy) / distance;
  const iy2 = yMid + (h * dx) / distance;

  return {
    p1: { x: ix1, y: iy1 },
    p2: { x: ix2, y: iy2 }
  };
};


/**
 * Calculates the SVG path string for a lens shape formed by two intersecting circles.
 */
export const calculateLensPath = (x1: number, y1: number, x2: number, y2: number, radius: number): string => {
  const intersections = calculateIntersectionPoints(x1, y1, x2, y2, radius);
  if (!intersections) return ""; // No intersection, no lens

  const { p1, p2 } = intersections;

  // Determine the sweep flag based on the relative position of centers
  // This ensures the arc takes the shorter path if distance < sqrt(2)*radius
  // and the longer path otherwise, forming the correct lens shape.
  // A simpler approach assumes the standard lens shape and uses fixed flags (0 0 1).
  // For robustness, one might calculate angles, but fixed flags often suffice visually.
  const sweepFlag = 0; // Adjust if needed for specific arc directions
  const largeArcFlag = 0; // Lens arcs are typically less than 180 degrees

  return `
    M ${p1.x} ${p1.y}
    A ${radius} ${radius} ${largeArcFlag} ${sweepFlag} 1 ${p2.x} ${p2.y}
    A ${radius} ${radius} ${largeArcFlag} ${sweepFlag} 1 ${p1.x} ${p1.y}
    Z
  `; // Close the path
};


/**
 * Calculates the SVG path string for an annular quadrant.
 */
export const calculateQuadrantPath = (center: Point, outerR: number, innerR: number, quadrant: string): string => {
  const angles: Record<string, { start: number; end: number }> = {
    e: { start: -Math.PI, end: -Math.PI / 2 },     // Top-left Q2 (-180 to -90)
    f: { start: -Math.PI / 2, end: 0 },            // Top-right Q1 (-90 to 0)
    h: { start: 0, end: Math.PI / 2 },             // Bottom-right Q4 (0 to 90)
    g: { start: Math.PI / 2, end: Math.PI }        // Bottom-left Q3 (90 to 180)
  };

  const { start: startAngle, end: endAngle } = angles[quadrant];

  // Outer arc points
  const outerStartX = center.x + outerR * Math.cos(startAngle);
  const outerStartY = center.y + outerR * Math.sin(startAngle);
  const outerEndX = center.x + outerR * Math.cos(endAngle);
  const outerEndY = center.y + outerR * Math.sin(endAngle);

  // Inner arc points
  const innerStartX = center.x + innerR * Math.cos(endAngle);   // Inner arc starts where outer ends
  const innerStartY = center.y + innerR * Math.sin(endAngle);
  const innerEndX = center.x + innerR * Math.cos(startAngle); // Inner arc ends where outer starts
  const innerEndY = center.y + innerR * Math.sin(startAngle);

  // Determine large-arc-flag (0 for 90-degree arcs)
  const largeArcFlag = 0;
  // Sweep flag (1 for positive angle direction)
  const sweepFlagOuter = 1; // Outer arc sweeps counter-clockwise
  const sweepFlagInner = 0; // Inner arc sweeps clockwise (reverse direction)

  return `
    M ${outerStartX} ${outerStartY}
    A ${outerR} ${outerR} 0 ${largeArcFlag} ${sweepFlagOuter} ${outerEndX} ${outerEndY}
    L ${innerStartX} ${innerStartY}
    A ${innerR} ${innerR} 0 ${largeArcFlag} ${sweepFlagInner} ${innerEndX} ${innerEndY}
    Z
  `; // Close the path
};


/**
 * Calculates the SVG path string for a diamond shape centered between four circles.
 */
export const calculateDiamondPath = (centers: Point[], outerRadius: number): string => {
  if (centers.length !== 4) return ""; // Expecting TL, TR, BL, BR centers

  const [tl, tr, bl, br] = centers;

  // Calculate intersection points for adjacent circles
  const topIntersections = calculateIntersectionPoints(tl.x, tl.y, tr.x, tr.y, outerRadius);
  const bottomIntersections = calculateIntersectionPoints(bl.x, bl.y, br.x, br.y, outerRadius);
  const leftIntersections = calculateIntersectionPoints(tl.x, tl.y, bl.x, bl.y, outerRadius);
  const rightIntersections = calculateIntersectionPoints(tr.x, tr.y, br.x, br.y, outerRadius);

  if (!topIntersections || !bottomIntersections || !leftIntersections || !rightIntersections) {
      // console.warn("Could not calculate all intersections for diamond");
      return ""; // Might happen at edges or with invalid radius
  }

  // Find the intersection point closest to the diamond center for each pair
  // The diamond vertices are formed by the inner intersection points of the lenses
  const diamondCenterX = (tl.x + tr.x + bl.x + br.x) / 4;
  const diamondCenterY = (tl.y + tr.y + bl.y + br.y) / 4;

  const findClosestPoint = (points: IntersectionPoints, targetX: number, targetY: number): Point => {
      const dist1 = Math.hypot(points.p1.x - targetX, points.p1.y - targetY);
      const dist2 = Math.hypot(points.p2.x - targetX, points.p2.y - targetY);
      return dist1 < dist2 ? points.p1 : points.p2;
  };

  const topVertex = findClosestPoint(topIntersections, diamondCenterX, diamondCenterY);
  const bottomVertex = findClosestPoint(bottomIntersections, diamondCenterX, diamondCenterY);
  const leftVertex = findClosestPoint(leftIntersections, diamondCenterX, diamondCenterY);
  const rightVertex = findClosestPoint(rightIntersections, diamondCenterX, diamondCenterY);


  // Define the path using quadratic curves for a slightly rounded diamond
  // Control point is the geometric center of the diamond
  const cx = diamondCenterX;
  const cy = diamondCenterY;

  // Optional: Add concavity adjustment (as in original code)
  const concavity = 0.0; // Set to 0 for straight lines, negative for concave (like -0.15)

  const adjust = (vertex: Point) => ({
      x: vertex.x + (cx - vertex.x) * concavity,
      y: vertex.y + (cy - vertex.y) * concavity
  });

  const adjTop = adjust(topVertex);
  const adjRight = adjust(rightVertex);
  const adjBottom = adjust(bottomVertex);
  const adjLeft = adjust(leftVertex);


  // Path using adjusted vertices and quadratic curves towards the center
  // return `
  //     M ${adjTop.x} ${adjTop.y}
  //     Q ${cx} ${cy} ${adjRight.x} ${adjRight.y}
  //     Q ${cx} ${cy} ${adjBottom.x} ${adjBottom.y}
  //     Q ${cx} ${cy} ${adjLeft.x} ${adjLeft.y}
  //     Q ${cx} ${cy} ${adjTop.x} ${adjTop.y}
  //     Z
  // `;

  // // Alternative: Path using straight lines (simpler diamond)
  return `
    M ${topVertex.x} ${topVertex.y}
    L ${rightVertex.x} ${rightVertex.y}
    L ${bottomVertex.x} ${bottomVertex.y}
    L ${leftVertex.x} ${leftVertex.y}
    Z
  `;
};

/**
 * Calculates the SVG path for a simple rectangular horizontal connector.
 */
 export const getHorizontalConnectorPath = (center: Point, spacing: number, innerRadius: number): string => {
    // New path: Center-to-center horizontally
    const x1 = center.x; // Start at the center x of the left circle
    const x2 = center.x + spacing; // End at the center x of the right circle
    const y = center.y;
    // Set halfHeight to innerRadius for a total height equal to the inner diameter
    const halfHeight = innerRadius;

    return `
      M ${x1} ${y - halfHeight}
      L ${x2} ${y - halfHeight}
      L ${x2} ${y + halfHeight}
      L ${x1} ${y + halfHeight}
      Z
    `;
}; 