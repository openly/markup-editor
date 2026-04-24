import Konva from 'konva';
import type { Store } from './Store';
import type {
  Annotation,
  CropBounds,
  OverlayImageData,
  ToolType,
  PenAnnotation,
  RectAnnotation,
  EllipseAnnotation,
  ArrowAnnotation,
  LineAnnotation,
  TextAnnotation,
  HighlightAnnotation,
  BlurAnnotation,
  MeasureAnnotation,
  CalloutAnnotation,
  CaptionAnnotation,
  CurveAnnotation,
} from '../types';
import { uid } from '../utils/uid';

export class Canvas {
  private static readonly SHAPE_MIN_SIZE = 5;
  private static readonly LINE_MIN_LENGTH = 10;
  private static readonly CROP_STROKE = '#0ea5e9';

  private container: HTMLElement;
  private store: Store;
  private stage: Konva.Stage;
  private imageLayer: Konva.Layer;
  private gridLayer: Konva.Layer;
  private overlayLayer: Konva.Layer;
  private annotationLayer: Konva.Layer;
  private previewLayer: Konva.Layer;
  private transformer: Konva.Transformer;
  private imageNode: Konva.Image | null = null;
  private imageElement: HTMLImageElement | null = null;

  // Multi-overlay
  private overlayNodes: Map<string, Konva.Image> = new Map();

  // Grid
  private gridLines: Konva.Line[] = [];

  // Compare mode
  private compareMode = false;
  private compareWrapper: HTMLElement | null = null;
  private compareLeftStage: Konva.Stage | null = null;
  private compareRightStage: Konva.Stage | null = null;
  private compareResizeObserver: ResizeObserver | null = null;

  // Drawing state
  private isDrawing = false;
  private startPoint: { x: number; y: number } | null = null;
  private currentPoints: number[] = [];
  private previewShape: Konva.Shape | Konva.Group | null = null;

  // Shape references
  private shapeRefs: Map<string, Konva.Shape | Konva.Group> = new Map();

