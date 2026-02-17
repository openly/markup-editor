import type {
  Annotation,
  HistoryEntry,
  ImageData,
  OverlayImageData,
  ToolType,
  EditorStateData,
} from '../types';
import { uid } from '../utils/uid';
import { EventEmitter } from '../utils/events';

export interface StoreState {
  // Images
  images: ImageData[];
  currentImageIndex: number;

  // Annotations (keyed by imageId)
  annotationsByImage: Record<string, Annotation[]>;

  // History (keyed by imageId)
  historyByImage: Record<string, HistoryEntry[]>;
  historyIndexByImage: Record<string, number>;

  // Selection
  selectedId: string | null;

  // Tool settings
  currentTool: ToolType | string;
  color: string;
  strokeWidth: number;
  fontSize: number;
  highlightColor: string;

  // Canvas
  scale: number;
  position: { x: number; y: number };

  // Overlay
  overlayImages: OverlayImageData[];
  activeOverlayId: string | null;

  // Grid
  gridVisible: boolean;

  // Compare
  compareMode: boolean;
}

const initialState: StoreState = {
  images: [],
  currentImageIndex: 0,
  annotationsByImage: {},
  historyByImage: {},
  historyIndexByImage: {},
  selectedId: null,
  currentTool: 'select',
  color: '#ff0000',
  strokeWidth: 3,
  fontSize: 24,
  highlightColor: '#ffff00',
  scale: 1,
  position: { x: 0, y: 0 },
  overlayImages: [],
  activeOverlayId: null,
  gridVisible: false,
  compareMode: false,
};

function getAnnotationTypeName(type: string): string {
  const names: Record<string, string> = {
    pen: 'Pen stroke',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    arrow: 'Arrow',
    line: 'Line',
    text: 'Text',
    highlight: 'Highlight',
    blur: 'Blur',
  };
  return names[type] || type;
}

export class Store extends EventEmitter {
  private state: StoreState;

  constructor() {
    super();
    this.state = { ...initialState };
  }

  getState(): StoreState {
    return this.state;
  }

  // Image actions
  setImages(images: ImageData[]): void {
    this.state.images = images;
    this.state.currentImageIndex = 0;
    this.emit('imagesChange', images);
  }

  addImage(image: ImageData): void {
    this.state.images.push(image);
    this.emit('imageAdd', image);
  }

  getCurrentImage(): ImageData | undefined {
    return this.state.images[this.state.currentImageIndex];
  }

  nextImage(): void {
    if (this.state.currentImageIndex < this.state.images.length - 1) {
      this.state.currentImageIndex++;
      this.emit('imageChange', this.getCurrentImage(), this.state.currentImageIndex);
    }
  }

  previousImage(): void {
    if (this.state.currentImageIndex > 0) {
      this.state.currentImageIndex--;
      this.emit('imageChange', this.getCurrentImage(), this.state.currentImageIndex);
    }
  }

  goToImage(index: number): void {
    if (index >= 0 && index < this.state.images.length) {
      this.state.currentImageIndex = index;
      this.emit('imageChange', this.getCurrentImage(), index);
    }
  }

  rotateImage(degrees: number): void {
    const image = this.getCurrentImage();
    if (image) {
      image.rotation = (image.rotation + degrees + 360) % 360;
      this.emit('imageRotate', image);
    }
  }

  setImageNote(note: string): void {
    const image = this.getCurrentImage();
    if (image) {
      image.note = note;
      this.emit('noteChange', note);
    }
  }

  // Annotation actions
  addAnnotation(imageId: string, annotation: Annotation): void {
    if (!this.state.annotationsByImage[imageId]) {
      this.state.annotationsByImage[imageId] = [];
      this.state.historyByImage[imageId] = [];
      this.state.historyIndexByImage[imageId] = -1;
    }

    this.state.annotationsByImage[imageId].push(annotation);
    this.createHistoryEntry(imageId, 'add', annotation);
    this.emit('annotationAdd', annotation);
  }

  updateAnnotation(imageId: string, id: string, changes: Partial<Annotation>): void {
    const annotations = this.state.annotationsByImage[imageId];
    if (!annotations) return;

    const index = annotations.findIndex((a) => a.id === id);
    if (index === -1) return;

    const updated = { ...annotations[index], ...changes } as Annotation;
    annotations[index] = updated;
    this.createHistoryEntry(imageId, 'modify', updated);
    this.emit('annotationUpdate', updated);
  }

