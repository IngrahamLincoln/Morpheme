interface Point {
  row: number;
  col: number;
}

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