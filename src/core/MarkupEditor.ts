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
import {
  preserveImageState,
  findPreservedState,
  clearPreservedState,
} from './preservation';
import { UI } from '../ui/UI';
import { injectStyles } from '../ui/styles';
import { getTheme, applyTheme, watchSystemTheme } from '../themes';
import { uid } from '../utils/uid';
import { EventEmitter } from '../utils/events';

// Coalesce/defer window for exportImage. Hosts call exportImage on every
// annotation change; on a high-resolution photo the full-res render blocks the
// main thread long enough to jank the *next* mark. We wait this long after the
// last request (and until the user lifts the pointer) before rendering once, so
// bursts of marks never each trigger a render. See exportImage.
const EXPORT_IDLE_DELAY = 400;

// Cap the exported image's long edge. The render (stage.toCanvas) cost scales
// with the *output* pixel count, so rasterizing a 51MP photo at native size
// blocks the main thread ~2s per export; capping the long edge to this many
// pixels rasterizes far fewer pixels (~250ms at 3000px) while staying sharp
// enough for an annotation/review artifact. The pixel ratio scales the image
// and annotations together, so annotation positions stay correct. Set to 0 to
// export at native resolution.
const EXPORT_MAX_DIMENSION = 3000;

export class MarkupEditor extends EventEmitter implements MarkupEditorAPI {
  private container: HTMLElement;
  private store: Store;
  private canvas: Canvas | null = null;
  private ui: UI;
  private options: MarkupEditorOptions;
  private themeMode: ThemeMode;
  private unwatchTheme?: () => void;
  private plugins: MarkupPlugin[] = [];
  private preserveAnnotations: boolean;

  // Deferred-export state (see exportImage / flushDeferredExport)
  private exportIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private exportWaiters: Array<{
    resolve: (dataUrl: string) => void;
    reject: (err: unknown) => void;
  }> = [];
  private latestExportArgs: { format: 'png' | 'jpeg'; quality: number } | null =
    null;

  /** Drop all annotation state preserved across editor instances. */
  static clearPreservedAnnotations(): void {
    clearPreservedState();
  }

