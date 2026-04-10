# @markup/editor

A vanilla JavaScript image markup/annotation library with extensibility and dark mode support. Works in any framework or plain HTML..

## Installation

```bash
npm install @markup/editor
```

Or include via CDN:
```html
<script src="https://unpkg.com/@markup/editor/dist/markup-editor.umd.js"></script>
```

## Quick Start

```html
<div id="editor" style="width: 100%; height: 600px;"></div>

<script type="module">
import { MarkupEditor } from '@markup/editor';

const editor = new MarkupEditor({
  container: '#editor',
  theme: 'light',
});

// Load an image
editor.loadImage('https://example.com/image.jpg', 'My Image');
</script>
```

## Configuration Options

```typescript
const editor = new MarkupEditor({
  // Required: Container element or selector
  container: '#editor', // or document.getElementById('editor')

  // Theme: 'light', 'dark', or 'auto' (follows system preference)
  theme: 'light',

  // Which tools to show (default: all)
  tools: ['select', 'pen', 'rectangle', 'ellipse', 'arrow', 'line', 'text', 'highlight', 'crop', 'blur'],

  // Default tool settings
  defaultTool: 'select',
  defaultColor: '#ff0000',
  defaultStrokeWidth: 3,
  defaultFontSize: 24,

  // Pre-load images
  images: [
    { id: '1', url: 'https://...', name: 'Image 1', rotation: 0 }
  ],

  // UI visibility
  showToolbar: true,
  showHistoryPanel: true,
  showNotesPanel: true,
  showTopBar: true,

  // Plugins
  plugins: [myPlugin],

  // Callbacks
  onReady: (api) => {},
  onImageChange: (image, index) => {},
  onAnnotationAdd: (annotation) => {},
  onAnnotationUpdate: (annotation) => {},
  onAnnotationDelete: (id) => {},
  onExport: (dataUrl, format) => {},
});
```

## API Reference

### Images

```typescript
// Load a single image
await editor.loadImage(url, name?);

// Load multiple images
editor.loadImages([{ id, url, name, rotation }]);

// Get images
editor.getImages();
editor.getCurrentImage();
editor.getCurrentImageIndex();

// Navigation
editor.nextImage();
editor.previousImage();
editor.goToImage(index);
editor.rotateImage(90 | -90 | 180);
```

### Annotations

```typescript
// Get/set annotations
editor.getAnnotations(imageId?);
editor.addAnnotation({ type: 'rectangle', x: 10, y: 10, width: 100, height: 50 });
editor.updateAnnotation(id, { color: '#00ff00' });
editor.deleteAnnotation(id);
editor.clearAnnotations(imageId?);

// Selection
editor.selectAnnotation(id);
editor.getSelectedAnnotation();
```

### Tools

```typescript
editor.setTool('pen');
editor.getTool();

editor.setColor('#ff0000');
editor.getColor();

editor.setStrokeWidth(5);
editor.getStrokeWidth();

editor.setFontSize(32);
editor.getFontSize();
```

### History (Undo/Redo)

```typescript
editor.undo();
editor.redo();
editor.canUndo();
editor.canRedo();
editor.getHistory();
```

### View

```typescript
editor.zoomIn();
editor.zoomOut();
editor.setZoom(1.5);
editor.getZoom();
editor.fitToScreen();
editor.resetView();
```

### Theme

```typescript
editor.setTheme('dark'); // 'light', 'dark', 'auto'
editor.getTheme();
```

### Export

```typescript
// Export as image
const dataUrl = await editor.exportImage('png'); // or 'jpeg'

// Export/import annotations
const annotations = editor.exportAnnotations();
editor.importAnnotations(annotations);
```

### Notes

```typescript
editor.setNote('My note for this image');
editor.getNote();
```

### Events

```typescript
editor.on('ready', (api) => {});
editor.on('imageLoad', (image) => {});
editor.on('imageChange', (image, index) => {});
editor.on('annotationAdd', (annotation) => {});
editor.on('annotationUpdate', (annotation) => {});
editor.on('annotationDelete', (id) => {});
editor.on('annotationSelect', (id) => {});
editor.on('toolChange', (tool) => {});
editor.on('zoomChange', (scale) => {});
editor.on('historyChange', (history) => {});
editor.on('themeChange', (mode) => {});
editor.on('export', (dataUrl, format) => {});

editor.off('annotationAdd', callback);
```

### Cleanup

```typescript
editor.destroy();
```

## Extending with Custom Tools

```typescript
editor.registerTool({
  id: 'stamp',
  name: 'Stamp',
  icon: '<svg>...</svg>', // SVG string or HTMLElement
  shortcut: 'S',
  cursor: 'crosshair',
  onActivate: () => console.log('Stamp tool activated'),
  onDeactivate: () => console.log('Stamp tool deactivated'),
  onMouseDown: (point, event) => {
    // Add custom annotation at click point
  },
});

editor.unregisterTool('stamp');
```

## Creating Plugins

```typescript
const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  install: (editor) => {
    // Add custom functionality
    editor.on('annotationAdd', (annotation) => {
      console.log('Annotation added:', annotation);
    });

    // Register custom tools
    editor.registerTool({ ... });
  },
  uninstall: (editor) => {
    // Cleanup
  },
};

// Use the plugin
const editor = new MarkupEditor({
  container: '#editor',
  plugins: [myPlugin],
});

// Or add later
editor.use(myPlugin);
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| P | Pen tool |
| R | Rectangle tool |
| O | Ellipse tool |
| A | Arrow tool |
| L | Line tool |
| T | Text tool |
| H | Highlight tool |
| C | Crop tool |
| B | Blur tool |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Delete/Backspace | Delete selected |
| Cmd/Ctrl + Left/Right | Previous/Next image |
| Escape | Deselect / Select tool |

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import {
  MarkupEditor,
  MarkupEditorOptions,
  MarkupEditorAPI,
  Annotation,
  ImageData,
  ToolType,
  ThemeMode,
} from '@markup/editor';
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
#
