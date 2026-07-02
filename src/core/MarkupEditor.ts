import type {
  MarkupEditorOptions,
  MarkupEditorAPI,
  MarkupPlugin,
  CustomTool,
  Annotation,
  ImageData,
  OverlayImageData,
  HistoryEntry,
  ToolType,
  ThemeMode,
  EditorStateData,
} from '../types';
import { Store } from './Store';
import { Canvas } from './Canvas';
import { UI } from '../ui/UI';
import { injectStyles } from '../ui/styles';
import { getTheme, applyTheme, watchSystemTheme } from '../themes';
import { uid } from '../utils/uid';
import { EventEmitter } from '../utils/events';

export class MarkupEditor extends EventEmitter implements MarkupEditorAPI {
  private container: HTMLElement;
  private store: Store;
  private canvas: Canvas | null = null;
  private ui: UI;
  private options: MarkupEditorOptions;
  private themeMode: ThemeMode;
  private unwatchTheme?: () => void;
  private plugins: MarkupPlugin[] = [];

  constructor(options: MarkupEditorOptions) {
    super();
    this.options = options;

    // Resolve container
    if (typeof options.container === 'string') {
      const el = document.querySelector(options.container);
      if (!el) throw new Error(`Container not found: ${options.container}`);
      this.container = el as HTMLElement;
    } else {
      this.container = options.container;
    }

    // Inject styles
    injectStyles();

    // Initialize theme
    this.themeMode = options.theme || 'light';
    applyTheme(this.container, getTheme(this.themeMode));

    if (this.themeMode === 'auto') {
      this.unwatchTheme = watchSystemTheme((isDark) => {
        applyTheme(this.container, getTheme(isDark ? 'dark' : 'light'));
        this.emit('themeChange', isDark ? 'dark' : 'light');
      });
    }

    // Initialize store
    this.store = new Store();
    this.setupStoreCallbacks();

    // Initialize UI
    this.ui = new UI(this.container, this.store, {
      showToolbar: options.showToolbar ?? true,
      showHistoryPanel: options.showHistoryPanel ?? true,
      showNotesPanel: options.showNotesPanel ?? true,
      withoutThumb: options.withoutThumb ?? false,
      showTopBar: options.showTopBar ?? true,
      tools: options.tools,
      onImageUpload: (files) => this.handleFileUpload(files),
      onUrlInput: (url) => this.loadImage(url),
      onOverlayUpload: (file, name) => this.handleOverlayUpload(file, name),
      onOverlayRemove: (id) => this.removeOverlayImage(id),
      onOverlayOpacityChange: (opacity) => this.setOverlayOpacity(opacity),
      onOverlaySetActive: (id) => this.setActiveOverlay(id),
      onGridToggle: () => this.toggleGrid(),
      onCompareToggle: () => this.toggleCompareMode(),
      defaultOverlayOpacity: options.defaultOverlayOpacity,
    });

    // Set initial tool settings
    if (options.defaultTool) {
      this.store.setTool(options.defaultTool);
    }
    if (options.defaultColor) {
      this.store.setColor(options.defaultColor);
    }
    if (options.defaultStrokeWidth) {
      this.store.setStrokeWidth(options.defaultStrokeWidth);
    }
    if (options.defaultFontSize) {
      this.store.setFontSize(options.defaultFontSize);
    }

    // Load initial images
    if (options.images && options.images.length > 0) {
      this.loadImages(options.images);
    } else {
      this.ui.showEmptyState();
    }

    // Install plugins
    if (options.plugins) {
      options.plugins.forEach((plugin) => this.use(plugin));
    }

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Emit ready
    setTimeout(() => {
      this.emit('ready', this);
      options.onReady?.(this);
    }, 0);
  }

