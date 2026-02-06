import Konva from 'konva';
import type { Store } from './Store';
import type {
  Annotation,
  ToolType,
  PenAnnotation,
  RectAnnotation,
  EllipseAnnotation,
  ArrowAnnotation,
  LineAnnotation,
  TextAnnotation,
  HighlightAnnotation,
  BlurAnnotation,
} from '../types';
import { uid } from '../utils/uid';

export class Canvas {
  private container: HTMLElement;
  private store: Store;
  private stage: Konva.Stage;
  private imageLayer: Konva.Layer;
  private annotationLayer: Konva.Layer;
  private previewLayer: Konva.Layer;
  private transformer: Konva.Transformer;
  private imageNode: Konva.Image | null = null;
  private imageElement: HTMLImageElement | null = null;

  // Drawing state
  private isDrawing = false;
  private startPoint: { x: number; y: number } | null = null;
  private currentPoints: number[] = [];
  private previewShape: Konva.Shape | null = null;

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
    this.annotationLayer = new Konva.Layer();
    this.previewLayer = new Konva.Layer();

    this.stage.add(this.imageLayer);
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
    this.store.on('historyChange', () => this.renderAnnotations());
    this.store.on('zoomChange', () => this.updateTransform());
    this.store.on('positionChange', () => this.updateTransform());
    this.store.on('viewReset', () => this.updateTransform());
  }

  private getPointerPosition(): { x: number; y: number } | null {
    const state = this.store.getState();
    const pointer = this.stage.getPointerPosition();
    if (!pointer) return null;

    let x = (pointer.x - state.position.x) / state.scale;
    let y = (pointer.y - state.position.y) / state.scale;

    // Clamp to image bounds
    if (this.imageElement) {
      x = Math.max(0, Math.min(x, this.imageElement.width));
      y = Math.max(0, Math.min(y, this.imageElement.height));
    }

    return { x, y };
  }

  private handleMouseDown(_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
    const state = this.store.getState();
    const tool = state.currentTool as ToolType;

    if (tool === 'select') {
      // Enable stage dragging
      this.stage.draggable(true);
      return;
    }

    if (tool === 'crop') return;

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
    if (this.previewShape) {
      this.previewShape.destroy();
      this.previewShape = null;
    }

    if (tool === 'pen' || tool === 'highlight') {
      this.currentPoints.push(point.x, point.y);
      this.previewShape = new Konva.Line({
        points: this.currentPoints,
        stroke: tool === 'highlight' ? state.highlightColor : state.color,
        strokeWidth: tool === 'highlight' ? state.strokeWidth * 4 : state.strokeWidth,
        opacity: tool === 'highlight' ? 0.4 : 1,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        globalCompositeOperation: tool === 'highlight' ? 'multiply' : 'source-over',
      });
    } else if (tool === 'rectangle' || tool === 'blur') {
      const width = point.x - this.startPoint.x;
      const height = point.y - this.startPoint.y;
      this.previewShape = new Konva.Rect({
        x: Math.min(this.startPoint.x, point.x),
        y: Math.min(this.startPoint.y, point.y),
        width: Math.abs(width),
        height: Math.abs(height),
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
        pointerLength: state.strokeWidth * 4,
        pointerWidth: state.strokeWidth * 3,
        dash: [5, 5],
      });
    } else if (tool === 'line') {
      this.previewShape = new Konva.Line({
        points: [this.startPoint.x, this.startPoint.y, point.x, point.y],
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        dash: [5, 5],
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
    if (this.previewShape) {
      this.previewShape.destroy();
      this.previewShape = null;
    }
    this.previewLayer.batchDraw();

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
            color: state.highlightColor,
            opacity: 0.4,
            points: this.currentPoints,
            strokeWidth: state.strokeWidth * 4,
          } as HighlightAnnotation;
        }
        break;

      case 'rectangle': {
        const width = point.x - this.startPoint.x;
        const height = point.y - this.startPoint.y;
        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
          annotation = {
            id: uid(),
            type: 'rectangle',
            imageId: image.id,
            createdAt: Date.now(),
            color: state.color,
            opacity: 1,
            x: Math.min(this.startPoint.x, point.x),
            y: Math.min(this.startPoint.y, point.y),
            width: Math.abs(width),
            height: Math.abs(height),
            strokeWidth: state.strokeWidth,
          } as RectAnnotation;
        }
        break;
      }

      case 'ellipse': {
        const width = point.x - this.startPoint.x;
        const height = point.y - this.startPoint.y;
        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
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
        if (distance > 10) {
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
        if (distance > 10) {
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

      case 'text':
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
          fontSize: state.fontSize,
          fontFamily: 'Arial',
        } as TextAnnotation;
        break;

      case 'blur': {
        const width = point.x - this.startPoint.x;
        const height = point.y - this.startPoint.y;
        if (Math.abs(width) > 10 && Math.abs(height) > 10) {
          annotation = {
            id: uid(),
            type: 'blur',
            imageId: image.id,
            createdAt: Date.now(),
            color: '#000000',
            opacity: 1,
            x: Math.min(this.startPoint.x, point.x),
            y: Math.min(this.startPoint.y, point.y),
            width: Math.abs(width),
            height: Math.abs(height),
            mode: 'blur',
          } as BlurAnnotation;
        }
        break;
      }
    }

    if (annotation) {
      this.store.addAnnotation(image.id, annotation);
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
          x: 0,
          y: 0,
        });

        this.imageLayer.add(this.imageNode);
        this.imageLayer.moveToBottom();
        this.imageLayer.batchDraw();

        // Fit to screen
        this.fitToScreen();
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
      });
    }
  }

  private updateImageRotation(): void {
    const image = this.store.getCurrentImage();
    if (this.imageNode && image) {
      this.imageNode.rotation(image.rotation);
      this.imageLayer.batchDraw();
    }
  }

  fitToScreen(): void {
    if (!this.imageElement) return;

    const padding = 40;
    const stageWidth = this.stage.width();
    const stageHeight = this.stage.height();
    const imageWidth = this.imageElement.width;
    const imageHeight = this.imageElement.height;

    const scaleX = (stageWidth - padding * 2) / imageWidth;
    const scaleY = (stageHeight - padding * 2) / imageHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const x = (stageWidth - imageWidth * scale) / 2;
    const y = (stageHeight - imageHeight * scale) / 2;

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
      } else if (annotation.type === 'arrow' || annotation.type === 'line') {
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

      if (annotation.type === 'rectangle' || annotation.type === 'blur') {
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
        this.store.updateAnnotation(image.id, annotation.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(20, node.width() * scaleX),
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
          pointerLength: annotation.strokeWidth * 4,
          pointerWidth: annotation.strokeWidth * 3,
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
