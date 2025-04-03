export interface Point {
  x: number;
  y: number;
  row?: number;
  col?: number;
}

export interface IntersectionPoints {
  p1: Point;
  p2: Point;
}

// Define the structure for the adjacency list
export interface AdjacencyList {
  dots: string[];
  connections: {
    type: 'horizontal' | 'diagonal';
    dot1: string;
    dot2: string;
  }[];
}

// Define props for the main component
export interface SegmentedDisplayGridProps {
  rows?: number;
  cols?: number;
}

// Props for the SVG Renderer
export interface SegmentedDisplayRendererSVGProps {
    rows: number;
    cols: number;
    centers: Point[];
    activeSegments: Set<string>;
    dSegmentClickState: Map<string, number>;
    effectiveOuterRadius: number;
    effectiveInnerRadius: number;
    effectiveSpacing: number; // Needed for connector path
    showOutlines: boolean;
    showInactiveDotGrid: boolean;
    showLabels: boolean;
    useColors: boolean;
    svgWidth: number;
    svgHeight: number;
    onSegmentClick: (id: string) => void;
    getFillColor: (id: string) => string; // Pass color logic
    calculateLensPath: (x1: number, y1: number, x2: number, y2: number, r: number) => string;
    calculateQuadrantPath: (center: Point, outerR: number, innerR: number, quadrant: string) => string;
    calculateDiamondPath: (centers: Point[], outerR: number) => string;
    getHorizontalConnectorPath: (center: Point, spacing: number, innerR: number) => string;
}

// Props for the Controls component
export interface SegmentedDisplayControlsProps {
  rows: number;
  cols: number;
  showLabels: boolean;
  toggleLabels: () => void;
  useColors: boolean;
  toggleColors: () => void;
  showOutlines: boolean;
  toggleShowOutlines: () => void;
  isAddOnlyMode: boolean;
  toggleAddOnlyMode: () => void;
  showInactiveDotGrid: boolean;
  toggleInactiveDotGrid: () => void;
  scale: number;
  setScale: (scale: number) => void;
  resetScale: () => void;
  adjacencyListOutput: string;
  adjacencyListInput: string;
  setAdjacencyListInput: (input: string) => void;
  handleSave: () => void;
  handleLoad: () => void;
  clearAllSegments: () => void;
  activateAllSegments: () => void;
  effectiveOuterRadius: number;
  effectiveInnerRadius: number;
  effectiveSpacing: number;
} 