  constructor(options: MarkupEditorOptions) {
    super();
    this.options = options;
    this.preserveAnnotations = options.preserveAnnotations ?? true;

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
      this.loadImages(options.images, options.initialImageIndex);
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
      // Keep the preservation registry current so state survives even if the
      // host recreates the editor without a clean destroy.
      const image = this.store.getCurrentImage();
      if (image) this.persistImageState(image);
    });

    this.store.on('fitToScreen', () => {
      this.canvas?.fitToScreen();
    });

    this.store.on('zoomBy', (factor: number) => {
      this.canvas?.zoomBy(factor);
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

  // ------- Annotation preservation across editor instances -------

  private persistImageState(image: ImageData): void {
    if (!this.preserveAnnotations) return;
    const annotations = this.store.getAnnotations(image.id);
    const history = this.store.getHistory(image.id);
    // Untouched image: keep whatever was preserved before instead of
    // overwriting it with an empty snapshot.
    if (annotations.length === 0 && history.length === 0) return;

    preserveImageState(image, {
      url: image.url,
      rotation: image.rotation,
      note: image.note,
      annotations: JSON.parse(JSON.stringify(annotations)),
      history: JSON.parse(JSON.stringify(history)),
      historyIndex: this.store.getHistoryIndex(image.id),
    });
  }

  private persistAllImageStates(): void {
    if (!this.preserveAnnotations) return;
    this.store.getState().images.forEach((image) => this.persistImageState(image));
  }

  private applyPreservedState(image: ImageData): void {
    if (!this.preserveAnnotations) return;
    const preserved = findPreservedState(image);
    if (!preserved) return;

    // Re-edit on the image the annotations were drawn on — not on a flattened
    // annotated export, which would double-render the shapes.
    image.url = preserved.url;
    image.rotation = preserved.rotation;
    if (preserved.note && !image.note) image.note = preserved.note;
    this.store.restoreImageState(image.id, preserved);

    // Surface the restored history in the UI when it's the visible image.
    if (this.store.getCurrentImage()?.id === image.id) {
      this.store.emit('historyChange', this.store.getHistory(image.id));
    }
  }

  // Public API implementation

  destroy(): void {
    // Flush any pending deferred export before tearing down, so a mark made
    // right before close still reaches the host. The toCanvas snapshot inside
    // renderAndEncode is synchronous and runs before the stage is destroyed
    // below; the async encode then finishes on the detached canvas.
    this.flushDeferredExport();
    this.persistAllImageStates();
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
    this.applyPreservedState(image);

    if (!hadImages) {
      this.ui.clearCanvasContainer();
      this.ui.showLoading();

      try {
        this.canvas = new Canvas(this.ui.getCanvasContainer(), this.store, this.options.autoHeight ?? false);
        // image.url may have been swapped to a preserved original url
        await this.canvas.loadImage(image.url);
        this.canvas.renderAnnotations();
        this.emit('imageLoad', image);
      } catch (error) {
        this.ui.showError('Failed to load image', () => this.loadImage(url, name));
      }
    }
  }

  loadImages(images: ImageData[], initialIndex = 0): void {
    // Keep the outgoing images' annotations before setImages wipes them.
    this.persistAllImageStates();
    this.store.setImages(images, initialIndex);
    images.forEach((image) => this.applyPreservedState(image));

    if (images.length > 0) {
      this.ui.clearCanvasContainer();
      this.ui.showLoading();

      const initialImage = this.store.getCurrentImage() || images[0];
      this.canvas = new Canvas(this.ui.getCanvasContainer(), this.store, this.options.autoHeight ?? false);
      this.canvas
        .loadImage(initialImage.url)
        .then(() => {
          this.canvas?.renderAnnotations();
          this.emit('imageLoad', initialImage);
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
  //
  // Hosts typically call this on every annotation change and save the result.
  // The render (stage.toCanvas) is synchronous and, on a high-resolution photo,
  // blocks the main thread long enough to stall the next mark. Two things keep
  // it off the marking hot path: (1) we COALESCE rapid calls and DEFER the
  // render until the user goes idle (pointer up + a short debounce), rendering
  // once and resolving every pending call with that single result; (2) the
  // render is capped to EXPORT_MAX_DIMENSION so even that one render is cheap.
  // A pending export is flushed synchronously in destroy() so a mark made right
  // before the editor closes is not lost.
  exportImage(format: 'png' | 'jpeg', quality = 0.92): Promise<string> {
    if (!this.canvas) return Promise.reject(new Error('No canvas available'));

    return new Promise<string>((resolve, reject) => {
      this.exportWaiters.push({ resolve, reject });
      this.latestExportArgs = { format, quality };
      this.scheduleDeferredExport();
    });
  }

  private scheduleDeferredExport(): void {
    if (this.exportIdleTimer) clearTimeout(this.exportIdleTimer);
    this.exportIdleTimer = setTimeout(() => {
      this.exportIdleTimer = null;
      // Never render mid-stroke — if the user is drawing, wait for them to
      // finish so the heavy render never lands on top of an active mark.
      if (this.canvas?.isBusy()) {
        this.scheduleDeferredExport();
        return;
      }
      this.flushDeferredExport();
    }, EXPORT_IDLE_DELAY);
  }

  // Render once and resolve every export request that has queued up since the
  // last render. Safe to call synchronously from destroy(): renderAndEncode's
  // toCanvas snapshot runs before its first await, so it is captured before the
  // stage is torn down; the async encode then completes on the detached canvas.
  private flushDeferredExport(): void {
    if (this.exportIdleTimer) {
      clearTimeout(this.exportIdleTimer);
      this.exportIdleTimer = null;
    }
    if (this.exportWaiters.length === 0) return;

    const waiters = this.exportWaiters;
    this.exportWaiters = [];
    const { format, quality } = this.latestExportArgs ?? {
      format: 'jpeg',
      quality: 0.92,
    };

    this.renderAndEncode(format, quality)
      .then((dataUrl) => waiters.forEach((w) => w.resolve(dataUrl)))
      .catch((err) => waiters.forEach((w) => w.reject(err)));
  }

  private async renderAndEncode(
    format: 'png' | 'jpeg',
    quality: number
  ): Promise<string> {
    if (!this.canvas) throw new Error('No canvas available');

    const stage = this.canvas.getStage();
    const dims = this.canvas.getImageDimensions();
    if (!dims) throw new Error('No image loaded');

    // Cap the output resolution so the render stays cheap on huge photos.
    const longEdge = Math.max(dims.width, dims.height);
    const exportPixelRatio =
      EXPORT_MAX_DIMENSION && longEdge > EXPORT_MAX_DIMENSION
        ? EXPORT_MAX_DIMENSION / longEdge
        : 1;

    const originalScale = { x: stage.scaleX(), y: stage.scaleY() };
    const originalPosition = { x: stage.x(), y: stage.y() };

    // Neutralize the on-screen fit transform so layers capture at native image
    // coordinates. We deliberately do NOT resize the stage to native dimensions:
    // buildExportCanvas captures each layer with an explicit rect + pixelRatio,
    // so the stage size is irrelevant — and resizing the on-screen stage to a
    // 51MP canvas is what used to block the main thread ~600ms per export.
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });

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

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

    // Render the frame to an offscreen canvas at the capped resolution.
    // buildExportCanvas composites a cached base-image render with the
    // annotation/overlay layers, so re-rasterizing the huge source image only
    // happens once (not on every mark). The pixelRatio scales image and
    // annotations together, keeping annotation positions correct.
    const canvas = this.canvas.buildExportCanvas(exportPixelRatio);

    // Restore original state immediately — the snapshot is already captured.
    if (previousSelectedId) {
      this.store.selectAnnotation(previousSelectedId);
    }
    if (transformerWasVisible) this.canvas.showTransformer();
    gridLayer.visible(gridWasVisible);
    stage.scale(originalScale);
    stage.position(originalPosition);

    // Encode asynchronously via toBlob + FileReader instead of the synchronous
    // stage.toDataURL(). On a high-resolution photo toDataURL blocks the main
    // thread for hundreds of ms (JPEG encode + base64 of a real photograph),
    // which janks the next annotation. toBlob offloads the encode and FileReader
    // does the base64 off the main thread, cutting the block ~10x. Same data-URL
    // output, so callers/contract are unchanged.
    const dataUrl = await new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Some browsers may return null (e.g. tainted canvas) — fall back to
            // the synchronous path so export still works.
            try {
              resolve(canvas.toDataURL(mimeType, quality));
            } catch (err) {
              reject(err);
            }
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        },
        mimeType,
        quality
      );
    });

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