  deleteAnnotation(imageId: string, id: string): void {
    const annotations = this.state.annotationsByImage[imageId];
    if (!annotations) return;

    const annotation = annotations.find((a) => a.id === id);
    if (!annotation) return;

    this.state.annotationsByImage[imageId] = annotations.filter((a) => a.id !== id);

    if (this.state.selectedId === id) {
      this.state.selectedId = null;
    }

    this.createHistoryEntry(imageId, 'delete', annotation);
    this.emit('annotationDelete', id);
  }

  getAnnotations(imageId: string): Annotation[] {
    return this.state.annotationsByImage[imageId] || [];
  }

  selectAnnotation(id: string | null): void {
    this.state.selectedId = id;
    this.emit('selectionChange', id);
  }

  clearAnnotations(imageId: string): void {
    this.state.annotationsByImage[imageId] = [];
    this.state.selectedId = null;
    this.emit('annotationsClear', imageId);
  }

  // History actions
  private createHistoryEntry(
    imageId: string,
    action: 'add' | 'modify' | 'delete' | 'crop',
    annotation: Annotation
  ): void {
    const currentIndex = this.state.historyIndexByImage[imageId] ?? -1;

    // Truncate redo history
    this.state.historyByImage[imageId] = this.state.historyByImage[imageId].slice(
      0,
      currentIndex + 1
    );

    const entry: HistoryEntry = {
      id: uid(),
      timestamp: Date.now(),
      action,
      description: `${action === 'add' ? 'Added' : action === 'modify' ? 'Modified' : 'Deleted'} ${getAnnotationTypeName(annotation.type)}`,
      annotationId: annotation.id,
      snapshot: JSON.parse(JSON.stringify(this.state.annotationsByImage[imageId])),
    };

    this.state.historyByImage[imageId].push(entry);
    this.state.historyIndexByImage[imageId]++;
    this.emit('historyChange', this.getHistory(imageId));
  }

  undo(imageId: string): void {
    const currentIndex = this.state.historyIndexByImage[imageId] ?? -1;
    if (currentIndex > 0) {
      this.state.historyIndexByImage[imageId] = currentIndex - 1;
      const previousEntry = this.state.historyByImage[imageId][currentIndex - 1];
      this.state.annotationsByImage[imageId] = JSON.parse(
        JSON.stringify(previousEntry.snapshot)
      );
      this.state.selectedId = null;
      this.emit('historyChange', this.getHistory(imageId));
    } else if (currentIndex === 0) {
      this.state.historyIndexByImage[imageId] = -1;
      this.state.annotationsByImage[imageId] = [];
      this.state.selectedId = null;
      this.emit('historyChange', this.getHistory(imageId));
    }
  }

  redo(imageId: string): void {
    const currentIndex = this.state.historyIndexByImage[imageId] ?? -1;
    const history = this.state.historyByImage[imageId] || [];
    if (currentIndex < history.length - 1) {
      this.state.historyIndexByImage[imageId] = currentIndex + 1;
      const nextEntry = history[currentIndex + 1];
      this.state.annotationsByImage[imageId] = JSON.parse(
        JSON.stringify(nextEntry.snapshot)
      );
      this.emit('historyChange', this.getHistory(imageId));
    }
  }

  canUndo(imageId: string): boolean {
    return (this.state.historyIndexByImage[imageId] ?? -1) >= 0;
  }

  canRedo(imageId: string): boolean {
    const currentIndex = this.state.historyIndexByImage[imageId] ?? -1;
    const history = this.state.historyByImage[imageId] || [];
    return currentIndex < history.length - 1;
  }

  getHistory(imageId: string): HistoryEntry[] {
    return this.state.historyByImage[imageId] || [];
  }

  getHistoryIndex(imageId: string): number {
    return this.state.historyIndexByImage[imageId] ?? -1;
  }

  jumpToHistory(imageId: string, index: number): void {
    const history = this.state.historyByImage[imageId] || [];
    if (index >= 0 && index < history.length) {
      this.state.historyIndexByImage[imageId] = index;
      this.state.annotationsByImage[imageId] = JSON.parse(
        JSON.stringify(history[index].snapshot)
      );
      this.state.selectedId = null;
      this.emit('historyChange', history);
    } else if (index === -1) {
      this.state.historyIndexByImage[imageId] = -1;
      this.state.annotationsByImage[imageId] = [];
      this.state.selectedId = null;
      this.emit('historyChange', history);
    }
  }

  // Tool settings
  setTool(tool: ToolType | string): void {
    this.state.currentTool = tool;
    this.emit('toolChange', tool);
  }

