// Tool types
export type ToolType =
  | 'select'
  | 'pen'
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'text'
  | 'highlight'
  | 'crop'
  | 'blur';

// Annotation types
export type AnnotationType = Exclude<ToolType, 'select' | 'crop'>;

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  imageId: string;
  createdAt: number;
  color: string;
  opacity: number;
}

export interface PenAnnotation extends BaseAnnotation {
  type: 'pen';
  points: number[];
  strokeWidth: number;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
  fill?: string;
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: 'ellipse';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  strokeWidth: number;
  fill?: string;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  points: [number, number, number, number];
  strokeWidth: number;
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  points: [number, number, number, number];
  strokeWidth: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  width?: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight';
  points: number[];
  strokeWidth: number;
}

export interface BlurAnnotation extends BaseAnnotation {
  type: 'blur';
  x: number;
  y: number;
  width: number;
  height: number;
  mode: 'blur' | 'redact';
}

export type Annotation =
  | PenAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | LineAnnotation
  | TextAnnotation
  | HighlightAnnotation
  | BlurAnnotation;

// History
export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: 'add' | 'modify' | 'delete' | 'crop';
  description: string;
  annotationId?: string;
  snapshot: Annotation[];
}

// Image data
export interface ImageData {
  id: string;
  url: string;
  name: string;
  rotation: number;
  originalWidth?: number;
  originalHeight?: number;
  note?: string;
}

export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Serialized editor state for save/load
export interface EditorStateData {
  version: number;
  images: {
    id: string;
    name: string;
    rotation: number;
    originalWidth?: number;
    originalHeight?: number;
    note?: string;
  }[];
  currentImageIndex: number;
  annotationsByImage: Record<string, Annotation[]>;
  historyByImage: Record<string, HistoryEntry[]>;
  historyIndexByImage: Record<string, number>;
}

// Theme
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  canvasBackground: string;
  toolbarBackground: string;
  panelBackground: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
}

// Editor options
export interface MarkupEditorOptions {
  container: HTMLElement | string;
  theme?: ThemeMode;
  tools?: ToolType[];
  defaultTool?: ToolType;
  defaultColor?: string;
  defaultStrokeWidth?: number;
  defaultFontSize?: number;
  images?: ImageData[];
  showToolbar?: boolean;
  showHistoryPanel?: boolean;
  showNotesPanel?: boolean;
  showTopBar?: boolean;
  toolbarPosition?: 'left' | 'right' | 'top' | 'bottom';
  locale?: string;
  plugins?: MarkupPlugin[];
  onReady?: (editor: MarkupEditorAPI) => void;
  onImageChange?: (image: ImageData, index: number) => void;
  onAnnotationAdd?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationDelete?: (id: string) => void;
  onExport?: (dataUrl: string, format: string) => void;
}

// Plugin interface
export interface MarkupPlugin {
  name: string;
  version?: string;
  install: (editor: MarkupEditorAPI) => void;
  uninstall?: (editor: MarkupEditorAPI) => void;
}

// Custom tool interface
export interface CustomTool {
  id: string;
  name: string;
  icon: string | HTMLElement;
  shortcut?: string;
  cursor?: string;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onMouseDown?: (point: { x: number; y: number }, event: MouseEvent) => void;
  onMouseMove?: (point: { x: number; y: number }, event: MouseEvent) => void;
  onMouseUp?: (point: { x: number; y: number }, event: MouseEvent) => void;
  render?: (ctx: CanvasRenderingContext2D) => void;
}

// Public API
export interface MarkupEditorAPI {
  // Lifecycle
  destroy: () => void;

  // Images
  loadImage: (url: string, name?: string) => Promise<void>;
  loadImages: (images: ImageData[]) => void;
  getImages: () => ImageData[];
  getCurrentImage: () => ImageData | null;
  getCurrentImageIndex: () => number;
  nextImage: () => void;
  previousImage: () => void;
  goToImage: (index: number) => void;
  rotateImage: (degrees: 90 | -90 | 180) => void;

  // Annotations
  getAnnotations: (imageId?: string) => Annotation[];
  addAnnotation: (annotation: Partial<Annotation>) => Annotation;
  updateAnnotation: (id: string, changes: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  clearAnnotations: (imageId?: string) => void;
  selectAnnotation: (id: string | null) => void;
  getSelectedAnnotation: () => Annotation | null;

  // Tools
  setTool: (tool: ToolType | string) => void;
  getTool: () => ToolType | string;
  setColor: (color: string) => void;
  getColor: () => string;
  setStrokeWidth: (width: number) => void;
  getStrokeWidth: () => number;
  setFontSize: (size: number) => void;
  getFontSize: () => number;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistory: () => HistoryEntry[];

  // View
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (scale: number) => void;
  getZoom: () => number;
  fitToScreen: () => void;
  resetView: () => void;

  // Theme
  setTheme: (mode: ThemeMode) => void;
  getTheme: () => ThemeMode;

  // Export
  exportImage: (format: 'png' | 'jpeg', quality?: number) => Promise<string>;
  exportAnnotations: () => Annotation[];
  importAnnotations: (annotations: Annotation[]) => void;

  // State persistence
  saveState: () => EditorStateData;
  loadState: (state: EditorStateData) => void;

  // Notes
  setNote: (note: string) => void;
  getNote: () => string;

  // Extension
  registerTool: (tool: CustomTool) => void;
  unregisterTool: (toolId: string) => void;
  use: (plugin: MarkupPlugin) => void;

  // Events
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

// Events
export type EditorEvent =
  | 'ready'
  | 'destroy'
  | 'imageLoad'
  | 'imageChange'
  | 'annotationAdd'
  | 'annotationUpdate'
  | 'annotationDelete'
  | 'annotationSelect'
  | 'toolChange'
  | 'historyChange'
  | 'zoomChange'
  | 'themeChange'
  | 'export';
