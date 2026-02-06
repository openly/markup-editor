// Main export
export { MarkupEditor } from './core/MarkupEditor';

// Types
export type {
  MarkupEditorOptions,
  MarkupEditorAPI,
  MarkupPlugin,
  CustomTool,
  Annotation,
  AnnotationType,
  PenAnnotation,
  RectAnnotation,
  EllipseAnnotation,
  ArrowAnnotation,
  LineAnnotation,
  TextAnnotation,
  HighlightAnnotation,
  BlurAnnotation,
  HistoryEntry,
  ImageData,
  CropBounds,
  ToolType,
  ThemeMode,
  ThemeColors,
  Theme,
  EditorEvent,
  EditorStateData,
} from './types';

// Themes
export { lightTheme, darkTheme, getTheme } from './themes';

// Utilities
export { uid } from './utils/uid';
export { EventEmitter } from './utils/events';

// Default export for convenience
import { MarkupEditor } from './core/MarkupEditor';
export default MarkupEditor;