  setColor(color: string): void {
    this.state.color = color;
    this.emit('colorChange', color);
  }

  setStrokeWidth(width: number): void {
    this.state.strokeWidth = width;
    this.emit('strokeWidthChange', width);
  }

  setFontSize(size: number): void {
    this.state.fontSize = size;
    this.emit('fontSizeChange', size);
  }

  setHighlightColor(color: string): void {
    this.state.highlightColor = color;
  }

  // Canvas
  setScale(scale: number): void {
    this.state.scale = Math.max(0.1, Math.min(5, scale));
    this.emit('zoomChange', this.state.scale);
  }

  setPosition(position: { x: number; y: number }): void {
    this.state.position = position;
    this.emit('positionChange', position);
  }

  resetView(): void {
    this.state.scale = 1;
    this.state.position = { x: 0, y: 0 };
    this.emit('viewReset');
  }

  // Overlay
  addOverlayImage(overlay: OverlayImageData): void {
    this.state.overlayImages.push(overlay);
    this.state.activeOverlayId = overlay.id;
    this.emit('overlayChange', overlay, this.state.overlayImages);
  }

  removeOverlayImage(id: string): void {
    this.state.overlayImages = this.state.overlayImages.filter(o => o.id !== id);
    if (this.state.activeOverlayId === id) {
      this.state.activeOverlayId = this.state.overlayImages.length > 0
        ? this.state.overlayImages[0].id
        : null;
    }
    this.emit('overlayChange', this.getActiveOverlay(), this.state.overlayImages);
  }

  setActiveOverlay(id: string | null): void {
    if (id === null || this.state.overlayImages.some(o => o.id === id)) {
      this.state.activeOverlayId = id;
      this.emit('overlayChange', this.getActiveOverlay(), this.state.overlayImages);
    }
  }

  getActiveOverlay(): OverlayImageData | null {
    return this.state.overlayImages.find(o => o.id === this.state.activeOverlayId) || null;
  }

  setOverlayOpacity(opacity: number): void {
    const active = this.getActiveOverlay();
    if (active) {
      active.opacity = Math.max(0, Math.min(1, opacity));
      this.emit('overlayChange', active, this.state.overlayImages);
    }
  }

  // Grid
  toggleGrid(): void {
    this.state.gridVisible = !this.state.gridVisible;
    this.emit('gridToggle', this.state.gridVisible);
  }

  // Compare
  toggleCompareMode(): void {
    this.state.compareMode = !this.state.compareMode;
    this.emit('compareModeChange', this.state.compareMode);
  }

  // State persistence
  saveState(): EditorStateData {
    return JSON.parse(JSON.stringify({
      version: 1,
      images: this.state.images.map((img) => ({
        id: img.id,
        name: img.name,
        rotation: img.rotation,
        originalWidth: img.originalWidth,
        originalHeight: img.originalHeight,
        note: img.note,
      })),
      currentImageIndex: this.state.currentImageIndex,
      annotationsByImage: this.state.annotationsByImage,
      historyByImage: this.state.historyByImage,
      historyIndexByImage: this.state.historyIndexByImage,
    }));
  }

  loadState(data: EditorStateData): void {
    // Restore annotations and history for each image by matching image IDs
    // The images themselves (with URLs) must already be loaded
    const existingImages = this.state.images;
    const existingById = new Map(existingImages.map((img) => [img.id, img]));

    // Update image metadata (rotation, notes) from saved state
    for (const savedImg of data.images) {
      const existing = existingById.get(savedImg.id);
      if (existing) {
        existing.rotation = savedImg.rotation;
        existing.note = savedImg.note;
        if (savedImg.originalWidth) existing.originalWidth = savedImg.originalWidth;
        if (savedImg.originalHeight) existing.originalHeight = savedImg.originalHeight;
      }
    }

    // Restore annotations and history
    this.state.annotationsByImage = JSON.parse(JSON.stringify(data.annotationsByImage));
    this.state.historyByImage = JSON.parse(JSON.stringify(data.historyByImage));
    this.state.historyIndexByImage = { ...data.historyIndexByImage };

    // Navigate to saved image index
    if (data.currentImageIndex >= 0 && data.currentImageIndex < this.state.images.length) {
      this.state.currentImageIndex = data.currentImageIndex;
    }

    this.state.selectedId = null;
    this.emit('imageChange', this.getCurrentImage(), this.state.currentImageIndex);
    this.emit('historyChange', this.getHistory(this.getCurrentImage()?.id || ''));
  }
}
