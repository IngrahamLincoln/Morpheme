import { useState, useCallback } from 'react';
import type { AdjacencyList } from './segmentedDisplayTypes';
import { parseSegmentId, getHorizontalSegments, getDiagonalSegments } from './segmentedDisplayUtils';

interface UseSegmentedDisplayStateProps {
  rows: number;
  cols: number;
}

export function useSegmentedDisplayState({ rows, cols }: UseSegmentedDisplayStateProps) {
  const [activeSegments, setActiveSegments] = useState<Set<string>>(new Set());
  const [lastSelectedDot, setLastSelectedDot] = useState<string | null>(null);
  const [dSegmentClickState, setDSegmentClickState] = useState<Map<string, number>>(new Map());
  const [isAddOnlyMode, setIsAddOnlyMode] = useState(false);
  const [showInactiveDotGrid, setShowInactiveDotGrid] = useState(false); // Moved here as it affects interaction logic

  // State for saving/loading adjacency list
  const [adjacencyListOutput, setAdjacencyListOutput] = useState<string>('');
  const [adjacencyListInput, setAdjacencyListInput] = useState<string>('');

  const handleCircleDeselection = useCallback((dotId: string, currentActiveSegments: Set<string>): string[] => {
    const { row: dotRow, col: dotCol } = parseSegmentId(dotId);
    const segmentsToDeactivate = new Set<string>();

    // Define the 4 potential diagonal connections *originating* from this dot.
    const potentialConnections = [
      { attachedQuadrant: `e-${dotRow}-${dotCol}`, diamond: `d-${dotRow - 1}-${dotCol - 1}`, oppositeQuadrant: `h-${dotRow - 1}-${dotCol - 1}` },
      { attachedQuadrant: `f-${dotRow}-${dotCol}`, diamond: `d-${dotRow - 1}-${dotCol}`,   oppositeQuadrant: `g-${dotRow - 1}-${dotCol + 1}` },
      { attachedQuadrant: `g-${dotRow}-${dotCol}`, diamond: `d-${dotRow}-${dotCol - 1}`,   oppositeQuadrant: `f-${dotRow + 1}-${dotCol - 1}` },
      { attachedQuadrant: `h-${dotRow}-${dotCol}`, diamond: `d-${dotRow}-${dotCol}`,     oppositeQuadrant: `e-${dotRow + 1}-${dotCol + 1}` },
    ];

    for (const conn of potentialConnections) {
      try {
        const { row: dRow, col: dCol } = parseSegmentId(conn.diamond);
        if (dRow < 0 || dRow >= rows - 1 || dCol < 0 || dCol >= cols - 1) continue; // Bounds check
      } catch (e) { continue; } // Skip invalid diamond ID

      if (currentActiveSegments.has(conn.attachedQuadrant)) {
        segmentsToDeactivate.add(conn.attachedQuadrant);
        segmentsToDeactivate.add(conn.diamond);
        try {
          const { row: oqRow, col: oqCol } = parseSegmentId(conn.oppositeQuadrant);
           if (oqRow >= 0 && oqRow < rows && oqCol >= 0 && oqCol < cols) { // Bounds check
            segmentsToDeactivate.add(conn.oppositeQuadrant);
          }
        } catch (e) { /* Ignore invalid opposite quadrant */ }
      }
    }

    // Horizontal connectors
    const leftI = `i-${dotRow}-${dotCol - 1}`;
    const rightI = `i-${dotRow}-${dotCol}`;
    if (dotCol > 0 && currentActiveSegments.has(leftI)) { segmentsToDeactivate.add(leftI); }
    if (dotCol < cols - 1 && currentActiveSegments.has(rightI)) { segmentsToDeactivate.add(rightI); }

    return Array.from(segmentsToDeactivate);
  }, [rows, cols]);


  const toggleSegment = useCallback((id: string) => {
    const currentActiveSegments = activeSegments; // Use current state for checks

    // --- 'd' segments ---
    if (id.startsWith('d-')) {
      const { row, col } = parseSegmentId(id);
      const iAboveId = `i-${row}-${col}`; const iBelowId = `i-${row + 1}-${col}`;
      if (currentActiveSegments.has(iAboveId) || currentActiveSegments.has(iBelowId)) {
          console.log(`Blocked d-${row}-${col} activation due to active i: ${iAboveId} or ${iBelowId}`);
          return;
      }

      const eSegment = `e-${row + 1}-${col + 1}`; const fSegment = `f-${row + 1}-${col}`;
      const gSegment = `g-${row}-${col + 1}`; const hSegment = `h-${row}-${col}`;

      setDSegmentClickState(prevMap => {
          const currentClickState = prevMap.get(id) || 0;
          const nextClickState = (currentClickState + 1) % 3;
          const newMap = new Map(prevMap);
          if (nextClickState === 0) newMap.delete(id); else newMap.set(id, nextClickState);

          setActiveSegments(prevActive => {
              const newActive = new Set(prevActive);
              if (nextClickState === 1) { // State 1: d, f, g active; e, h inactive
                  newActive.add(id); newActive.add(fSegment); newActive.add(gSegment);
                  newActive.delete(eSegment); newActive.delete(hSegment);
              } else if (nextClickState === 2) { // State 2: d, e, h active; f, g inactive
                  newActive.add(id); newActive.add(eSegment); newActive.add(hSegment);
                  newActive.delete(fSegment); newActive.delete(gSegment);
              } else { // State 0: all inactive
                  newActive.delete(id); newActive.delete(eSegment); newActive.delete(fSegment);
                  newActive.delete(gSegment); newActive.delete(hSegment);
              }
              return newActive;
          });
          setLastSelectedDot(null); // Reset dot selection
          return newMap;
      });
      return;
    }

    // --- 'a' segments (dots) ---
    if (id.startsWith('a-')) {
      const { type, row, col } = parseSegmentId(id);

      if (isAddOnlyMode) {
          // --- Add Only Mode Logic ---
          let nextActiveSegments = new Set(currentActiveSegments);
          let dStateUpdate: { id: string; state: number } | null = null;
          let nextLastSelectedDot = lastSelectedDot;

          if (!lastSelectedDot) { // First dot in sequence
              nextActiveSegments.add(id);
              nextLastSelectedDot = id;
          } else { // Subsequent dot
              const startPoint = parseSegmentId(lastSelectedDot);
              const endPoint = { type, row, col };
              const horizontalSegments = getHorizontalSegments(startPoint, endPoint);
              const diagonalSegments = getDiagonalSegments(startPoint, endPoint);

              if (horizontalSegments.length > 0) { // Horizontal connection attempt
                  const iSegment = horizontalSegments.find(s => s.startsWith('i-'));
                  let iConflict = false;
                  if (iSegment) {
                      const { row: iRow, col: iCol } = parseSegmentId(iSegment);
                      const dAboveId = `d-${iRow - 1}-${iCol}`; const dBelowId = `d-${iRow}-${iCol}`;
                      if (currentActiveSegments.has(dAboveId) || currentActiveSegments.has(dBelowId)) { iConflict = true; console.log(`Add Only: Blocked i-${iRow}-${iCol} due to active d`); }
                  }
                  if (!iConflict) {
                      horizontalSegments.forEach(segment => nextActiveSegments.add(segment));
                      nextActiveSegments.add(id); // Activate new dot
                      nextLastSelectedDot = id; // Continue chain
                  }
              } else if (diagonalSegments.length > 0) { // Diagonal connection attempt
                  const dSegmentId = diagonalSegments.find(s => s.startsWith('d-'));
                  let quadrantConflict = false; let iConflict = false;
                  if (dSegmentId) {
                      const { row: dRow, col: dCol } = parseSegmentId(dSegmentId);
                      const allQuadrants = [ `e-${dRow + 1}-${dCol + 1}`, `f-${dRow + 1}-${dCol}`, `g-${dRow}-${dCol + 1}`, `h-${dRow}-${dCol}` ];
                      const oppositeQuadrants = allQuadrants.filter(q => !diagonalSegments.includes(q));
                      if (oppositeQuadrants.some(q => currentActiveSegments.has(q))) { quadrantConflict = true; }
                      const iAboveId = `i-${dRow}-${dCol}`; const iBelowId = `i-${dRow + 1}-${dCol}`;
                      if (currentActiveSegments.has(iAboveId) || currentActiveSegments.has(iBelowId)) { iConflict = true; console.log(`Add Only: Blocked d-${dRow}-${dCol} due to active i`); }
                  }
                  if (!quadrantConflict && !iConflict) {
                      diagonalSegments.forEach(segment => nextActiveSegments.add(segment));
                      if (dSegmentId) { const isEH = diagonalSegments.some(s => s.startsWith('e-') || s.startsWith('h-')); dStateUpdate = { id: dSegmentId, state: isEH ? 2 : 1 }; }
                      nextActiveSegments.add(id); // Activate new dot
                      nextLastSelectedDot = id; // Continue chain
                  }
              } else { // Not adjacent: Activate dot, start new chain
                  console.log("Add Only: Clicked dot not adjacent. Starting new chain.");
                  nextActiveSegments.add(id); // Activate clicked dot
                  nextLastSelectedDot = id; // Start new chain
              }
          }
          // Apply state updates for Add Only mode
          setActiveSegments(nextActiveSegments);
          if (dStateUpdate) {
              setDSegmentClickState(prevMap => {
                  const newMap = new Map(prevMap);
                  if (dStateUpdate!.state === 0) newMap.delete(dStateUpdate!.id); else newMap.set(dStateUpdate!.id, dStateUpdate!.state);
                  return newMap;
              });
          }
          setLastSelectedDot(nextLastSelectedDot);
          return; // Handled 'a' in Add Only mode
      } else {
          // --- Normal Mode 'a' click Logic ---
          if (lastSelectedDot) { // Second dot clicked
              const startPoint = parseSegmentId(lastSelectedDot);
              const endPoint = { type, row, col };
              let nextActiveSegments = new Set(currentActiveSegments);
              let dStateUpdate: { id: string; state: number } | null = null;
              let nextLastSelectedDot: string | null = null; // Reset selection after action

              const horizontalSegments = getHorizontalSegments(startPoint, endPoint);
              const diagonalSegments = getDiagonalSegments(startPoint, endPoint);

              if (horizontalSegments.length > 0) { // Horizontal connection attempt
                  const iSegment = horizontalSegments.find(s => s.startsWith('i-'));
                  let iConflict = false;
                  if (iSegment) { const { row: iRow, col: iCol } = parseSegmentId(iSegment); const dAboveId = `d-${iRow - 1}-${iCol}`; const dBelowId = `d-${iRow}-${iCol}`; if (currentActiveSegments.has(dAboveId) || currentActiveSegments.has(dBelowId)) { iConflict = true; console.log(`Normal Mode: Blocked i-${iRow}-${iCol} connection due to active d`); } }
                  if (!iConflict) { horizontalSegments.forEach(segment => nextActiveSegments.add(segment)); }
                   // Always ensure both dots are active after a connection attempt, even if i is blocked
                  nextActiveSegments.add(lastSelectedDot); nextActiveSegments.add(id); nextLastSelectedDot = null;
              } else if (diagonalSegments.length > 0) { // Diagonal connection attempt
                  const dSegmentId = diagonalSegments.find(s => s.startsWith('d-'));
                  let quadrantConflict = false; let iConflict = false;
                  if (dSegmentId) { const { row: dRow, col: dCol } = parseSegmentId(dSegmentId); const allQ = [`e-${dRow+1}-${dCol+1}`,`f-${dRow+1}-${dCol}`,`g-${dRow}-${dCol+1}`,`h-${dRow}-${dCol}`]; const opQ = allQ.filter(q => !diagonalSegments.includes(q)); if (opQ.some(q => currentActiveSegments.has(q))) { quadrantConflict = true; } const iA = `i-${dRow}-${dCol}`; const iB = `i-${dRow+1}-${dCol}`; if (currentActiveSegments.has(iA)||currentActiveSegments.has(iB)){ iConflict = true; console.log(`Normal Mode: Blocked d-${dRow}-${dCol} connection due to active i`); }}
                  if (!quadrantConflict && !iConflict) {
                      diagonalSegments.forEach(segment => nextActiveSegments.add(segment));
                      if (dSegmentId) { const isEH = diagonalSegments.some(s => s.startsWith('e-')||s.startsWith('h-')); dStateUpdate = { id: dSegmentId, state: isEH ? 2 : 1 }; }
                  }
                   // Always ensure both dots are active after a connection attempt
                  nextActiveSegments.add(lastSelectedDot); nextActiveSegments.add(id); nextLastSelectedDot = null;
              } else { // Not adjacent: Toggle second dot, clear selection
                  if (nextActiveSegments.has(id)) { // Deselecting second dot
                      const segmentsToDeactivate = handleCircleDeselection(id, currentActiveSegments);
                      nextActiveSegments.delete(id);
                      segmentsToDeactivate.forEach(segmentId => { nextActiveSegments.delete(segmentId); if (segmentId.startsWith('d-')) { dStateUpdate = { id: segmentId, state: 0 }; } });
                  } else { // Selecting second dot (no connection)
                      nextActiveSegments.add(id);
                  }
                  nextLastSelectedDot = null; // Clear selection after non-adjacent click
              }
              // Apply state updates for Normal Mode second click
              setActiveSegments(nextActiveSegments);
              if (dStateUpdate) { setDSegmentClickState(prevMap => { const newMap = new Map(prevMap); if(dStateUpdate!.state === 0) newMap.delete(dStateUpdate!.id); else newMap.set(dStateUpdate!.id, dStateUpdate!.state); return newMap; }); }
              setLastSelectedDot(nextLastSelectedDot);

          } else { // First dot click OR deselection in Normal mode
              let nextActiveSegments = new Set(currentActiveSegments); let nextLastSelectedDot: string | null = null;
              if (nextActiveSegments.has(id)) { // Deselecting
                  const segmentsToDeactivate = handleCircleDeselection(id, currentActiveSegments);
                  nextActiveSegments.delete(id); nextLastSelectedDot = null;
                  segmentsToDeactivate.forEach(segmentId => {
                      nextActiveSegments.delete(segmentId);
                      if (segmentId.startsWith('d-')) { setDSegmentClickState(prevMap => { const map = new Map(prevMap); map.delete(segmentId); return map; }); }
                  });
              } else { // Selecting (first dot)
                  nextActiveSegments.add(id); nextLastSelectedDot = id;
              }
              setActiveSegments(nextActiveSegments);
              setLastSelectedDot(nextLastSelectedDot);
          }
          return; // Handled 'a' in Normal mode
      }
    }

    // --- 'c' clicks (toggle 'i') ---
    if (id.startsWith('c-')) {
       const { row, col } = parseSegmentId(id);
       const iSegment = `i-${row}-${col}`;
       const dAboveId = `d-${row - 1}-${col}`; const dBelowId = `d-${row}-${col}`;
       const isISegmentActive = currentActiveSegments.has(iSegment);

       if (isISegmentActive) { // Deactivating 'i'
           setActiveSegments(prev => { const newSet = new Set(prev); newSet.delete(iSegment); setLastSelectedDot(null); return newSet; });
       } else { // Activating 'i'
           const hasDConflict = currentActiveSegments.has(dAboveId) || currentActiveSegments.has(dBelowId);
           if (!hasDConflict) {
               setActiveSegments(prev => { const newSet = new Set(prev); newSet.add(iSegment); setLastSelectedDot(null); return newSet; });
           } else { console.log(`Blocked i-${row}-${col} via c-${row}-${col} due to active d`); }
       }
       return; // Handled 'c' click
    }

    // --- 'e', 'f', 'g', 'h' clicks (quadrants) ---
    if (['e', 'f', 'g', 'h'].includes(id.split('-')[0])) {
       const { type, row, col } = parseSegmentId(id);
       let associatedDId: string | null = null;
       if (type === 'e') associatedDId = `d-${row - 1}-${col - 1}`;
       else if (type === 'f') associatedDId = `d-${row - 1}-${col}`;
       else if (type === 'g') associatedDId = `d-${row}-${col - 1}`;
       else if (type === 'h') associatedDId = `d-${row}-${col}`;

       setActiveSegments(prev => {
          const newSet = new Set(prev);
          let blockClick = false;
          if (associatedDId) {
             try {
               const dParts = parseSegmentId(associatedDId);
               if (dParts.row >= 0 && dParts.row < rows - 1 && dParts.col >= 0 && dParts.col < cols - 1) {
                 const eQ=`e-${dParts.row+1}-${dParts.col+1}`, fQ=`f-${dParts.row+1}-${dParts.col}`;
                 const gQ=`g-${dParts.row}-${dParts.col+1}`, hQ=`h-${dParts.row}-${dParts.col}`;
                 if ((type==='e'||type==='h') && (prev.has(fQ)||prev.has(gQ))) { blockClick=true; }
                 if ((type==='f'||type==='g') && (prev.has(eQ)||prev.has(hQ))) { blockClick=true; }
               }
             } catch(e) { /* ignore parse error */ }
          }
          if (!blockClick) { if (newSet.has(id)) newSet.delete(id); else newSet.add(id); }
          setLastSelectedDot(null);
          return newSet;
       });
       return; // Handled quadrant click
    }

    // --- 'b' clicks (vertical lens) --- Blocked
    if (id.startsWith('b-')) { console.log(`Segment type 'b' (${id}) is not activatable.`); return; }

    // --- Fallback for other/unhandled clicks --- Should not happen
    setActiveSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      console.warn(`Toggled unhandled segment type via fallback: ${id}`);
      setLastSelectedDot(null);
      return newSet;
    });

  }, [activeSegments, lastSelectedDot, isAddOnlyMode, handleCircleDeselection, rows, cols]);


  const clearAllSegments = useCallback(() => {
    setActiveSegments(new Set());
    setDSegmentClickState(new Map());
    setLastSelectedDot(null);
    setIsAddOnlyMode(false);
    setAdjacencyListOutput('');
    setAdjacencyListInput('');
  }, []);

  const activateAllSegments = useCallback(() => {
    // NOTE: This activates visually but breaks logical consistency (e.g., conflicting d states)
    const allSegments = new Set<string>();
    for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) {
        allSegments.add(`a-${r}-${c}`); allSegments.add(`e-${r}-${c}`); allSegments.add(`f-${r}-${c}`);
        allSegments.add(`g-${r}-${c}`); allSegments.add(`h-${r}-${c}`);
        if (r < rows - 1) allSegments.add(`b-${r}-${c}`); // Include 'b' for visual activation if needed
        if (c < cols - 1) allSegments.add(`c-${r}-${c}`); // Include 'c' for visual activation if needed
        if (c < cols - 1) allSegments.add(`i-${r}-${c}`); // Activate 'i' too
        if (r < rows - 1 && c < cols - 1) allSegments.add(`d-${r}-${c}`);
    }}
    setActiveSegments(allSegments);
    setDSegmentClickState(new Map()); // Reset diamond states
    setLastSelectedDot(null);
    setIsAddOnlyMode(false);
    setAdjacencyListOutput('');
    setAdjacencyListInput('');
  }, [rows, cols]);

  const handleSave = useCallback(() => {
    const dots = new Set<string>();
    const connections: AdjacencyList['connections'] = [];

    activeSegments.forEach(segmentId => {
      if (segmentId.startsWith('a-')) {
        dots.add(segmentId);
      } else if (segmentId.startsWith('i-')) {
        const { row, col } = parseSegmentId(segmentId);
        const dot1 = `a-${row}-${col}`; const dot2 = `a-${row}-${col + 1}`;
        if (activeSegments.has(dot1) && activeSegments.has(dot2)) {
          dots.add(dot1); dots.add(dot2);
          connections.push({ type: 'horizontal', dot1, dot2 });
        }
      } else if (segmentId.startsWith('d-')) {
        const { row, col } = parseSegmentId(segmentId);
        const state = dSegmentClickState.get(segmentId);
        let dot1: string | null = null, dot2: string | null = null;

        if (state === 1 || (activeSegments.has(`f-${row + 1}-${col}`) && activeSegments.has(`g-${row}-${col + 1}`))) {
           dot1 = `a-${row}-${col + 1}`; dot2 = `a-${row + 1}-${col}`; // TopRight <-> BottomLeft
        } else if (state === 2 || (activeSegments.has(`e-${row + 1}-${col + 1}`) && activeSegments.has(`h-${row}-${col}`))) {
           dot1 = `a-${row}-${col}`; dot2 = `a-${row + 1}-${col + 1}`; // TopLeft <-> BottomRight
        }

        if (dot1 && dot2 && activeSegments.has(dot1) && activeSegments.has(dot2)) {
          dots.add(dot1); dots.add(dot2);
          connections.push({ type: 'diagonal', dot1, dot2 });
        }
      }
    });

    const output: AdjacencyList = {
      dots: Array.from(dots).sort(),
      connections: connections.sort((a, b) => a.dot1.localeCompare(b.dot1) || a.dot2.localeCompare(b.dot2))
    };
    setAdjacencyListOutput(JSON.stringify(output, null, 2));
  }, [activeSegments, dSegmentClickState]);

  const handleLoad = useCallback(() => {
    try {
      const inputData: AdjacencyList = JSON.parse(adjacencyListInput);
      if (!inputData || !Array.isArray(inputData.dots) || !Array.isArray(inputData.connections)) { throw new Error("Invalid format."); }

      const newActiveSegments = new Set<string>();
      const newDSegmentState = new Map<string, number>();

      inputData.dots.forEach(dotId => { if (dotId.startsWith('a-')) newActiveSegments.add(dotId); else console.warn(`Skipping invalid dot: ${dotId}`); });

      inputData.connections.forEach(conn => {
        const { type, dot1, dot2 } = conn;
        if (!dot1.startsWith('a-') || !dot2.startsWith('a-') || !newActiveSegments.has(dot1) || !newActiveSegments.has(dot2)) { console.warn(`Skipping connection with invalid/missing dots: ${dot1}, ${dot2}`); return; }
        const p1 = parseSegmentId(dot1); const p2 = parseSegmentId(dot2);

        if (type === 'horizontal') {
          const segs = getHorizontalSegments(p1, p2);
          if (segs.length > 0) segs.forEach(seg => newActiveSegments.add(seg)); else console.warn(`Could not derive horizontal segs for: ${dot1}, ${dot2}`);
        } else if (type === 'diagonal') {
          const segs = getDiagonalSegments(p1, p2);
          if (segs.length > 0) {
            let dSegId: string | null = null; let dState = 0;
            segs.forEach(seg => {
              newActiveSegments.add(seg);
              if (seg.startsWith('d-')) dSegId = seg;
              if (seg.startsWith('f-') || seg.startsWith('g-')) dState = 1;
              else if (seg.startsWith('e-') || seg.startsWith('h-')) dState = 2;
            });
            if (dSegId && dState > 0) newDSegmentState.set(dSegId, dState); else console.warn(`Could not derive diagonal state for: ${dot1}, ${dot2}`);
          } else console.warn(`Could not derive diagonal segs for: ${dot1}, ${dot2}`);
        }
      });

      setActiveSegments(newActiveSegments);
      setDSegmentClickState(newDSegmentState);
      setLastSelectedDot(null); setIsAddOnlyMode(false);
      setAdjacencyListOutput(''); // Clear output on successful load

    } catch (error) {
      console.error("Error loading state:", error);
      alert(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [adjacencyListInput]); // Dependency on input string


  const toggleAddOnlyMode = useCallback(() => {
    setIsAddOnlyMode(prev => {
        // Clear last selected dot when turning mode OFF
        if (prev) {
            setLastSelectedDot(null);
        }
        return !prev;
    });
  }, []);

  const toggleInactiveDotGrid = useCallback(() => {
    setShowInactiveDotGrid(prev => !prev);
  }, []);


  return {
    // State
    activeSegments,
    dSegmentClickState,
    isAddOnlyMode,
    showInactiveDotGrid,
    adjacencyListOutput,
    adjacencyListInput,
    // Setters & Toggles
    setAdjacencyListInput,
    toggleSegment,
    clearAllSegments,
    activateAllSegments,
    handleSave,
    handleLoad,
    toggleAddOnlyMode,
    toggleInactiveDotGrid,
  };
} 