  private setupStoreCallbacks(): void {
    this.store.on('annotationAdd', (annotation: Annotation) => {
      this.emit('annotationAdd', annotation);
      this.options.onAnnotationAdd?.(annotation);
    });

    this.store.on('annotationUpdate', (annotation: Annotation) => {
      this.emit('annotationUpdate', annotation);
      this.options.onAnnotationUpdate?.(annotation);
    });

    this.store.on('annotationDelete', (id: string) => {
      this.emit('annotationDelete', id);
      this.options.onAnnotationDelete?.(id);
    });

    this.store.on('imageChange', (image: ImageData, index: number) => {
      this.emit('imageChange', image, index);
      this.options.onImageChange?.(image, index);
    });

    this.store.on('selectionChange', (id: string | null) => {
      this.emit('annotationSelect', id);
    });

    this.store.on('toolChange', (tool: string) => {
      this.emit('toolChange', tool);
    });

    this.store.on('zoomChange', (scale: number) => {
      this.emit('zoomChange', scale);
    });

    this.store.on('historyChange', (history: HistoryEntry[]) => {
      this.emit('historyChange', history);
    });

    this.store.on('fitToScreen', () => {
      this.canvas?.fitToScreen();
    });

    this.store.on('textEditRequest', (annotation: Annotation) => {
      this.showTextEditModal(annotation);
    });

    this.store.on('overlayChange', (active: OverlayImageData | null) => {
      this.emit('overlayChange', active);
    });

    this.store.on('gridToggle', (visible: boolean) => {
      this.emit('gridToggle', visible);
    });

    this.store.on('compareModeChange', (enabled: boolean) => {
      this.emit('compareModeChange', enabled);
      if (enabled) {
        this.store.setTool('select');
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;
      const image = this.store.getCurrentImage();

      // Undo
      if (isMeta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (image) this.store.undo(image.id);
        return;
      }

      // Redo
      if ((isMeta && e.shiftKey && e.key.toLowerCase() === 'z') || (isMeta && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (image) this.store.redo(image.id);
        return;
      }

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && image) {
        const selectedId = this.store.getState().selectedId;
        if (selectedId) {
          e.preventDefault();
          this.store.deleteAnnotation(image.id, selectedId);
        }
        return;
      }

      // Grid toggle
      if (!isMeta && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        this.toggleGrid();
        return;
      }

      // Tool shortcuts
      if (!isMeta) {
        const toolMap: Record<string, ToolType> = {
          v: 'select',
          p: 'pen',
          r: 'rectangle',
          o: 'ellipse',
          a: 'arrow',
          l: 'line',
          t: 'text',
          h: 'highlight',
          c: 'crop',
          b: 'blur',
          u: 'curve',
          f: 'caption',
          k: 'callout',
          m: 'measure',
        };

        const tool = toolMap[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          this.store.setTool(tool);
        }
      }

      // Image navigation
      if (e.key === 'ArrowLeft' && isMeta) {
        e.preventDefault();
        this.store.previousImage();
      }
      if (e.key === 'ArrowRight' && isMeta) {
        e.preventDefault();
        this.store.nextImage();
      }

      // Escape
      if (e.key === 'Escape') {
        this.store.setTool('select');
        this.store.selectAnnotation(null);
      }
    };

    window.addEventListener('keydown', handler);
    this.on('destroy', () => window.removeEventListener('keydown', handler));
  }

  private async handleFileUpload(files: FileList): Promise<void> {
    const images: ImageData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        images.push({
          id: uid(),
          url,
          name: file.name,
          rotation: 0,
        });
      }
    }

    if (images.length > 0) {
      this.loadImages(images);
    }
  }

  private async handleOverlayUpload(file: File, name?: string): Promise<void> {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    await this.addOverlayImage(url, name || file.name);
  }