  constructor(container: HTMLElement, store: Store) {
    this.container = container;
    this.store = store;

    // Create stage
    this.stage = new Konva.Stage({
      container: this.container as HTMLDivElement,
      width: this.container.offsetWidth,
      height: this.container.offsetHeight,
    });

    // Create layers
    this.imageLayer = new Konva.Layer();
    this.gridLayer = new Konva.Layer();
    this.overlayLayer = new Konva.Layer();
    this.annotationLayer = new Konva.Layer();
    this.previewLayer = new Konva.Layer();

    this.stage.add(this.imageLayer);
    this.stage.add(this.gridLayer);
    this.stage.add(this.overlayLayer);
    this.stage.add(this.annotationLayer);
    this.stage.add(this.previewLayer);

    // Create transformer for selection
    this.transformer = new Konva.Transformer({
      visible: false,
    });
    this.annotationLayer.add(this.transformer);

    this.setupEventListeners();
    this.setupStoreListeners();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      this.stage.width(this.container.offsetWidth);
      this.stage.height(this.container.offsetHeight);
    });
    resizeObserver.observe(this.container);
  }

  private setupEventListeners(): void {
    // Wheel for zoom
    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const state = this.store.getState();
      const oldScale = state.scale;
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - state.position.x) / oldScale,
        y: (pointer.y - state.position.y) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.1;
      const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
      const clampedScale = Math.max(0.1, Math.min(5, newScale));

      const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      };

      this.store.setScale(clampedScale);
      this.store.setPosition(newPos);
      this.updateTransform();
    });

    // Mouse events for drawing
    this.stage.on('mousedown touchstart', (e) => this.handleMouseDown(e));
    this.stage.on('mousemove touchmove', (e) => this.handleMouseMove(e));
    this.stage.on('mouseup touchend', (e) => this.handleMouseUp(e));

    // Click on stage to deselect
    this.stage.on('click tap', (e) => {
      if (e.target === this.stage || e.target === this.imageNode) {
        this.store.selectAnnotation(null);
        this.transformer.nodes([]);
        this.transformer.visible(false);
      }
    });
  }

  private setupStoreListeners(): void {
    this.store.on('imageChange', () => this.loadCurrentImage());
    this.store.on('imageRotate', () => this.updateImageRotation());
    this.store.on('toolChange', () => this.updateCursor());
    this.store.on('selectionChange', (id: string | null) => this.handleSelectionChange(id));
    this.store.on('annotationAdd', () => this.renderAnnotations());
    this.store.on('annotationUpdate', () => this.renderAnnotations());
    this.store.on('annotationDelete', () => this.renderAnnotations());
    this.store.on('annotationsRefresh', () => {
      const currentImage = this.store.getCurrentImage();
      if (currentImage && this.imageElement && this.imageElement.src !== currentImage.url) {
        this.loadImage(currentImage.url).then(() => this.renderAnnotations());
      } else {
        this.renderAnnotations();
      }
    });
    this.store.on('historyChange', () => this.renderAnnotations());
    this.store.on('zoomChange', () => this.updateTransform());
    this.store.on('positionChange', () => this.updateTransform());
    this.store.on('viewReset', () => this.updateTransform());
    this.store.on('overlayChange', (active: OverlayImageData | null) => this.updateOverlay(active));
    this.store.on('gridToggle', () => this.renderGrid());
    this.store.on('compareModeChange', (enabled: boolean) => this.setCompareMode(enabled));
  }

  private getPointerPosition(): { x: number; y: number } | null {
    const state = this.store.getState();
    const pointer = this.stage.getPointerPosition();
    if (!pointer) return null;

    // Convert screen coords to layer coords
    let x = (pointer.x - state.position.x) / state.scale;
    let y = (pointer.y - state.position.y) / state.scale;

    // Un-rotate to get image-space coords when image is rotated
    const currentImage = this.store.getCurrentImage();
    const rotation = currentImage ? currentImage.rotation : 0;
    if (rotation && this.imageElement) {
      const cx = this.imageElement.width / 2;
      const cy = this.imageElement.height / 2;
      const rad = (-rotation * Math.PI) / 180;
      const dx = x - cx;
      const dy = y - cy;
      x = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
      y = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }

    // Clamp to image bounds
    if (this.imageElement) {
      x = Math.max(0, Math.min(x, this.imageElement.width));
      y = Math.max(0, Math.min(y, this.imageElement.height));
    }

    return { x, y };
  }

  private clearPreviewShape(): void {
    if (this.previewShape) {
      this.previewShape.destroy();
      this.previewShape = null;
      this.previewLayer.batchDraw();
    }
  }

  private getRectFromPoints(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  private handleMouseDown(_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
    if (this.compareMode) return;

    const state = this.store.getState();
    const tool = state.currentTool as ToolType;

    if (tool === 'select') {
      // Enable stage dragging
      this.stage.draggable(true);
      return;
    }

    const point = this.getPointerPosition();
    if (!point) return;

    // Don't start drawing outside image bounds
    if (this.imageElement) {
      if (point.x <= 0 || point.y <= 0 ||
          point.x >= this.imageElement.width || point.y >= this.imageElement.height) {
        return;
      }
    }

    this.store.selectAnnotation(null);
    this.transformer.nodes([]);
    this.transformer.visible(false);

    this.isDrawing = true;
    this.startPoint = point;

    if (tool === 'pen' || tool === 'highlight') {
      this.currentPoints = [point.x, point.y];
    }
  }

  private handleMouseMove(_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
    if (!this.isDrawing || !this.startPoint) return;

    const state = this.store.getState();
    const tool = state.currentTool as ToolType;
    const point = this.getPointerPosition();
    if (!point) return;

    // Clear previous preview
    this.clearPreviewShape();

    if (tool === 'pen' || tool === 'highlight') {
      this.currentPoints.push(point.x, point.y);
      this.previewShape = new Konva.Line({
        points: this.currentPoints,
        stroke: state.color,
        strokeWidth: tool === 'highlight' ? state.strokeWidth * 4 : state.strokeWidth,
        opacity: tool === 'highlight' ? 0.4 : 1,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        globalCompositeOperation: tool === 'highlight' ? 'multiply' : 'source-over',
      });
    } else if (tool === 'callout') {
      const rect = this.getRectFromPoints(this.startPoint, point);
      const tailH = Math.min(15, rect.height * 0.3);
      const cornerR = Math.min(12, rect.width * 0.1, rect.height * 0.1);
      const group = new Konva.Group();
      group.add(new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        cornerRadius: cornerR,
        dash: [5, 5],
        fill: state.color,
        opacity: 0.7,
      }));
      // Tail pointer
      group.add(new Konva.Line({
        points: [
          rect.x + rect.width * 0.3, rect.y + rect.height,
          rect.x + rect.width * 0.2, rect.y + rect.height + tailH,
          rect.x + rect.width * 0.5, rect.y + rect.height,
        ],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        closed: true,
        fill: state.color,
        opacity: 0.7,
      }));
      this.previewShape = group;
    } else if (tool === 'caption') {
      const rect = this.getRectFromPoints(this.startPoint, point);
      const barH = Math.min(30, rect.height * 0.25);
      const group = new Konva.Group();
      // Frame border
      group.add(new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        dash: [5, 5],
      }));
      // Caption bar
      group.add(new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: barH,
        fill: state.color,
        opacity: 0.8,
      }));
      this.previewShape = group;
    } else if (tool === 'curve') {
      // Preview as a straight line; user bends it after placing
      this.previewShape = new Konva.Line({
        points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        dash: [5, 5],
        lineCap: 'round',
      });
    } else if (tool === 'rectangle' || tool === 'blur') {
      const rect = this.getRectFromPoints(this.startPoint, point);
      this.previewShape = new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        stroke: tool === 'blur' ? '#666' : state.color,
        strokeWidth: tool === 'blur' ? 2 : state.strokeWidth,
        dash: [5, 5],
        fill: tool === 'blur' ? 'rgba(0,0,0,0.2)' : undefined,
      });
    } else if (tool === 'ellipse') {
      const width = point.x - this.startPoint.x;
      const height = point.y - this.startPoint.y;
      this.previewShape = new Konva.Ellipse({
        x: (this.startPoint.x + point.x) / 2,
        y: (this.startPoint.y + point.y) / 2,
        radiusX: Math.abs(width) / 2,
        radiusY: Math.abs(height) / 2,
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        dash: [5, 5],
      });
    } else if (tool === 'arrow') {
      this.previewShape = new Konva.Arrow({
        points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        fill: state.color,
        pointerLength: state.strokeWidth * 6 + 4,
        pointerWidth: state.strokeWidth * 5 + 4,
        dash: [5, 5],
      });
    } else if (tool === 'line') {
      this.previewShape = new Konva.Line({
        points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        dash: [5, 5],
      });
    } else if (tool === 'measure') {
      const angle = Math.atan2(point.y - this.startPoint.y, point.x - this.startPoint.x);
      const capLen = 8;

      const group = new Konva.Group();
      group.add(new Konva.Line({
        points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        dash: [5, 5],
      }));
      // End caps
      group.add(new Konva.Line({
        points: [
          this.startPoint.x + Math.sin(angle) * capLen,
          this.startPoint.y - Math.cos(angle) * capLen,
          this.startPoint.x - Math.sin(angle) * capLen,
          this.startPoint.y + Math.cos(angle) * capLen,
        ],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
      }));
      group.add(new Konva.Line({
        points: [
          point.x + Math.sin(angle) * capLen,
          point.y - Math.cos(angle) * capLen,
          point.x - Math.sin(angle) * capLen,
          point.y + Math.cos(angle) * capLen,
        ],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
      }));
      this.previewShape = group;
    } else if (tool === 'crop') {
      const rect = this.getRectFromPoints(this.startPoint, point);
      this.previewShape = new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        stroke: Canvas.CROP_STROKE,
        strokeWidth: 2,
        dash: [8, 4],
        fill: 'rgba(14,165,233,0.12)',
      });
    }

    if (this.previewShape) {
      this.previewLayer.add(this.previewShape);
      this.previewLayer.batchDraw();
    }
  }

  private handleMouseUp(_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
    const state = this.store.getState();
    const tool = state.currentTool as ToolType;

    if (tool === 'select') {
      this.stage.draggable(false);
      const pos = this.stage.position();
      this.store.setPosition({ x: pos.x, y: pos.y });
      return;
    }

    if (!this.isDrawing || !this.startPoint) return;

    const image = this.store.getCurrentImage();
    if (!image) return;

    const point = this.getPointerPosition();
    if (!point) return;

    // Clear preview
    this.clearPreviewShape();

    let annotation: Annotation | null = null;

    switch (tool) {
      case 'pen':
        if (this.currentPoints.length >= 4) {
          annotation = {
            id: uid(),
            type: 'pen',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            points: this.currentPoints,
            strokeWidth: state.strokeWidth,
          } as PenAnnotation;
        }
        break;

      case 'highlight':
        if (this.currentPoints.length >= 4) {
          annotation = {
            id: uid(),
            type: 'highlight',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 0.4,
            points: this.currentPoints,
            strokeWidth: state.strokeWidth * 4,
          } as HighlightAnnotation;
        }
        break;

      case 'rectangle': {
        const rect = this.getRectFromPoints(this.startPoint, point);
        if (rect.width > Canvas.SHAPE_MIN_SIZE && rect.height > Canvas.SHAPE_MIN_SIZE) {
          annotation = {
            id: uid(),
            type: 'rectangle',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            strokeWidth: state.strokeWidth,
          } as RectAnnotation;
        }
        break;
      }

      case 'ellipse': {
        const width = point.x - this.startPoint.x;
        const height = point.y - this.startPoint.y;
        if (Math.abs(width) > Canvas.SHAPE_MIN_SIZE && Math.abs(height) > Canvas.SHAPE_MIN_SIZE) {
          annotation = {
            id: uid(),
            type: 'ellipse',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            x: (this.startPoint.x + point.x) / 2,
            y: (this.startPoint.y + point.y) / 2,
            radiusX: Math.abs(width) / 2,
            radiusY: Math.abs(height) / 2,
            strokeWidth: state.strokeWidth,
          } as EllipseAnnotation;
        }
        break;
      }

      case 'arrow': {
        const distance = Math.hypot(point.x - this.startPoint.x, point.y - this.startPoint.y);
        if (distance > Canvas.LINE_MIN_LENGTH) {
          annotation = {
            id: uid(),
            type: 'arrow',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
            strokeWidth: state.strokeWidth,
          } as ArrowAnnotation;
        }
        break;
      }

      case 'line': {
        const distance = Math.hypot(point.x - this.startPoint.x, point.y - this.startPoint.y);
        if (distance > Canvas.LINE_MIN_LENGTH) {
          annotation = {
            id: uid(),
            type: 'line',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
            strokeWidth: state.strokeWidth,
          } as LineAnnotation;
        }
        break;
      }

      case 'measure': {
        const dist = Math.hypot(point.x - this.startPoint.x, point.y - this.startPoint.y);
        if (dist > Canvas.LINE_MIN_LENGTH) {
          annotation = {
            id: uid(),
            type: 'measure',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
            strokeWidth: state.strokeWidth,
          } as MeasureAnnotation;
        }
        break;
      }

      case 'text': {
        // Convert screen fontSize to image-space so text appears readable at current zoom
        const effectiveFontSize = Math.round(state.fontSize / state.scale);
        annotation = {
          id: uid(),
          type: 'text',
          imageId: image.id,
          createdAt: Date.now(),
          color: state.color,
          opacity: 1,
          x: this.startPoint.x,
          y: this.startPoint.y,
          text: 'Text',
          fontSize: effectiveFontSize,
          fontFamily: 'Arial',
        } as TextAnnotation;
        break;
      }

      case 'callout': {
        const rect = this.getRectFromPoints(this.startPoint, point);
        if (rect.width > Canvas.SHAPE_MIN_SIZE && rect.height > Canvas.SHAPE_MIN_SIZE) {
          const effectiveFontSize = Math.round(state.fontSize / state.scale);
          annotation = {
            id: uid(),
            type: 'callout',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            text: 'Your text here',
            fontSize: effectiveFontSize,
            fontFamily: 'Arial',
            strokeWidth: state.strokeWidth,
          } as CalloutAnnotation;
        }
        break;
      }

      case 'caption': {
        const rect = this.getRectFromPoints(this.startPoint, point);
        if (rect.width > Canvas.SHAPE_MIN_SIZE && rect.height > Canvas.SHAPE_MIN_SIZE) {
          const effectiveFontSize = Math.round(state.fontSize / state.scale);
          annotation = {
            id: uid(),
            type: 'caption',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            text: 'Your text here',
            fontSize: effectiveFontSize,
            fontFamily: 'Arial',
            strokeWidth: state.strokeWidth,
          } as CaptionAnnotation;
        }
        break;
      }

      case 'curve': {
        const dist = Math.hypot(point.x - this.startPoint.x, point.y - this.startPoint.y);
        if (dist > Canvas.LINE_MIN_LENGTH) {
          // Control point starts on the line (straight); user drags it to curve
          const midX = (this.startPoint.x + point.x) / 2;
          const midY = (this.startPoint.y + point.y) / 2;
          annotation = {
            id: uid(),
            type: 'curve',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            points: [this.startPoint.x, this.startPoint.y, midX, midY, point.x, point.y],
            strokeWidth: state.strokeWidth,
          } as CurveAnnotation;
        }
        break;
      }

      case 'blur': {
        const rect = this.getRectFromPoints(this.startPoint, point);
        if (rect.width > Canvas.LINE_MIN_LENGTH && rect.height > Canvas.LINE_MIN_LENGTH) {
          annotation = {
            id: uid(),
            type: 'blur',
            imageId: image.id,
            createdAt: Date.now(),
            color: '#000000',
            opacity: 1,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            mode: 'blur',
          } as BlurAnnotation;
        }
        break;
      }

      case 'crop': {
        const rect = this.getRectFromPoints(this.startPoint, point);
        if (rect.width > Canvas.LINE_MIN_LENGTH && rect.height > Canvas.LINE_MIN_LENGTH) {
          this.applyCrop(rect);
        }
        break;
      }
    }

    if (annotation) {
      this.store.addAnnotation(image.id, annotation);
      if (tool === 'text') {
        this.store.selectAnnotation(annotation.id);
        this.store.setTool('select');
      } else if (tool === 'curve' || tool === 'caption' || tool === 'callout') {
        this.store.setTool('select');
      }
    }

    this.isDrawing = false;
    this.startPoint = null;
    this.currentPoints = [];
  }

  private handleSelectionChange(id: string | null): void {
    if (!id) {
      this.transformer.nodes([]);
      this.transformer.visible(false);
      return;
    }

    const shape = this.shapeRefs.get(id);
    if (shape) {
      this.transformer.nodes([shape]);
      this.transformer.rotateEnabled(false);
      this.transformer.keepRatio(false);
      if (shape instanceof Konva.Text) {
        this.transformer.enabledAnchors([
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
          'middle-left',
          'middle-right',
        ]);
      } else {
        this.transformer.enabledAnchors([
          'top-left',
          'top-center',
          'top-right',
          'middle-left',
          'middle-right',
          'bottom-left',
          'bottom-center',
          'bottom-right',
        ]);
      }
      this.transformer.visible(true);
    }
    this.annotationLayer.batchDraw();
  }

  private updateTransform(): void {
    const state = this.store.getState();
    this.stage.scale({ x: state.scale, y: state.scale });
    this.stage.position(state.position);
    this.stage.batchDraw();
  }

  private updateCursor(): void {
    const state = this.store.getState();
    const tool = state.currentTool;
    this.container.style.cursor = tool === 'select' ? 'grab' : 'crosshair';
  }

  async loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageElement = img;

        // Store original dimensions on the current ImageData
        const imageData = this.store.getCurrentImage();
        if (imageData) {
          imageData.originalWidth = img.width;
          imageData.originalHeight = img.height;
        }

        if (this.imageNode) {
          this.imageNode.destroy();
        }

        this.imageNode = new Konva.Image({
          image: img,
          x: img.width / 2,
          y: img.height / 2,
          offsetX: img.width / 2,
          offsetY: img.height / 2,
        });

        // Apply stored rotation before adding to layer
        const currentImg = this.store.getCurrentImage();
        const rotation = currentImg?.rotation || 0;
        if (rotation) {
          this.imageNode.rotation(rotation);
        }
        this.applyLayerRotation(this.annotationLayer, rotation);
        this.applyLayerRotation(this.previewLayer, rotation);

        this.imageLayer.add(this.imageNode);
        this.imageLayer.moveToBottom();
        this.imageLayer.batchDraw();

        // Fit to screen (accounts for rotation)
        this.fitToScreen();
        this.renderGrid();
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  private loadCurrentImage(): void {
    const image = this.store.getCurrentImage();
    if (image) {
      this.loadImage(image.url).then(() => {
        this.renderAnnotations();
        if (this.compareMode) {
          this.refreshCompareView();
        }
      });
    }
  }

  private applyLayerRotation(layer: Konva.Layer, rotation: number): void {
    if (!this.imageElement) return;
    const cx = this.imageElement.width / 2;
    const cy = this.imageElement.height / 2;
    layer.offset({ x: cx, y: cy });
    layer.position({ x: cx, y: cy });
    layer.rotation(rotation);
  }

  private updateImageRotation(): void {
    const image = this.store.getCurrentImage();
    if (this.imageNode && image) {
      this.imageNode.rotation(image.rotation);
      this.applyLayerRotation(this.annotationLayer, image.rotation);
      this.applyLayerRotation(this.previewLayer, image.rotation);
      this.imageLayer.batchDraw();
      this.annotationLayer.batchDraw();
      this.previewLayer.batchDraw();
      this.fitToScreen();
    }
  }

  // Multi-overlay methods
  async loadOverlayImage(id: string, url: string, opacity: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const node = new Konva.Image({
          image: img,
          x: 0,
          y: 0,
          opacity,
          listening: false,
          visible: false,
        });
        this.overlayNodes.set(id, node);
        this.overlayLayer.add(node);
        this.overlayLayer.batchDraw();
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load overlay image'));
      img.src = url;
    });
  }

  removeOverlayById(id: string): void {
    const node = this.overlayNodes.get(id);
    if (node) {
      node.destroy();
      this.overlayNodes.delete(id);
    }
    this.overlayLayer.batchDraw();
  }

  removeAllOverlays(): void {
    if (this.overlayNodes.size === 0) return;
    this.overlayNodes.forEach(node => node.destroy());
    this.overlayNodes.clear();
    this.overlayLayer.batchDraw();
  }

  private updateOverlay(active: OverlayImageData | null): void {
    // Hide all overlay nodes
    this.overlayNodes.forEach(node => node.visible(false));

    // Show and update the active one
    if (active) {
      const node = this.overlayNodes.get(active.id);
      if (node) {
        node.opacity(active.opacity);
        node.visible(true);
      }
    }
    this.overlayLayer.batchDraw();
    if (this.compareMode) {
      this.refreshCompareView();
    }
  }

  // Grid
  private renderGrid(): void {
    this.gridLines.forEach(l => l.destroy());
    this.gridLines = [];

    if (!this.store.getState().gridVisible || !this.imageElement) return;

    const w = this.imageElement.width;
    const h = this.imageElement.height;
    const lineStyle = {
      stroke: 'rgba(0,0,0,0.6)',
      strokeWidth: 3,
      dash: [6, 4],
      listening: false,
    };

    this.gridLines = [
      new Konva.Line({ points: [w / 3, 0, w / 3, h], ...lineStyle }),
      new Konva.Line({ points: [2 * w / 3, 0, 2 * w / 3, h], ...lineStyle }),
      new Konva.Line({ points: [0, h / 3, w, h / 3], ...lineStyle }),
      new Konva.Line({ points: [0, 2 * h / 3, w, 2 * h / 3], ...lineStyle }),
    ];
    this.gridLines.forEach(l => this.gridLayer.add(l));
    this.gridLayer.batchDraw();
  }

  // Compare mode — true side-by-side with two Konva stages
  private setCompareMode(enabled: boolean): void {
    this.compareMode = enabled;
    if (enabled) {
      this.enterCompareMode();
    } else {
      this.exitCompareMode();
    }
  }

  private refreshCompareView(): void {
    if (!this.compareMode) return;
    this.exitCompareMode();
    this.enterCompareMode();
  }

  private enterCompareMode(): void {
    if (!this.imageElement) return;
    if (this.compareWrapper || this.compareLeftStage || this.compareRightStage) {
      this.exitCompareMode();
    }

    const activeOverlay = this.store.getActiveOverlay();
    const activeNode = activeOverlay ? this.overlayNodes.get(activeOverlay.id) : null;
    const overlayImgElement = activeNode ? (activeNode.image() as HTMLImageElement) : null;

    // Hide the main stage
    const stageContainer = this.stage.container();
    stageContainer.style.display = 'none';

    // Create side-by-side wrapper
    this.compareWrapper = document.createElement('div');
    this.compareWrapper.className = 'me-compare-wrapper';

    const leftPane = document.createElement('div');
    leftPane.className = 'me-compare-pane';
    const leftLabel = document.createElement('div');
    leftLabel.className = 'me-compare-label';
    leftLabel.textContent = 'Original';
    const leftCanvas = document.createElement('div');
    leftCanvas.className = 'me-compare-canvas';

    const rightPane = document.createElement('div');
    rightPane.className = 'me-compare-pane';
    const rightLabel = document.createElement('div');
    rightLabel.className = 'me-compare-label';
    rightLabel.textContent = activeOverlay?.name || 'Overlay';
    const rightCanvas = document.createElement('div');
    rightCanvas.className = 'me-compare-canvas';

    const divider = document.createElement('div');
    divider.className = 'me-compare-divider';

    leftPane.appendChild(leftLabel);
    leftPane.appendChild(leftCanvas);
    rightPane.appendChild(rightLabel);
    rightPane.appendChild(rightCanvas);

    this.compareWrapper.appendChild(leftPane);
    this.compareWrapper.appendChild(divider);
    this.compareWrapper.appendChild(rightPane);
    this.container.appendChild(this.compareWrapper);

    // Create two stages after DOM layout — double rAF ensures flex layout is computed
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      const w = leftCanvas.offsetWidth || this.container.clientWidth / 2;
      const h = leftCanvas.offsetHeight || this.container.clientHeight;

      if (w === 0 || h === 0) return;

      this.compareLeftStage = new Konva.Stage({ container: leftCanvas, width: w, height: h });
      this.compareRightStage = new Konva.Stage({ container: rightCanvas, width: w, height: h });

      // Left: original image
      const leftLayer = new Konva.Layer();
      this.compareLeftStage.add(leftLayer);
      if (this.imageElement) {
        const leftImg = new Konva.Image({ image: this.imageElement, x: 0, y: 0 });
        leftLayer.add(leftImg);
      }

      // Right: overlay image (or original if no overlay)
      const rightLayer = new Konva.Layer();
      this.compareRightStage.add(rightLayer);
      if (overlayImgElement && this.imageElement) {
        // Base image first, then overlay on top
        const rightBase = new Konva.Image({ image: this.imageElement, x: 0, y: 0 });
        rightLayer.add(rightBase);
        const rightImg = new Konva.Image({ image: overlayImgElement, x: 0, y: 0 });
        if (activeOverlay) rightImg.opacity(activeOverlay.opacity);
        rightLayer.add(rightImg);
      } else {
        // No overlay — just show original
        const rightImgSrc = this.imageElement;
        if (rightImgSrc) {
          const rightImg = new Konva.Image({ image: rightImgSrc, x: 0, y: 0 });
          rightLayer.add(rightImg);
        }
      }

      // Fit both to their containers
      const fitStage = (stage: Konva.Stage, imgEl: HTMLImageElement) => {
        const padding = 20;
        const sw = stage.width();
        const sh = stage.height();
        const scaleX = (sw - padding * 2) / imgEl.width;
        const scaleY = (sh - padding * 2) / imgEl.height;
        const scale = Math.min(scaleX, scaleY, 1);
        const x = (sw - imgEl.width * scale) / 2;
        const y = (sh - imgEl.height * scale) / 2;
        stage.scale({ x: scale, y: scale });
        stage.position({ x, y });
        stage.batchDraw();
      };

      if (this.imageElement) {
        fitStage(this.compareLeftStage, this.imageElement);
        fitStage(this.compareRightStage, this.imageElement);
      }

      // Synced zoom/pan
      const syncTransform = (source: Konva.Stage, target: Konva.Stage) => {
        target.scale(source.scale());
        target.position(source.position());
        target.batchDraw();
      };

      const setupWheel = (stage: Konva.Stage, other: Konva.Stage) => {
        stage.on('wheel', (e) => {
          e.evt.preventDefault();
          const oldScale = stage.scaleX();
          const pointer = stage.getPointerPosition();
          if (!pointer) return;

          const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
          };

          const direction = e.evt.deltaY > 0 ? -1 : 1;
          const newScale = Math.max(0.1, Math.min(5, direction > 0 ? oldScale * 1.1 : oldScale / 1.1));
          const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
          };

          stage.scale({ x: newScale, y: newScale });
          stage.position(newPos);
          stage.batchDraw();
          syncTransform(stage, other);
        });
      };

      const setupDrag = (stage: Konva.Stage, other: Konva.Stage) => {
        stage.draggable(true);
        stage.on('dragmove', () => syncTransform(stage, other));
      };

      setupWheel(this.compareLeftStage, this.compareRightStage);
      setupWheel(this.compareRightStage, this.compareLeftStage);
      setupDrag(this.compareLeftStage, this.compareRightStage);
      setupDrag(this.compareRightStage, this.compareLeftStage);

      // Resize observer
      this.compareResizeObserver = new ResizeObserver(() => {
        if (!this.compareLeftStage || !this.compareRightStage) return;
        const lw = leftCanvas.offsetWidth;
        const lh = leftCanvas.offsetHeight;
        this.compareLeftStage.width(lw);
        this.compareLeftStage.height(lh);
        this.compareRightStage.width(rightCanvas.offsetWidth);
        this.compareRightStage.height(rightCanvas.offsetHeight);
        if (this.imageElement) {
          fitStage(this.compareLeftStage, this.imageElement);
          fitStage(this.compareRightStage, this.imageElement);
        }
      });
      this.compareResizeObserver.observe(leftCanvas);
    }); });
  }

  private exitCompareMode(): void {
    // Destroy compare stages
    this.compareResizeObserver?.disconnect();
    this.compareResizeObserver = null;
    this.compareLeftStage?.destroy();
    this.compareLeftStage = null;
    this.compareRightStage?.destroy();
    this.compareRightStage = null;

    // Remove wrapper
    if (this.compareWrapper) {
      this.compareWrapper.remove();
      this.compareWrapper = null;
    }

    // Show main stage
    const stageContainer = this.stage.container();
    stageContainer.style.display = '';
  }

  getGridLayer(): Konva.Layer {
    return this.gridLayer;
  }

  hideTransformer(): { wasVisible: boolean } {
    const wasVisible = this.transformer.visible();
    this.transformer.visible(false);
    this.annotationLayer.batchDraw();
    return { wasVisible };
  }

  showTransformer(): void {
    this.transformer.visible(true);
    this.annotationLayer.batchDraw();
  }

  fitToScreen(): void {
    if (!this.imageElement) return;

    const padding = 40;
    const stageWidth = this.stage.width();
    const stageHeight = this.stage.height();
    const origWidth = this.imageElement.width;
    const origHeight = this.imageElement.height;

    // Account for rotation: swap dimensions for 90/270 degrees
    const currentImage = this.store.getCurrentImage();
    const rotation = currentImage ? currentImage.rotation : 0;
    const isRotated = rotation === 90 || rotation === 270;
    const imageWidth = isRotated ? origHeight : origWidth;
    const imageHeight = isRotated ? origWidth : origHeight;

    const scaleX = (stageWidth - padding * 2) / imageWidth;
    const scaleY = (stageHeight - padding * 2) / imageHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    // When rotated, the bounding box shifts in layer coords due to offset-based rotation
    const bbLeft = isRotated ? (origWidth - origHeight) / 2 : 0;
    const bbTop = isRotated ? (origHeight - origWidth) / 2 : 0;
    const x = (stageWidth - imageWidth * scale) / 2 - bbLeft * scale;
    const y = (stageHeight - imageHeight * scale) / 2 - bbTop * scale;

    this.store.setScale(scale);
    this.store.setPosition({ x, y });
    this.updateTransform();
  }

  renderAnnotations(): void {
    // Clear transformer
    this.transformer.nodes([]);
    this.transformer.visible(false);

    // Clear existing shapes
    this.shapeRefs.forEach((shape) => shape.destroy());
    this.shapeRefs.clear();

    const image = this.store.getCurrentImage();
    if (!image) return;

    const annotations = this.store.getAnnotations(image.id);
    const selectedId = this.store.getState().selectedId;

    annotations.forEach((annotation) => {
      const shape = this.createShape(annotation);
      if (shape) {
        this.shapeRefs.set(annotation.id, shape);
        this.annotationLayer.add(shape);

        if (annotation.id === selectedId) {
          this.transformer.nodes([shape]);
          this.transformer.visible(true);
        }
      }
    });

    // Keep transformer on top
    this.transformer.moveToTop();
    this.annotationLayer.batchDraw();
  }

  private createShape(annotation: Annotation): Konva.Shape | Konva.Group | null {
    const image = this.store.getCurrentImage();
    if (!image) return null;

    const imgW = this.imageElement?.width ?? Infinity;
    const imgH = this.imageElement?.height ?? Infinity;

    const handleClick = () => {
      this.store.selectAnnotation(annotation.id);
    };

    const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const parent = node.getParent();
      if (!parent) return;
      const box = node.getClientRect({ relativeTo: parent });
      let x = node.x();
      let y = node.y();
      if (box.x < 0) x += -box.x;
      if (box.y < 0) y += -box.y;
      if (box.x + box.width > imgW) x -= (box.x + box.width - imgW);
      if (box.y + box.height > imgH) y -= (box.y + box.height - imgH);
      node.x(x);
      node.y(y);
    };

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      if (annotation.type === 'pen' || annotation.type === 'highlight') {
        // Lines need point translation
        const dx = node.x();
        const dy = node.y();
        node.x(0);
        node.y(0);
        const pts = (annotation as PenAnnotation).points;
        const newPoints = [];
        for (let i = 0; i < pts.length; i += 2) {
          newPoints.push(pts[i] + dx, pts[i + 1] + dy);
        }
        this.store.updateAnnotation(image.id, annotation.id, { points: newPoints });
      } else if (annotation.type === 'arrow' || annotation.type === 'line' || annotation.type === 'measure') {
        const dx = node.x();
        const dy = node.y();
        node.x(0);
        node.y(0);
        const [x1, y1, x2, y2] = (annotation as ArrowAnnotation).points;
        this.store.updateAnnotation(image.id, annotation.id, {
          points: [x1 + dx, y1 + dy, x2 + dx, y2 + dy],
        });
      } else {
        this.store.updateAnnotation(image.id, annotation.id, {
          x: node.x(),
          y: node.y(),
        });
      }
    };

    const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      if (annotation.type === 'callout' || annotation.type === 'caption') {
        this.store.updateAnnotation(image.id, annotation.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(20, annotation.width * scaleX),
          height: Math.max(20, annotation.height * scaleY),
        });
      } else if (annotation.type === 'rectangle' || annotation.type === 'blur') {
        this.store.updateAnnotation(image.id, annotation.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(5, node.width() * scaleX),
          height: Math.max(5, node.height() * scaleY),
        });
      } else if (annotation.type === 'ellipse') {
        const ellipse = node as Konva.Ellipse;
        this.store.updateAnnotation(image.id, annotation.id, {
          x: ellipse.x(),
          y: ellipse.y(),
          radiusX: Math.max(5, ellipse.radiusX() * scaleX),
          radiusY: Math.max(5, ellipse.radiusY() * scaleY),
        });
      } else if (annotation.type === 'text') {
        const textNode = node as Konva.Text;
        const baseWidth = typeof annotation.width === 'number'
          ? annotation.width
          : Math.max(20, textNode.width());
        const baseFontSize = Math.max(1, annotation.fontSize || textNode.fontSize());
        this.store.updateAnnotation(image.id, annotation.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(20, baseWidth * scaleX),
          fontSize: Math.max(8, baseFontSize * scaleY),
        });
      }
    };

    const selectedId = this.store.getState().selectedId;
    const isSelected = annotation.id === selectedId;

    switch (annotation.type) {
      case 'pen':
      case 'highlight': {
        const line = new Konva.Line({
          points: annotation.points,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          opacity: annotation.opacity,
          tension: 0.5,
          lineCap: 'round',
          lineJoin: 'round',
          globalCompositeOperation:
            annotation.type === 'highlight' ? 'multiply' : 'source-over',
          hitStrokeWidth: Math.max(annotation.strokeWidth, 15),
          draggable: isSelected,
        });
        line.on('click tap', handleClick);
        line.on('dragmove', handleDragMove);
        line.on('dragend', handleDragEnd);
        return line;
      }

      case 'rectangle': {
        const rect = new Konva.Rect({
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          fill: annotation.fill,
          opacity: annotation.opacity,
          draggable: isSelected,
        });
        rect.on('click tap', handleClick);
        rect.on('dragmove', handleDragMove);
        rect.on('dragend', handleDragEnd);
        rect.on('transformend', handleTransformEnd);
        return rect;
      }

      case 'ellipse': {
        const ellipse = new Konva.Ellipse({
          x: annotation.x,
          y: annotation.y,
          radiusX: annotation.radiusX,
          radiusY: annotation.radiusY,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          fill: annotation.fill,
          opacity: annotation.opacity,
          draggable: isSelected,
        });
        ellipse.on('click tap', handleClick);
        ellipse.on('dragmove', handleDragMove);
        ellipse.on('dragend', handleDragEnd);
        ellipse.on('transformend', handleTransformEnd);
        return ellipse;
      }

      case 'arrow': {
        const arrow = new Konva.Arrow({
          points: annotation.points,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          fill: annotation.color,
          opacity: annotation.opacity,
          pointerLength: annotation.strokeWidth * 6 + 4,
          pointerWidth: annotation.strokeWidth * 5 + 4,
          lineCap: 'round',
          lineJoin: 'round',
          hitStrokeWidth: Math.max(annotation.strokeWidth, 15),
          draggable: isSelected,
        });
        arrow.on('click tap', handleClick);
        arrow.on('dragmove', handleDragMove);
        arrow.on('dragend', handleDragEnd);
        return arrow;
      }

      case 'line': {
        const line = new Konva.Line({
          points: annotation.points,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          opacity: annotation.opacity,
          lineCap: 'round',
          hitStrokeWidth: Math.max(annotation.strokeWidth, 15),
          draggable: isSelected,
        });
        line.on('click tap', handleClick);
        line.on('dragmove', handleDragMove);
        line.on('dragend', handleDragEnd);
        return line;
      }

      case 'measure': {
        const [x1, y1, x2, y2] = annotation.points;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const capLen = 8;

        const group = new Konva.Group({ draggable: isSelected });

        group.add(new Konva.Line({
          points: annotation.points,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          opacity: annotation.opacity,
          lineCap: 'round',
          hitStrokeWidth: Math.max(annotation.strokeWidth, 15),
        }));

        // End caps (perpendicular lines at each endpoint)
        group.add(new Konva.Line({
          points: [
            x1 + Math.sin(angle) * capLen, y1 - Math.cos(angle) * capLen,
            x1 - Math.sin(angle) * capLen, y1 + Math.cos(angle) * capLen,
          ],
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          opacity: annotation.opacity,
        }));
        group.add(new Konva.Line({
          points: [
            x2 + Math.sin(angle) * capLen, y2 - Math.cos(angle) * capLen,
            x2 - Math.sin(angle) * capLen, y2 + Math.cos(angle) * capLen,
          ],
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          opacity: annotation.opacity,
        }));

        group.on('click tap', handleClick);
        group.on('dragmove', handleDragMove);
        group.on('dragend', handleDragEnd);
        return group;
      }

      case 'curve': {
        // points stores 3 pass-through points: start, mid, end
        const [x1, y1, mx, my, x2, y2] = annotation.points;
        const group = new Konva.Group();

        // Calculate true quadratic bezier control point so curve passes through mid point
        // At t=0.5: P = (1-t)²P0 + 2t(1-t)C + t²P2 → C = 2M - 0.5(P0 + P2)
        // Calculate true quadratic bezier control point so curve passes through mid point
        // At t=0.5: P = (1-t)²P0 + 2t(1-t)C + t²P2 → C = 2M - 0.5(P0 + P2)
        const getBezierCP = (sx: number, sy: number, pmx: number, pmy: number, ex: number, ey: number) => ({
          x: 2 * pmx - 0.5 * (sx + ex),
          y: 2 * pmy - 0.5 * (sy + ey),
        });

        const cp = getBezierCP(x1, y1, mx, my, x2, y2);

        // Draw quadratic bezier using custom shape — passes exactly through all 3 points
        const curveShape = new Konva.Shape({
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          opacity: annotation.opacity,
          lineCap: 'round',
          hitStrokeWidth: Math.max(annotation.strokeWidth, 20),
          sceneFunc: (ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(cp.x, cp.y, x2, y2);
            ctx.fillStrokeShape(shape);
          },
        });
        group.add(curveShape);

        // Three draggable handles — always visible
        const handleRadius = 10;
        const makeHandle = (hx: number, hy: number) => {
          return new Konva.Circle({
            x: hx,
            y: hy,
            radius: handleRadius,
            fill: '#cccccc',
            opacity: 0.7,
            stroke: '#333333',
            strokeWidth: 2,
            draggable: true,
          });
        };

        const startHandle = makeHandle(x1, y1);
        const midHandle = makeHandle(cp.x, cp.y);
        const endHandle = makeHandle(x2, y2);

        // Dashed guide lines from endpoints to bezier control point (opposite side of curve)
        const guideLine1 = new Konva.Line({
          points: [x1, y1, cp.x, cp.y],
          stroke: '#000000',
          strokeWidth: 1,
          opacity: 0.5,
          dash: [4, 4],
          listening: false,
        });
        const guideLine2 = new Konva.Line({
          points: [cp.x, cp.y, x2, y2],
          stroke: '#000000',
          strokeWidth: 1,
          opacity: 0.5,
          dash: [4, 4],
          listening: false,
        });
        group.add(guideLine1);
        group.add(guideLine2);

        const updateCurve = () => {
          const sx = startHandle.x(), sy = startHandle.y();
          const cpx = midHandle.x(), cpy = midHandle.y();
          const ex = endHandle.x(), ey = endHandle.y();

          // Mid handle is now at the CP position; use it directly for the curve
          curveShape.sceneFunc((ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(cpx, cpy, ex, ey);
            ctx.fillStrokeShape(shape);
          });
          guideLine1.points([sx, sy, cpx, cpy]);
          guideLine2.points([cpx, cpy, ex, ey]);
          group.getLayer()?.batchDraw();
        };

        // Reverse-calculate mid point (on curve) from CP for storage
        // C = 2M - 0.5(P0+P2) → M = 0.5*C + 0.25*(P0+P2)
        const commitPoints = () => {
          const cpx = midHandle.x(), cpy = midHandle.y();
          const sx = startHandle.x(), sy = startHandle.y();
          const ex = endHandle.x(), ey = endHandle.y();
          const storedMx = 0.5 * cpx + 0.25 * (sx + ex);
          const storedMy = 0.5 * cpy + 0.25 * (sy + ey);
          this.store.updateAnnotation(image.id, annotation.id, {
            points: [sx, sy, storedMx, storedMy, ex, ey],
          });
        };

        [startHandle, midHandle, endHandle].forEach((handle) => {
          handle.on('dragmove', (e) => {
            e.cancelBubble = true;
            updateCurve();
          });
          handle.on('dragend', (e) => {
            e.cancelBubble = true;
            commitPoints();
          });
        });

        group.add(startHandle);
        group.add(midHandle);
        group.add(endHandle);

        group.on('click tap', handleClick);
        return group;
      }

      case 'caption': {
        const barH = Math.min(30, annotation.height * 0.25);
        const padding = 6;
        const availW = annotation.width - padding * 2;

        // Auto-fit font size for caption bar
        let fitFontSize = annotation.fontSize;
        const tempText = new Konva.Text({
          text: annotation.text,
          fontSize: fitFontSize,
          fontFamily: annotation.fontFamily,
          width: availW,
        });
        while (fitFontSize > 8 && tempText.height() > barH - padding) {
          fitFontSize -= 1;
          tempText.fontSize(fitFontSize);
        }
        tempText.destroy();

        const group = new Konva.Group({
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          draggable: isSelected,
        });

        // Hit rect
        group.add(new Konva.Rect({
          width: annotation.width,
          height: annotation.height,
          fill: 'transparent',
          listening: true,
        }));

        // Frame border
        group.add(new Konva.Rect({
          width: annotation.width,
          height: annotation.height,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          opacity: annotation.opacity,
        }));

        // Caption bar background
        group.add(new Konva.Rect({
          width: annotation.width,
          height: barH,
          fill: annotation.color,
          opacity: annotation.opacity,
        }));

        // Caption text (white)
        group.add(new Konva.Text({
          x: padding,
          y: 0,
          width: availW,
          height: barH,
          text: annotation.text,
          fontSize: fitFontSize,
          fontFamily: annotation.fontFamily,
          fill: '#ffffff',
          opacity: annotation.opacity,
          verticalAlign: 'middle',
        }));

        group.on('click tap', handleClick);
        group.on('dblclick dbltap', () => {
          this.store.emit('textEditRequest', annotation);
        });
        group.on('dragmove', handleDragMove);
        group.on('dragend', handleDragEnd);
        group.on('transformend', handleTransformEnd);
        return group;
      }

      case 'callout': {
        const tailH = Math.min(15, annotation.height * 0.3);
        const cornerR = Math.min(12, annotation.width * 0.1, annotation.height * 0.1);
        const padding = 8;
        const availW = annotation.width - padding * 2;
        const availH = annotation.height - padding * 2;

        // Auto-fit font size: start from stored fontSize, shrink until text fits
        let fitFontSize = annotation.fontSize;
        const tempText = new Konva.Text({
          text: annotation.text,
          fontSize: fitFontSize,
          fontFamily: annotation.fontFamily,
          width: availW,
        });
        while (fitFontSize > 8 && tempText.height() > availH) {
          fitFontSize -= 1;
          tempText.fontSize(fitFontSize);
        }
        tempText.destroy();

        const totalH = annotation.height + tailH;
        const group = new Konva.Group({
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: totalH,
          draggable: isSelected,
        });

        // Invisible hit rect covering full area (bubble + tail) for click detection
        group.add(new Konva.Rect({
          width: annotation.width,
          height: totalH,
          fill: 'transparent',
          listening: true,
        }));

        // Bubble background
        group.add(new Konva.Rect({
          width: annotation.width,
          height: annotation.height,
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          cornerRadius: cornerR,
          fill: annotation.color,
          opacity: annotation.opacity,
        }));

        // Tail pointer
        group.add(new Konva.Line({
          points: [
            annotation.width * 0.3, annotation.height,
            annotation.width * 0.2, annotation.height + tailH,
            annotation.width * 0.5, annotation.height,
          ],
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          closed: true,
          fill: annotation.color,
          opacity: annotation.opacity,
        }));

        // Text inside (white, auto-sized)
        group.add(new Konva.Text({
          x: padding,
          y: padding,
          width: availW,
          height: availH,
          text: annotation.text,
          fontSize: fitFontSize,
          fontFamily: annotation.fontFamily,
          fill: '#ffffff',
          opacity: annotation.opacity,
          verticalAlign: 'middle',
        }));

        group.on('click tap', handleClick);
        group.on('dblclick dbltap', () => {
          this.store.emit('textEditRequest', annotation);
        });
        group.on('dragmove', handleDragMove);
        group.on('dragend', handleDragEnd);
        group.on('transformend', handleTransformEnd);
        return group;
      }

      case 'text': {
        const text = new Konva.Text({
          x: annotation.x,
          y: annotation.y,
          text: annotation.text,
          fontSize: annotation.fontSize,
          fontFamily: annotation.fontFamily,
          fill: annotation.color,
          opacity: annotation.opacity,
          width: annotation.width,
          padding: 4,
          draggable: isSelected,
        });
        text.on('click tap', handleClick);
        text.on('dblclick dbltap', () => {
          this.store.emit('textEditRequest', annotation);
        });
        text.on('dragmove', handleDragMove);
        text.on('dragend', handleDragEnd);
        text.on('transformend', handleTransformEnd);
        return text;
      }

      case 'blur': {
        // Create pixelated blur effect
        if (this.imageElement) {
          const group = new Konva.Group({
            x: annotation.x,
            y: annotation.y,
            draggable: isSelected,
          });

          // Create blur canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = Math.max(1, annotation.width);
            canvas.height = Math.max(1, annotation.height);

            ctx.drawImage(
              this.imageElement,
              annotation.x,
              annotation.y,
              annotation.width,
              annotation.height,
              0,
              0,
              annotation.width,
              annotation.height
            );

            // Pixelate
            const pixelSize = 10;
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCanvas.width = Math.ceil(annotation.width / pixelSize);
              tempCanvas.height = Math.ceil(annotation.height / pixelSize);
              tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(tempCanvas, 0, 0, annotation.width, annotation.height);
            }

            const blurImage = new Konva.Image({
              image: canvas,
              width: annotation.width,
              height: annotation.height,
            });
            group.add(blurImage);
          }

          // Selection outline
          const outline = new Konva.Rect({
            width: annotation.width,
            height: annotation.height,
            stroke: isSelected ? '#0066ff' : 'transparent',
            strokeWidth: 2,
            dash: isSelected ? [5, 5] : undefined,
          });
          group.add(outline);

          group.on('click tap', handleClick);
          group.on('dragmove', handleDragMove);
          group.on('dragend', (e) => {
            this.store.updateAnnotation(image.id, annotation.id, {
              x: e.target.x(),
              y: e.target.y(),
            });
          });

          return group;
        }
        return null;
      }
    }

    return null;
  }

  getStage(): Konva.Stage {
    return this.stage;
  }

  private applyCrop(bounds: CropBounds): void {
    if (!this.imageElement) return;
    const image = this.store.getCurrentImage();
    if (!image) return;

    const x = Math.max(0, Math.min(bounds.x, this.imageElement.width - 1));
    const y = Math.max(0, Math.min(bounds.y, this.imageElement.height - 1));
    const width = Math.max(1, Math.min(bounds.width, this.imageElement.width - x));
    const height = Math.max(1, Math.min(bounds.height, this.imageElement.height - y));
    if (width < 2 || height < 2) return;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(width);
    cropCanvas.height = Math.round(height);
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      this.imageElement,
      x,
      y,
      width,
      height,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );

    let croppedUrl = '';
    try {
      croppedUrl = cropCanvas.toDataURL('image/png');
    } catch (e) {
      console.error('Crop failed while exporting cropped image', e);
      return;
    }

    image.url = croppedUrl;
    image.originalWidth = cropCanvas.width;
    image.originalHeight = cropCanvas.height;

    const state = this.store.getState();
    const croppedAnnotations = this.store
      .getAnnotations(image.id)
      .map((annotation) => this.cropAnnotation(annotation, { x, y, width, height }))
      .filter((annotation): annotation is Annotation => !!annotation);

    // Overlays no longer align to the cropped image.
    this.removeAllOverlays();
    state.overlayImages = [];
    state.activeOverlayId = null;

    this.store.replaceAnnotations(image.id, croppedAnnotations, 'crop', 'Cropped image');
    this.store.selectAnnotation(null);
    this.store.setTool('select');
    this.store.emit('imageChange', image, state.currentImageIndex);
  }

  private cropAnnotation(annotation: Annotation, crop: CropBounds): Annotation | null {
    const x1 = crop.x;
    const y1 = crop.y;
    const x2 = crop.x + crop.width;
    const y2 = crop.y + crop.height;
    const inside = (x: number, y: number): boolean => x >= x1 && x <= x2 && y >= y1 && y <= y2;
    const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
    const shiftX = (v: number): number => v - crop.x;
    const shiftY = (v: number): number => v - crop.y;

    if (annotation.type === 'rectangle' || annotation.type === 'blur') {
      const ax1 = annotation.x;
      const ay1 = annotation.y;
      const ax2 = annotation.x + annotation.width;
      const ay2 = annotation.y + annotation.height;
      const ix1 = Math.max(ax1, x1);
      const iy1 = Math.max(ay1, y1);
      const ix2 = Math.min(ax2, x2);
      const iy2 = Math.min(ay2, y2);
      if (ix2 <= ix1 || iy2 <= iy1) return null;
      return { ...annotation, x: shiftX(ix1), y: shiftY(iy1), width: ix2 - ix1, height: iy2 - iy1 };
    }

    if (annotation.type === 'ellipse') {
      const minX = annotation.x - annotation.radiusX;
      const maxX = annotation.x + annotation.radiusX;
      const minY = annotation.y - annotation.radiusY;
      const maxY = annotation.y + annotation.radiusY;
      if (maxX < x1 || minX > x2 || maxY < y1 || minY > y2) return null;
      return { ...annotation, x: shiftX(annotation.x), y: shiftY(annotation.y) };
    }

    if (annotation.type === 'text') {
      if (!inside(annotation.x, annotation.y)) return null;
      return { ...annotation, x: shiftX(annotation.x), y: shiftY(annotation.y) };
    }

    if (annotation.type === 'arrow' || annotation.type === 'line') {
      const [ax, ay, bx, by] = annotation.points;
      const intersects = !(
        Math.max(ax, bx) < x1 ||
        Math.min(ax, bx) > x2 ||
        Math.max(ay, by) < y1 ||
        Math.min(ay, by) > y2
      );
      if (!intersects) return null;
      const cax = clamp(ax, x1, x2);
      const cay = clamp(ay, y1, y2);
      const cbx = clamp(bx, x1, x2);
      const cby = clamp(by, y1, y2);
      return { ...annotation, points: [shiftX(cax), shiftY(cay), shiftX(cbx), shiftY(cby)] };
    }

    if (annotation.type === 'pen' || annotation.type === 'highlight') {
      const out: number[] = [];
      let hasInside = false;
      for (let i = 0; i < annotation.points.length; i += 2) {
        const px = annotation.points[i];
        const py = annotation.points[i + 1];
        hasInside = hasInside || inside(px, py);
        out.push(shiftX(clamp(px, x1, x2)), shiftY(clamp(py, y1, y2)));
      }
      if (!hasInside || out.length < 4) return null;
      return { ...annotation, points: out };
    }

    return annotation;
  }

  getImageElement(): HTMLImageElement | null {
    return this.imageElement;
  }

  getImageDimensions(): { width: number; height: number } | null {
    if (!this.imageElement) return null;
    return { width: this.imageElement.width, height: this.imageElement.height };
  }

  destroy(): void {
    this.stage.destroy();
  }
}
