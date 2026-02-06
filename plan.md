# Overlay Image Feature - Implementation Plan

## Overview
Add support for an overlay image that displays above the base image at configurable opacity (default 30%) for in-place comparison. The overlay is purely visual — it does not interfere with annotations/drawing and is excluded from exports.

## Architecture

**Konva Layer Stack (after change):**
```
Stage
├── imageLayer        (base image)
├── overlayLayer      (NEW - overlay image, between base and annotations)
├── annotationLayer   (user-drawn shapes + transformer)
└── previewLayer      (live drawing preview)
```

The overlay layer sits between the image and annotation layers, so it renders on top of the base image but below all markup.

## Changes by File

### 1. `src/core/Canvas.ts`
- Add new `overlayLayer: Konva.Layer` between `imageLayer` and `annotationLayer`
- Add `overlayNode: Konva.Image | null` and `overlayElement: HTMLImageElement | null` private fields
- Add public `setOverlay(url: string, opacity: number)` method:
  - Loads the image, creates a `Konva.Image` node at position (0,0) with the given opacity
  - Adds it to `overlayLayer`
- Add public `clearOverlay()` method — destroys the overlay node, clears the layer
- Add public `setOverlayOpacity(opacity: number)` method — updates the existing node's opacity
- **Export fix**: In `exportImage()` (which lives in MarkupEditor.ts), hide `overlayLayer` before `stage.toDataURL()` and restore it after — this ensures overlays are excluded from exports

### 2. `src/core/MarkupEditor.ts`
- Add public `setOverlay(url: string, opacity?: number)` method — delegates to `canvas.setOverlay()`
  - `opacity` defaults to `0.3` (30%)
- Add public `clearOverlay()` method — delegates to `canvas.clearOverlay()`
- Add public `setOverlayOpacity(opacity: number)` method — delegates to `canvas.setOverlayOpacity()`
- Modify `exportImage()`: hide overlay layer before export, restore after

### 3. `src/types.ts`
- Add to `MarkupEditorAPI` interface:
  ```typescript
  // Overlay
  setOverlay: (url: string, opacity?: number) => Promise<void>;
  clearOverlay: () => void;
  setOverlayOpacity: (opacity: number) => void;
  ```

### 4. `index.html` (demo)
- Add "Load Overlay" and "Clear Overlay" demo buttons
- Wire them to call `editor.setOverlay(url, 0.3)` and `editor.clearOverlay()`

### 5. No changes needed to:
- `Store.ts` — overlay is purely visual, no state persistence needed
- `UI.ts` — no built-in UI controls (API-only, consistent with export approach)
- `styles.ts` — no new CSS needed (Konva layer, not DOM)
- `icons.ts` — no new icons needed
- `index.ts` — no new exports needed (methods are on the existing MarkupEditorAPI)
