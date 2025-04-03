// SegmentedDisplayRendererWebGL.tsx
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import type { SegmentedDisplayRendererSVGProps } from './segmentedDisplayTypes';

// Use the same props interface as the SVG renderer for compatibility
type SegmentedDisplayRendererWebGLProps = SegmentedDisplayRendererSVGProps;

const SegmentedDisplayRendererWebGL: React.FC<SegmentedDisplayRendererWebGLProps> = (props) => {
  const {
    svgWidth,
    svgHeight,
    // We'll need all props but destructure separately for clarity
    rows, cols, centers, activeSegments, effectiveInnerRadius, effectiveOuterRadius, effectiveSpacing
  } = props;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const hasRenderedRef = useRef<boolean>(false);

  // Initialize and clean up PixiJS application
  useEffect(() => {
    console.log(`[WebGL] Initializing WebGL renderer: ${svgWidth}x${svgHeight}, centers: ${centers?.length || 0}`);
    
    // Don't attempt to render if dimensions are too small
    if (svgWidth < 10 || svgHeight < 10) {
      console.log("[WebGL] Dimensions too small, skipping render");
      return;
    }
    
    // Clean up any existing content
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Create application
    try {
      // Explicitly sized canvas
      const width = Math.max(300, svgWidth);
      const height = Math.max(200, svgHeight);
      
      console.log(`[WebGL] Creating canvas: ${width}x${height}`);
      
      // Create canvas element first
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.style.border = '1px solid #FF0000';
      canvas.style.display = 'block';
      
      // Append canvas to DOM
      if (containerRef.current) {
        containerRef.current.appendChild(canvas);
        console.log("[WebGL] Canvas appended to container");
      } else {
        console.error("[WebGL] Container ref is null");
        return;
      }

      console.log("[WebGL] Initializing PixiJS app");
      // Initialize PixiJS with safer options
      const app = new PIXI.Application({
        width,
        height,
        backgroundColor: 0xFFFFFF,
        view: canvas,
        antialias: true,
      });

      // Store app reference
      pixiAppRef.current = app;
      console.log("[WebGL] PixiJS app created successfully");
      
      // Draw a test rectangle to verify rendering
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0xFF3300);
      graphics.drawRect(10, 10, 50, 50);
      graphics.endFill();
      app.stage.addChild(graphics);
      
      console.log("[WebGL] Drawing example shapes");
      
      // Draw actual shapes if centers are available
      if (centers && centers.length > 0) {
        console.log(`[WebGL] Drawing ${centers.length} centers`);
        // Draw circles at each center point
        const circlesGraphics = new PIXI.Graphics();
        circlesGraphics.beginFill(0x0088FF);
        
        // Draw some circles to visualize the grid
        centers.forEach(center => {
          if (center && typeof center.x === 'number' && typeof center.y === 'number') {
            circlesGraphics.drawCircle(center.x, center.y, effectiveInnerRadius || 5);
          }
        });
        
        circlesGraphics.endFill();
        app.stage.addChild(circlesGraphics);
      }
      
      // Force a render to make sure content is visible
      hasRenderedRef.current = true;
      console.log("[WebGL] Initial render completed");
    } catch (error) {
      console.error("[WebGL] Error in WebGL renderer:", error);
    }

    // Cleanup on unmount - using a safer approach
    return () => {
      console.log("[WebGL] Cleaning up WebGL resources");
      
      // First clear references to avoid using destroyed objects
      const app = pixiAppRef.current;
      pixiAppRef.current = null;
      
      // Then destroy the app with safe error handling
      if (app) {
        try {
          if (typeof app.destroy === 'function') {
            app.destroy(true);
          } else {
            console.warn("[WebGL] app.destroy is not a function");
          }
        } catch (e) {
          console.error("[WebGL] Error during PixiJS cleanup:", e);
        }
      }
      
      // Finally clear the container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [svgWidth, svgHeight, rows, cols, centers, effectiveInnerRadius]);

  return (
    <div>
      <div 
        ref={containerRef} 
        style={{ 
          width: `${Math.max(300, svgWidth)}px`, 
          height: `${Math.max(200, svgHeight)}px`,
          border: '1px solid #000',
          backgroundColor: '#f0f0f0',
          position: 'relative',
          overflow: 'hidden'
        }}
      />
      {hasRenderedRef.current ? null : (
        <div style={{ padding: '10px', color: 'red', backgroundColor: '#ffeeee', marginTop: '10px' }}>
          WebGL rendering not visible. Check console for errors.
        </div>
      )}
    </div>
  );
};

export default SegmentedDisplayRendererWebGL; 