  private showTextEditModal(annotation: Annotation): void {
    if (annotation.type !== 'text' && annotation.type !== 'callout' && annotation.type !== 'caption') return;

    const overlay = document.createElement('div');
    overlay.className = 'me-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'me-modal';

    const title = document.createElement('div');
    title.className = 'me-modal-title';
    title.textContent = 'Edit Text';

    const textarea = document.createElement('textarea');
    textarea.className = 'me-modal-textarea';
    textarea.value = annotation.text;

    const actions = document.createElement('div');
    actions.className = 'me-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'me-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => overlay.remove();

    const saveBtn = document.createElement('button');
    saveBtn.className = 'me-btn me-btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
      const image = this.store.getCurrentImage();
      if (image && annotation.type === 'text') {
        const measure = document.createElement('canvas').getContext('2d');
        let fontSize = (annotation as any).fontSize || 16;
        const fontFamily = (annotation as any).fontFamily || 'Arial';
        const padding = 8;
        const annX = (annotation as any).x || 0;
        const imgWidth = image.originalWidth || 1000;
        const maxWidth = imgWidth - annX;

        if (measure) {
          measure.font = `${fontSize}px ${fontFamily}`;
          let textWidth = measure.measureText(textarea.value).width + padding;

          // Shrink font if text exceeds available image space
          if (textWidth > maxWidth) {
            fontSize = Math.max(8, Math.floor(fontSize * (maxWidth / textWidth)));
            measure.font = `${fontSize}px ${fontFamily}`;
            textWidth = measure.measureText(textarea.value).width + padding;
          }

          const finalWidth = Math.min(textWidth, maxWidth);
          // Auto-reposition: if text would overflow the image right edge, shift it left
          let newX = annX;
          if (annX + finalWidth > imgWidth) {
            newX = Math.max(0, imgWidth - finalWidth);
          }

          this.store.updateAnnotation(image.id, annotation.id, {
            text: textarea.value,
            width: finalWidth,
            fontSize,
            x: newX,
          });
        } else {
          this.store.updateAnnotation(image.id, annotation.id, {
            text: textarea.value,
          });
        }
      } else if (image) {
        this.store.updateAnnotation(image.id, annotation.id, {
          text: textarea.value,
        });
      }
      overlay.remove();
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    modal.appendChild(title);
    modal.appendChild(textarea);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    textarea.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveBtn.click();
      }
      if (e.key === 'Escape') {
        overlay.remove();
      }
    };

    this.ui.getCanvasContainer().appendChild(overlay);
    textarea.focus();
    textarea.select();
  }

  // Public API implementation

  destroy(): void {
    this.emit('destroy');
    this.plugins.forEach((plugin) => plugin.uninstall?.(this));
    this.unwatchTheme?.();
    this.canvas?.destroy();
    this.ui.destroy();
    this.store.reset();
    this.removeAllListeners();
  }

  // Images
  async loadImage(url: string, name?: string): Promise<void> {
    const image: ImageData = {
      id: uid(),
      url,
      name: name || 'Image',
      rotation: 0,
    };

    const hadImages = this.store.getState().images.length > 0;
    this.store.addImage(image);

    if (!hadImages) {
      this.ui.clearCanvasContainer();
      this.ui.showLoading();

      try {
        this.canvas = new Canvas(this.ui.getCanvasContainer(), this.store, this.options.autoHeight ?? false);
        await this.canvas.loadImage(url);
        this.canvas.renderAnnotations();
        this.emit('imageLoad', image);
      } catch (error) {
        this.ui.showError('Failed to load image', () => this.loadImage(url, name));
      }
    }
  }

  loadImages(images: ImageData[]): void {
    this.store.setImages(images);

    if (images.length > 0) {
      this.ui.clearCanvasContainer();
      this.ui.showLoading();

      const firstImage = images[0];
      this.canvas = new Canvas(this.ui.getCanvasContainer(), this.store, this.options.autoHeight ?? false);
      this.canvas
        .loadImage(firstImage.url)
        .then(() => {
          this.canvas?.renderAnnotations();
          this.emit('imageLoad', firstImage);
        })
        .catch(() => {
          this.ui.showError('Failed to load image');
        });
    }
  }

  getImages(): ImageData[] {
    return this.store.getState().images;
  }

  getCurrentImage(): ImageData | null {
    return this.store.getCurrentImage() || null;
  }

  getCurrentImageIndex(): number {
    return this.store.getState().currentImageIndex;
  }

  nextImage(): void {
    this.store.nextImage();
  }

  previousImage(): void {
    this.store.previousImage();
  }

  goToImage(index: number): void {
    this.store.goToImage(index);
  }

  rotateImage(degrees: 90 | -90 | 180): void {
    this.store.rotateImage(degrees);
  }

  // Annotations
  getAnnotations(imageId?: string): Annotation[] {
    const id = imageId || this.store.getCurrentImage()?.id;
    return id ? this.store.getAnnotations(id) : [];
  }

  addAnnotation(partial: Partial<Annotation>): Annotation {
    const image = this.store.getCurrentImage();
    if (!image) throw new Error('No image loaded');

    const annotation = {
      id: uid(),
      imageId: image.id,
      createdAt: Date.now(),
      color: this.store.getState().color,
      opacity: 1,
      ...partial,
    } as Annotation;

    this.store.addAnnotation(image.id, annotation);
    return annotation;
  }

  updateAnnotation(id: string, changes: Partial<Annotation>): void {
    const image = this.store.getCurrentImage();
    if (image) {
      this.store.updateAnnotation(image.id, id, changes);
    }
  }

  deleteAnnotation(id: string): void {
    const image = this.store.getCurrentImage();
    if (image) {
      this.store.deleteAnnotation(image.id, id);
    }
  }

  clearAnnotations(imageId?: string): void {
    const id = imageId || this.store.getCurrentImage()?.id;
    if (id) {
      this.store.clearAnnotations(id);
    }
  }

  selectAnnotation(id: string | null): void {
    this.store.selectAnnotation(id);
  }

  getSelectedAnnotation(): Annotation | null {
    const state = this.store.getState();
    if (!state.selectedId) return null;

    const image = this.store.getCurrentImage();
    if (!image) return null;

    return this.store.getAnnotations(image.id).find((a) => a.id === state.selectedId) || null;
  }

  // Tools
  setTool(tool: ToolType | string): void {
    this.store.setTool(tool);
  }

  getTool(): ToolType | string {
    return this.store.getState().currentTool;
  }

  setColor(color: string): void {
    this.store.setColor(color);
  }

  getColor(): string {
    return this.store.getState().color;
  }

  setStrokeWidth(width: number): void {
    this.store.setStrokeWidth(width);
  }

  getStrokeWidth(): number {
    return this.store.getState().strokeWidth;
  }

  setFontSize(size: number): void {
    this.store.setFontSize(size);
  }

  getFontSize(): number {
    return this.store.getState().fontSize;
  }

  // History
  undo(): void {
    const image = this.store.getCurrentImage();
    if (image) this.store.undo(image.id);
  }

  redo(): void {
    const image = this.store.getCurrentImage();
    if (image) this.store.redo(image.id);
  }

  canUndo(): boolean {
    const image = this.store.getCurrentImage();
    return image ? this.store.canUndo(image.id) : false;
  }

  canRedo(): boolean {
    const image = this.store.getCurrentImage();
    return image ? this.store.canRedo(image.id) : false;
  }

  getHistory(): HistoryEntry[] {
    const image = this.store.getCurrentImage();
    return image ? this.store.getHistory(image.id) : [];
  }

  // View
  zoomIn(): void {
    const state = this.store.getState();
    this.store.setScale(state.scale * 1.2);
  }

  zoomOut(): void {
    const state = this.store.getState();
    this.store.setScale(state.scale / 1.2);
  }

  setZoom(scale: number): void {
    this.store.setScale(scale);
  }

  getZoom(): number {
    return this.store.getState().scale;
  }

  fitToScreen(): void {
    this.canvas?.fitToScreen();
  }

  resetView(): void {
    this.store.resetView();
  }

  // Theme
  setTheme(mode: ThemeMode): void {
    this.themeMode = mode;
    applyTheme(this.container, getTheme(mode));

    // Update auto-watch
    this.unwatchTheme?.();
    if (mode === 'auto') {
      this.unwatchTheme = watchSystemTheme((isDark) => {
        applyTheme(this.container, getTheme(isDark ? 'dark' : 'light'));
        this.emit('themeChange', isDark ? 'dark' : 'light');
      });
    }

    this.emit('themeChange', mode);
  }

  getTheme(): ThemeMode {
    return this.themeMode;
  }

  // Export
  async exportImage(format: 'png' | 'jpeg', quality = 0.92): Promise<string> {
    if (!this.canvas) throw new Error('No canvas available');

    const stage = this.canvas.getStage();
    const dims = this.canvas.getImageDimensions();
    if (!dims) throw new Error('No image loaded');

    const originalScale = { x: stage.scaleX(), y: stage.scaleY() };
    const originalPosition = { x: stage.x(), y: stage.y() };
    const originalWidth = stage.width();
    const originalHeight = stage.height();

    // Temporarily set stage to original image dimensions with no transform
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.width(dims.width);
    stage.height(dims.height);

    // Deselect annotations to hide handles/guide lines during export
    const previousSelectedId = this.store.getState().selectedId;
    if (previousSelectedId) {
      this.store.selectAnnotation(null);
    }

    // Hide grid layer and transformer during export
    const gridLayer = this.canvas.getGridLayer();
    const gridWasVisible = gridLayer.visible();
    gridLayer.visible(false);
    const { wasVisible: transformerWasVisible } = this.canvas.hideTransformer();

    const dataUrl = stage.toDataURL({
      mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
      quality,
      x: 0,
      y: 0,
      width: dims.width,
      height: dims.height,
      pixelRatio: 1,
    });

    // Restore original state
    if (previousSelectedId) {
      this.store.selectAnnotation(previousSelectedId);
    }
    if (transformerWasVisible) this.canvas.showTransformer();
    gridLayer.visible(gridWasVisible);
    stage.width(originalWidth);
    stage.height(originalHeight);
    stage.scale(originalScale);
    stage.position(originalPosition);

    this.emit('export', dataUrl, format);
    this.options.onExport?.(dataUrl, format);

    return dataUrl;
  }

  exportAnnotations(): Annotation[] {
    const image = this.store.getCurrentImage();
    return image ? this.store.getAnnotations(image.id) : [];
  }

  importAnnotations(annotations: Annotation[]): void {
    const image = this.store.getCurrentImage();
    if (!image) return;

    annotations.forEach((annotation) => {
      this.store.addAnnotation(image.id, {
        ...annotation,
        id: uid(),
        imageId: image.id,
      });
    });
  }

  // State persistence
  saveState(): EditorStateData {
    return this.store.saveState();
  }

  loadState(state: EditorStateData): void {
    this.store.loadState(state);
  }

  // Notes
  setNote(note: string): void {
    this.store.setImageNote(note);
  }

  getNote(): string {
    return this.store.getCurrentImage()?.note || '';
  }

  // Overlay
  async setOverlayImage(url: string, name?: string): Promise<void> {
    // Backwards compat: clears all existing overlays, adds this one
    if (!this.canvas) throw new Error('No canvas available');
    this.store.getState().overlayImages.forEach(o => {
      this.canvas?.removeOverlayById(o.id);
    });
    // Reset store overlays manually
    this.store.getState().overlayImages = [];
    this.store.getState().activeOverlayId = null;
    await this.addOverlayImage(url, name);
  }

  async addOverlayImage(url: string, name?: string): Promise<string> {
    if (!this.canvas) throw new Error('No canvas available');
    const id = uid();
    const opacity = this.options.defaultOverlayOpacity ?? 0.3;
    await this.canvas.loadOverlayImage(id, url, opacity);
    this.store.addOverlayImage({ id, url, name: name || 'Overlay', opacity });
    return id;
  }

  removeOverlayImage(id?: string): void {
    if (id) {
      this.canvas?.removeOverlayById(id);
      this.store.removeOverlayImage(id);
    } else {
      const active = this.store.getActiveOverlay();
      if (active) {
        this.canvas?.removeOverlayById(active.id);
        this.store.removeOverlayImage(active.id);
      }
    }
  }

  getOverlayImage(): OverlayImageData | null {
    return this.store.getActiveOverlay();
  }

  getOverlayImages(): OverlayImageData[] {
    return this.store.getState().overlayImages;
  }

  setActiveOverlay(id: string | null): void {
    this.store.setActiveOverlay(id);
  }

  getActiveOverlay(): OverlayImageData | null {
    return this.store.getActiveOverlay();
  }

  setOverlayOpacity(opacity: number): void {
    this.store.setOverlayOpacity(opacity);
  }

  getOverlayOpacity(): number {
    return this.store.getActiveOverlay()?.opacity ?? 0.3;
  }

  // Grid
  toggleGrid(): void {
    this.store.toggleGrid();
  }

  isGridVisible(): boolean {
    return this.store.getState().gridVisible;
  }

  // Compare
  toggleCompareMode(): void {
    this.store.toggleCompareMode();
  }

  isCompareMode(): boolean {
    return this.store.getState().compareMode;
  }

  // Extension
  registerTool(tool: CustomTool): void {
    this.ui.registerCustomTool(tool);
  }

  unregisterTool(toolId: string): void {
    this.ui.unregisterCustomTool(toolId);
  }

  use(plugin: MarkupPlugin): void {
    this.plugins.push(plugin);
    plugin.install(this);
  }
}
