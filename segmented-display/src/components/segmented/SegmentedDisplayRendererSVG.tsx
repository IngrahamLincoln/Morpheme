// SegmentedDisplayRendererSVG.tsx
import React from 'react';
import type { JSX } from 'react';
import type { Point, SegmentedDisplayRendererSVGProps } from './segmentedDisplayTypes';
// Removed direct import of geometry functions, they are passed via props now

const SegmentedDisplayRendererSVG: React.FC<SegmentedDisplayRendererSVGProps> = ({
  rows,
  cols,
  centers,
  activeSegments,
  // dSegmentClickState, // Not directly needed if getFillColor handles it
  effectiveOuterRadius,
  effectiveInnerRadius,
  effectiveSpacing,
  showOutlines,
  showInactiveDotGrid,
  showLabels,
  // useColors, // Implicitly handled by getFillColor
  svgWidth,
  svgHeight,
  onSegmentClick,
  getFillColor,
  calculateLensPath,
  calculateQuadrantPath,
  calculateDiamondPath,
  getHorizontalConnectorPath,
}) => {

  // Generate SVG elements
  const gridElements = React.useMemo(() => {
    const elements: JSX.Element[] = [];

    // Draw reference circles (dotted outlines)
    if (showOutlines) {
        centers.forEach((center) => {
            elements.push(
                <circle key={`ref-outer-${center.row}-${center.col}`} cx={center.x} cy={center.y} r={effectiveOuterRadius}
                    fill="none" stroke="gray" strokeWidth="1" strokeDasharray="4" pointerEvents="none" />
            );
            elements.push(
                <circle key={`ref-inner-${center.row}-${center.col}`} cx={center.x} cy={center.y} r={effectiveInnerRadius}
                    fill="none" stroke="gray" strokeWidth="1" strokeDasharray="4" pointerEvents="none" />
            );
        });
    }

    // Diamonds (d segments)
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const diamondCenters = [ centers[row*cols+col], centers[row*cols+col+1], centers[(row+1)*cols+col], centers[(row+1)*cols+col+1] ];
        const diamondId = `d-${row}-${col}`;
        const diamondPath = calculateDiamondPath(diamondCenters, effectiveOuterRadius);
        if (diamondPath) {
          elements.push(
            <path key={diamondId} d={diamondPath} fill={getFillColor(diamondId)} stroke={showOutlines ? "black" : "none"} strokeWidth="1"
              onClick={() => onSegmentClick(diamondId)} className="cursor-pointer hover:opacity-80" />
          );
        }
      }
    }

    // Quadrants (e, f, g, h segments)
    centers.forEach((center) => {
      ['e', 'f', 'h', 'g'].forEach(quadrant => {
        const id = `${quadrant}-${center.row}-${center.col}`;
        // Use the passed-in path calculation function
        const path = calculateQuadrantPath(center, effectiveOuterRadius, effectiveInnerRadius, quadrant);
        elements.push(
          <path key={id} d={path} fill={getFillColor(id)} stroke={showOutlines ? "black" : "none"} strokeWidth="1"
            onClick={() => onSegmentClick(id)} // Allow clicking quadrants directly
            className="cursor-pointer hover:opacity-80"
          />
        );
      });
    });

    // Horizontal lenses (c segments - clickable area for 'i')
    centers.forEach((center) => {
      if (typeof center.col === 'number' && center.col < cols - 1) {
        const rightCenterIndex = center.row! * cols + center.col + 1;
        const rightCenter = centers[rightCenterIndex];
        const id = `c-${center.row}-${center.col}`;
        // Use the passed-in path calculation function
        const path = calculateLensPath(center.x, center.y, rightCenter!.x, rightCenter!.y, effectiveOuterRadius);
        elements.push(
          <path key={id} d={path} fill={getFillColor(id)} stroke={showOutlines ? "black" : "none"} strokeWidth="1"
            onClick={() => onSegmentClick(id)} // Click 'c' to toggle 'i'
            className="cursor-pointer hover:opacity-80"
          />
        );
      }
    });

    // Vertical lenses (b segments - non-interactive visually)
    centers.forEach((center) => {
      if (typeof center.row === 'number' && center.row < rows - 1) {
        const belowCenterIndex = (center.row + 1) * cols + center.col!;
        const belowCenter = centers[belowCenterIndex];
        const id = `b-${center.row}-${center.col}`;
         // Use the passed-in path calculation function
        const path = calculateLensPath(center.x, center.y, belowCenter!.x, belowCenter!.y, effectiveOuterRadius);
        elements.push(
          <path key={id} d={path} fill={getFillColor(id)} stroke={showOutlines ? "black" : "none"} strokeWidth="1"
            // onClick={() => onSegmentClick(id)} // 'b' is not directly clickable per logic
            className="hover:opacity-80" // Still show hover effect maybe?
            // pointerEvents="none" // Or disable pointer events entirely
          />
        );
      }
    });

     // Inner circles ('a' segments) OR inactive dots
    centers.forEach((center) => {
      const id = `a-${center.row}-${center.col}`;
      const isActive = activeSegments.has(id);

      if (isActive) {
        elements.push(
          <circle key={id} cx={center.x} cy={center.y} r={effectiveInnerRadius} fill={getFillColor(id)} stroke={showOutlines ? "black" : "none"} strokeWidth="1"
            onClick={() => onSegmentClick(id)} className="cursor-pointer hover:opacity-80" />
        );
      } else {
        if (showInactiveDotGrid) {
          // Small visual grey dot (non-interactive)
          elements.push( <circle key={id + '-dot'} cx={center.x} cy={center.y} r={3} fill="grey" pointerEvents="none" /> );
          // Larger transparent click target
          elements.push( <circle key={id + '-target'} cx={center.x} cy={center.y} r={effectiveInnerRadius * 0.8} fill="transparent"
            onClick={() => onSegmentClick(id)} className="cursor-pointer" /> );
        } else {
          // Normal inactive (white/transparent) circle
          elements.push(
            <circle key={id} cx={center.x} cy={center.y} r={effectiveInnerRadius} fill={getFillColor(id)} stroke={showOutlines ? "black" : "none"} strokeWidth="1"
              onClick={() => onSegmentClick(id)} className="cursor-pointer hover:opacity-80" />
          );
        }
      }
    });

    // Horizontal connectors ('i' segments) - drawn only if active
    centers.forEach((center) => {
      if (typeof center.col === 'number' && center.col < cols - 1) {
        const id = `i-${center.row}-${center.col}`;
        if (activeSegments.has(id)) {
          const parentId = `c-${center.row}-${center.col}`; // Parent 'c' segment ID
          // Use the passed-in path function
          const path = getHorizontalConnectorPath(center, effectiveSpacing, effectiveInnerRadius);
          elements.push(
            <path key={id} d={path} fill={getFillColor(id)} stroke={showOutlines ? "black" : "none"} strokeWidth="1"
              onClick={() => onSegmentClick(parentId)} // Click 'i' triggers 'c' toggle
              className="cursor-pointer hover:opacity-80"
            />
          );
        }
      }
    });


    // Labels (if enabled)
    if (showLabels) {
      // Diamond labels
      for (let r = 0; r < rows - 1; r++) { for (let c = 0; c < cols - 1; c++) {
          const tl=centers[r*cols+c], tr=centers[r*cols+c+1], bl=centers[(r+1)*cols+c], br=centers[(r+1)*cols+c+1];
          const centerX=(tl.x+tr.x+bl.x+br.x)/4, centerY=(tl.y+tr.y+bl.y+br.y)/4;
          elements.push( <text key={`lbl-d-${r}-${c}`} x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fontSize="8" pointerEvents="none">d</text> );
      }}
      // Other segment labels
      centers.forEach((center) => {
        elements.push( <text key={`lbl-a-${center.row}-${center.col}`} x={center.x} y={center.y} textAnchor="middle" dominantBaseline="middle" fontSize="8" pointerEvents="none">a</text> );
        const midR = (effectiveOuterRadius+effectiveInnerRadius)/2;
        const lblPos = { e:{x:center.x-midR*0.7,y:center.y-midR*0.7}, f:{x:center.x+midR*0.7,y:center.y-midR*0.7}, g:{x:center.x-midR*0.7,y:center.y+midR*0.7}, h:{x:center.x+midR*0.7,y:center.y+midR*0.7} };
        (['e', 'f', 'g', 'h'] as const).forEach(q => elements.push( <text key={`lbl-${q}-${center.row}-${center.col}`} x={lblPos[q].x} y={lblPos[q].y} textAnchor="middle" dominantBaseline="middle" fontSize="8" pointerEvents="none">{q}</text> ));
        if (typeof center.col==='number' && center.col<cols-1){ const rc=centers[center.row!*cols+center.col+1]; elements.push( <text key={`lbl-c-${center.row}-${center.col}`} x={(center.x+rc!.x)/2} y={(center.y+rc!.y)/2} textAnchor="middle" dominantBaseline="middle" fontSize="8" pointerEvents="none">c</text> ); }
        if (typeof center.row==='number' && center.row<rows-1){ const bc=centers[(center.row+1)*cols+center.col!]; elements.push( <text key={`lbl-b-${center.row}-${center.col}`} x={(center.x+bc!.x)/2} y={(center.y+bc!.y)/2} textAnchor="middle" dominantBaseline="middle" fontSize="8" pointerEvents="none">b</text> ); }
      });
    }

    return elements;
  }, [
      rows, cols, centers, activeSegments, effectiveOuterRadius, effectiveInnerRadius, effectiveSpacing,
      showOutlines, showInactiveDotGrid, showLabels, onSegmentClick, getFillColor,
      calculateLensPath, calculateQuadrantPath, calculateDiamondPath, getHorizontalConnectorPath // Ensure all dependencies are listed
  ]);

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
    >
      {gridElements}
    </svg>
  );
};

export default SegmentedDisplayRendererSVG; 