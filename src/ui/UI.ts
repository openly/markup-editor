import type { Store } from '../core/Store';
import type { ToolType, CustomTool } from '../types';
import { createIcon, icons } from './icons';

const TOOLS: { id: ToolType; name: string; shortcut: string; icon: keyof typeof icons }[] = [
  { id: 'select', name: 'Select', shortcut: 'V', icon: 'cursor' },
  { id: 'pen', name: 'Pen', shortcut: 'P', icon: 'pen' },
  { id: 'rectangle', name: 'Rectangle', shortcut: 'R', icon: 'square' },
  { id: 'ellipse', name: 'Ellipse', shortcut: 'O', icon: 'circle' },
  { id: 'arrow', name: 'Arrow', shortcut: 'A', icon: 'arrow' },
  { id: 'line', name: 'Line', shortcut: 'L', icon: 'line' },
  { id: 'text', name: 'Text', shortcut: 'T', icon: 'text' },
  { id: 'highlight', name: 'Highlight', shortcut: 'H', icon: 'highlight' },
  { id: 'crop', name: 'Crop', shortcut: 'C', icon: 'crop' },
  { id: 'blur', name: 'Blur', shortcut: 'B', icon: 'blur' },
];

const DEFAULT_COLORS = [
  '#ff0000', '#ff8c00', '#ffff00', '#00ff00', '#00ffff',
  '#0000ff', '#8b00ff', '#ff1493', '#ffffff', '#000000',
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

interface UIOptions {
  showToolbar?: boolean;
  showHistoryPanel?: boolean;
  showNotesPanel?: boolean;
  showTopBar?: boolean;
  tools?: ToolType[];
  onImageUpload?: (files: FileList) => void;
  onUrlInput?: (url: string) => void;
  onOverlayUpload?: (file: File, name?: string) => void;
  onOverlayRemove?: (id: string) => void;
  onOverlayOpacityChange?: (opacity: number) => void;
  onOverlaySetActive?: (id: string) => void;
  onGridToggle?: () => void;
  onCompareToggle?: () => void;
  defaultOverlayOpacity?: number;
}

export class UI {
  private container: HTMLElement;
  private store: Store;
  private options: UIOptions;
  private customTools: Map<string, CustomTool> = new Map();

  // Element references
  private root!: HTMLElement;
  private topBar!: HTMLElement;
  private previewPanel!: HTMLElement;
  private toolbar!: HTMLElement;
  private canvasContainer!: HTMLElement;
  private historyPanel!: HTMLElement;
  private notesPanel!: HTMLElement;
  private toolButtons: Map<string, HTMLButtonElement> = new Map();
  private colorDropdown: HTMLElement | null = null;
  private strokeDropdown: HTMLElement | null = null;
  private overlayDropdown: HTMLElement | null = null;
  private overlaySection: HTMLElement | null = null;

  constructor(container: HTMLElement, store: Store, options: UIOptions = {}) {
    this.container = container;
    this.store = store;
    this.options = {
      showToolbar: true,
      showHistoryPanel: true,
      showNotesPanel: true,
      showTopBar: true,
      ...options,
    };

    this.createLayout();
    this.setupStoreListeners();
  }

  private createLayout(): void {
    this.root = document.createElement('div');
    this.root.className = 'markup-editor';

    // Top bar
    if (this.options.showTopBar) {
      this.topBar = this.createTopBar();
      this.root.appendChild(this.topBar);
    }

    // Image preview panel
    this.previewPanel = this.createPreviewPanel();
    this.root.appendChild(this.previewPanel);

    // Main content area
    const main = document.createElement('div');
    main.className = 'me-main';

    // Toolbar
    if (this.options.showToolbar) {
      this.toolbar = this.createToolbar();
      main.appendChild(this.toolbar);
    }

    // Canvas container
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'me-canvas-container';
    main.appendChild(this.canvasContainer);

    // History panel
    if (this.options.showHistoryPanel) {
      this.historyPanel = this.createHistoryPanel();
      main.appendChild(this.historyPanel);
    }

    this.root.appendChild(main);

    // Notes panel
    if (this.options.showNotesPanel) {
      this.notesPanel = this.createNotesPanel();
      this.root.appendChild(this.notesPanel);
    }

    this.container.appendChild(this.root);
  }

  private createTopBar(): HTMLElement {
    const topBar = document.createElement('div');
    topBar.className = 'me-topbar';

    // Left section: Navigation
    const leftSection = document.createElement('div');
    leftSection.className = 'me-topbar-section';

    const prevBtn = this.createButton('chevronLeft', 'Previous image');
    prevBtn.onclick = () => this.store.previousImage();

    const navText = document.createElement('span');
    navText.className = 'me-nav-text';
    navText.textContent = '0 / 0';

    const nextBtn = this.createButton('chevronRight', 'Next image');
    nextBtn.onclick = () => this.store.nextImage();

    const imageName = document.createElement('span');
    imageName.className = 'me-image-name';
    imageName.id = 'me-image-name';

    leftSection.appendChild(prevBtn);
    leftSection.appendChild(navText);
    leftSection.appendChild(nextBtn);
    leftSection.appendChild(imageName);

    // Center section: Rotation and zoom
    const centerSection = document.createElement('div');
    centerSection.className = 'me-topbar-center';

    const rotateCcwBtn = this.createButton('rotateCcw', 'Rotate left');
    rotateCcwBtn.onclick = () => this.store.rotateImage(-90);

    const rotateCwBtn = this.createButton('rotateCw', 'Rotate right');
    rotateCwBtn.onclick = () => this.store.rotateImage(90);

    const divider1 = document.createElement('div');
    divider1.style.cssText = 'width:1px;height:24px;background:var(--me-border);margin:0 8px';

    const zoomOutBtn = this.createButton('zoomOut', 'Zoom out');
    zoomOutBtn.onclick = () => {
      const state = this.store.getState();
      this.store.setScale(state.scale / 1.2);
    };

    const zoomText = document.createElement('span');
    zoomText.className = 'me-zoom-text';
    zoomText.id = 'me-zoom-text';
    zoomText.textContent = '100%';

    const zoomInBtn = this.createButton('zoomIn', 'Zoom in');
    zoomInBtn.onclick = () => {
      const state = this.store.getState();
      this.store.setScale(state.scale * 1.2);
    };

    const fitBtn = this.createButton('maximize', 'Fit to screen');
    fitBtn.onclick = () => this.store.emit('fitToScreen');

    const resetBtn = document.createElement('button');
    resetBtn.className = 'me-btn';
    resetBtn.textContent = '100%';
    resetBtn.style.fontSize = '12px';
    resetBtn.style.padding = '4px 8px';
    resetBtn.onclick = () => this.store.resetView();

    const divider2 = document.createElement('div');
    divider2.style.cssText = 'width:1px;height:24px;background:var(--me-border);margin:0 8px';

    const gridBtn = this.createButton('grid', 'Toggle grid (G)');
    gridBtn.id = 'me-grid-btn';
    gridBtn.onclick = () => this.options.onGridToggle?.();

    const compareBtn = this.createButton('compare', 'Compare mode');
    compareBtn.id = 'me-compare-btn';
    compareBtn.onclick = () => this.options.onCompareToggle?.();

    centerSection.appendChild(rotateCcwBtn);
    centerSection.appendChild(rotateCwBtn);
    centerSection.appendChild(divider1);
    centerSection.appendChild(zoomOutBtn);
    centerSection.appendChild(zoomText);
    centerSection.appendChild(zoomInBtn);
    centerSection.appendChild(fitBtn);
    centerSection.appendChild(resetBtn);
    centerSection.appendChild(divider2);
    centerSection.appendChild(gridBtn);
    centerSection.appendChild(compareBtn);

    // Right section: Overlay
    const rightSection = document.createElement('div');
    rightSection.className = 'me-topbar-section';

    this.overlaySection = this.createOverlaySection();
    rightSection.appendChild(this.overlaySection);

    topBar.appendChild(leftSection);
    topBar.appendChild(centerSection);
    topBar.appendChild(rightSection);

    return topBar;
  }

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'me-toolbar';

    const enabledTools = this.options.tools || TOOLS.map((t) => t.id);

    TOOLS.forEach((tool) => {
      if (!enabledTools.includes(tool.id)) return;

      const btn = document.createElement('button');
      btn.className = 'me-btn me-btn-tool';
      btn.innerHTML = createIcon(tool.icon).outerHTML;

      const tooltip = document.createElement('span');
      tooltip.className = 'me-tooltip';
      tooltip.textContent = `${tool.name} (${tool.shortcut})`;
      btn.appendChild(tooltip);

      btn.onclick = () => this.store.setTool(tool.id);
      this.toolButtons.set(tool.id, btn);
      toolbar.appendChild(btn);
    });

    // Divider
    const divider = document.createElement('div');
    divider.className = 'me-toolbar-divider';
    toolbar.appendChild(divider);

    // Color picker
    const colorPicker = this.createColorPicker();
    toolbar.appendChild(colorPicker);

    // Stroke width picker
    const strokePicker = this.createStrokePicker();
    toolbar.appendChild(strokePicker);

    // Update active tool
    this.updateActiveTool();

    return toolbar;
  }

  private createColorPicker(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'me-color-picker';

    const swatch = document.createElement('button');
    swatch.className = 'me-btn';
    swatch.innerHTML = `<div class="me-color-swatch" style="background:${this.store.getState().color}"></div>`;

    swatch.onclick = () => {
      if (this.colorDropdown) {
        this.colorDropdown.remove();
        this.colorDropdown = null;
        return;
      }

      this.closeDropdowns();

      const dropdown = document.createElement('div');
      dropdown.className = 'me-color-dropdown';

      const grid = document.createElement('div');
      grid.className = 'me-color-grid';

      DEFAULT_COLORS.forEach((color) => {
        const btn = document.createElement('button');
        btn.className = 'me-color-option';
        if (color === this.store.getState().color) {
          btn.classList.add('active');
        }
        btn.style.background = color;
        btn.onclick = () => {
          this.store.setColor(color);
          (swatch.querySelector('.me-color-swatch') as HTMLElement).style.background = color;
          dropdown.remove();
          this.colorDropdown = null;
        };
        grid.appendChild(btn);
      });

      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'me-color-input';
      input.value = this.store.getState().color;
      input.onchange = () => {
        this.store.setColor(input.value);
        (swatch.querySelector('.me-color-swatch') as HTMLElement).style.background = input.value;
      };

      dropdown.appendChild(grid);
      dropdown.appendChild(input);
      wrapper.appendChild(dropdown);
      this.colorDropdown = dropdown;
    };

    wrapper.appendChild(swatch);
    return wrapper;
  }

  private createStrokePicker(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';

    const btn = document.createElement('button');
    btn.className = 'me-btn';
    btn.innerHTML = `<div style="width:20px;height:${Math.min(this.store.getState().strokeWidth, 8)}px;background:var(--me-text);border-radius:2px"></div>`;

    btn.onclick = () => {
      if (this.strokeDropdown) {
        this.strokeDropdown.remove();
        this.strokeDropdown = null;
        return;
      }

      this.closeDropdowns();

      const dropdown = document.createElement('div');
      dropdown.className = 'me-stroke-dropdown';

      STROKE_WIDTHS.forEach((width) => {
        const option = document.createElement('div');
        option.className = 'me-stroke-option';
        if (width === this.store.getState().strokeWidth) {
          option.classList.add('active');
        }

        const preview = document.createElement('div');
        preview.className = 'me-stroke-preview';
        preview.style.height = `${width}px`;

        const label = document.createElement('span');
        label.className = 'me-stroke-label';
        label.textContent = `${width}px`;

        option.appendChild(preview);
        option.appendChild(label);

        option.onclick = () => {
          this.store.setStrokeWidth(width);
          (btn.querySelector('div') as HTMLElement).style.height = `${Math.min(width, 8)}px`;
          dropdown.remove();
          this.strokeDropdown = null;
        };

        dropdown.appendChild(option);
      });

      wrapper.appendChild(dropdown);
      this.strokeDropdown = dropdown;
    };

    wrapper.appendChild(btn);
    return wrapper;
  }

  private createHistoryPanel(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'me-history-wrapper';

    const panel = document.createElement('div');
    panel.className = 'me-panel me-history-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'me-panel-header';

    const title = document.createElement('span');
    title.textContent = 'History';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '4px';

    const undoBtn = this.createButton('undo', 'Undo (Cmd+Z)');
    undoBtn.id = 'me-undo-btn';
    undoBtn.onclick = () => {
      const image = this.store.getCurrentImage();
      if (image) this.store.undo(image.id);
    };

    const redoBtn = this.createButton('redo', 'Redo (Cmd+Shift+Z)');
    redoBtn.id = 'me-redo-btn';
    redoBtn.onclick = () => {
      const image = this.store.getCurrentImage();
      if (image) this.store.redo(image.id);
    };

    actions.appendChild(undoBtn);
    actions.appendChild(redoBtn);
    header.appendChild(title);
    header.appendChild(actions);

    // Content
    const content = document.createElement('div');
    content.className = 'me-panel-content';
    content.id = 'me-history-content';

    panel.appendChild(header);
    panel.appendChild(content);

    // Toggle strip (always visible)
    const toggleStrip = document.createElement('div');
    toggleStrip.className = 'me-history-toggle';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'me-btn me-btn-icon me-collapse-btn';
    toggleBtn.title = 'Toggle history panel';
    toggleBtn.appendChild(createIcon('panelRight'));
    toggleBtn.onclick = () => {
      wrapper.classList.toggle('collapsed');
    };

    toggleStrip.appendChild(toggleBtn);

    wrapper.appendChild(panel);
    wrapper.appendChild(toggleStrip);

    return wrapper;
  }

  private createNotesPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'me-notes-panel';

    const label = document.createElement('label');
    label.className = 'me-notes-label';
    label.textContent = 'Notes';

    const textarea = document.createElement('textarea');
    textarea.className = 'me-notes-input';
    textarea.placeholder = 'Add notes about this image...';
    textarea.id = 'me-notes-input';
    textarea.oninput = () => {
      this.store.setImageNote(textarea.value);
    };

    panel.appendChild(label);
    panel.appendChild(textarea);

    return panel;
  }

  private createPreviewPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'me-preview-panel';
    panel.id = 'me-preview-panel';
    panel.style.display = 'none';

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'me-preview-scroll';
    panel.appendChild(scrollContainer);

    return panel;
  }

  private createOverlaySection(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'me-overlay-section';

    const overlayBtn = this.createButton('overlay', 'Overlay image');
    overlayBtn.onclick = () => {
      if (this.overlayDropdown) {
        this.overlayDropdown.remove();
        this.overlayDropdown = null;
        return;
      }
      this.closeDropdowns();
      this.showOverlayDropdown(wrapper);
    };

    wrapper.appendChild(overlayBtn);
    return wrapper;
  }

  private showOverlayDropdown(parent: HTMLElement): void {
    const dropdown = document.createElement('div');
    dropdown.className = 'me-overlay-dropdown';

    const overlays = this.store.getState().overlayImages;
    const activeId = this.store.getState().activeOverlayId;

    if (overlays.length > 0) {
      const title = document.createElement('div');
      title.className = 'me-overlay-label';
      title.textContent = 'Overlay Images';
      dropdown.appendChild(title);

      // Overlay list
      const list = document.createElement('div');
      list.className = 'me-overlay-list';

      overlays.forEach((overlay) => {
        const item = document.createElement('div');
        item.className = 'me-overlay-item';
        if (overlay.id === activeId) item.classList.add('active');

        const radio = document.createElement('div');
        radio.className = 'me-overlay-radio';
        if (overlay.id === activeId) radio.classList.add('selected');

        const name = document.createElement('span');
        name.className = 'me-overlay-item-name';
        name.textContent = overlay.name;
        name.title = overlay.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'me-overlay-delete';
        deleteBtn.innerHTML = createIcon('x').outerHTML;
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          this.options.onOverlayRemove?.(overlay.id);
          dropdown.remove();
          this.overlayDropdown = null;
          this.showOverlayDropdown(parent);
        };

        item.appendChild(radio);
        item.appendChild(name);
        item.appendChild(deleteBtn);

        item.onclick = () => {
          this.options.onOverlaySetActive?.(overlay.id);
          dropdown.remove();
          this.overlayDropdown = null;
          this.showOverlayDropdown(parent);
        };

        list.appendChild(item);
      });
      dropdown.appendChild(list);

      // Opacity slider for active overlay
      const activeOverlay = overlays.find(o => o.id === activeId);
      if (activeOverlay) {
        const opacityLabel = document.createElement('div');
        opacityLabel.className = 'me-overlay-label';
        opacityLabel.textContent = 'Opacity';
        dropdown.appendChild(opacityLabel);

        const sliderRow = document.createElement('div');
        sliderRow.className = 'me-overlay-slider-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'me-overlay-slider';
        slider.min = '0';
        slider.max = '100';
        slider.value = String(Math.round(activeOverlay.opacity * 100));

        const valueLabel = document.createElement('span');
        valueLabel.className = 'me-overlay-value';
        valueLabel.textContent = `${Math.round(activeOverlay.opacity * 100)}%`;

        slider.oninput = () => {
          const opacity = parseInt(slider.value, 10) / 100;
          valueLabel.textContent = `${slider.value}%`;
          this.options.onOverlayOpacityChange?.(opacity);
        };

        sliderRow.appendChild(slider);
        sliderRow.appendChild(valueLabel);
        dropdown.appendChild(sliderRow);
      }

      // Divider
      const divider = document.createElement('div');
      divider.style.cssText = 'height:1px;background:var(--me-border);margin:8px 0';
      dropdown.appendChild(divider);
    }

    // Add new overlay section
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'me-overlay-name-input';
    nameInput.placeholder = 'Overlay name (e.g. Margin Guide)';
    dropdown.appendChild(nameInput);

    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'me-btn me-btn-primary me-overlay-upload-btn';
    uploadLabel.innerHTML = `${createIcon('upload').outerHTML}<span>Add Overlay</span>`;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files[0]) {
        const name = nameInput.value.trim() || undefined;
        this.options.onOverlayUpload?.(fileInput.files[0], name);
        dropdown.remove();
        this.overlayDropdown = null;
      }
    };

    uploadLabel.appendChild(fileInput);
    dropdown.appendChild(uploadLabel);

    parent.appendChild(dropdown);
    this.overlayDropdown = dropdown;

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!parent.contains(e.target as Node)) {
        dropdown.remove();
        this.overlayDropdown = null;
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  private updateOverlayButton(): void {
    if (!this.overlaySection) return;
    const btn = this.overlaySection.querySelector('.me-btn-icon') as HTMLButtonElement;
    if (!btn) return;
    const hasOverlays = this.store.getState().overlayImages.length > 0;
    btn.classList.toggle('active', hasOverlays);
  }

  private updatePreviewPanel(): void {
    const panel = this.previewPanel;
    if (!panel) return;

    const state = this.store.getState();
    const images = state.images;

    if (images.length <= 1) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'flex';
    const scrollContainer = panel.querySelector('.me-preview-scroll');
    if (!scrollContainer) return;

    scrollContainer.innerHTML = '';

    images.forEach((img, index) => {
      const item = document.createElement('div');
      item.className = 'me-preview-item';
      if (index === state.currentImageIndex) {
        item.classList.add('active');
      }

      const thumb = document.createElement('img');
      thumb.className = 'me-preview-thumb';
      thumb.src = img.url;
      thumb.alt = img.name;
      thumb.draggable = false;

      const label = document.createElement('span');
      label.className = 'me-preview-label';
      label.textContent = img.name;
      label.title = img.name;

      item.appendChild(thumb);
      item.appendChild(label);

      item.onclick = () => {
        this.store.goToImage(index);
      };

      scrollContainer.appendChild(item);
    });

    // Scroll active item into view
    const activeItem = scrollContainer.querySelector('.me-preview-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  private createButton(icon: keyof typeof icons, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'me-btn me-btn-icon';
    btn.title = title;
    btn.appendChild(createIcon(icon));
    return btn;
  }

  private closeDropdowns(): void {
    if (this.colorDropdown) {
      this.colorDropdown.remove();
      this.colorDropdown = null;
    }
    if (this.strokeDropdown) {
      this.strokeDropdown.remove();
      this.strokeDropdown = null;
    }
    if (this.overlayDropdown) {
      this.overlayDropdown.remove();
      this.overlayDropdown = null;
    }
  }

  private setupStoreListeners(): void {
    this.store.on('toolChange', () => this.updateActiveTool());
    this.store.on('imagesChange', () => { this.updateNavigation(); this.updatePreviewPanel(); });
    this.store.on('imageChange', () => { this.updateNavigation(); this.updatePreviewPanel(); });
    this.store.on('imageAdd', () => { this.updateNavigation(); this.updatePreviewPanel(); });
    this.store.on('zoomChange', (scale: number) => this.updateZoomText(scale));
    this.store.on('historyChange', () => this.updateHistoryPanel());
    this.store.on('noteChange', () => this.updateNotesInput());
    this.store.on('overlayChange', () => this.updateOverlayButton());
    this.store.on('gridToggle', (visible: boolean) => {
      const btn = document.getElementById('me-grid-btn');
      if (btn) btn.classList.toggle('active', visible);
    });
    this.store.on('compareModeChange', (enabled: boolean) => {
      const btn = document.getElementById('me-compare-btn');
      if (btn) btn.classList.toggle('active', enabled);
      if (this.toolbar) {
        this.toolbar.classList.toggle('compare-disabled', enabled);
      }
    });
  }

  private updateActiveTool(): void {
    const state = this.store.getState();
    this.toolButtons.forEach((btn, id) => {
      btn.classList.toggle('active', id === state.currentTool);
    });
  }

  private updateNavigation(): void {
    const state = this.store.getState();
    const navText = this.topBar?.querySelector('.me-nav-text');
    if (navText) {
      navText.textContent = state.images.length > 0
        ? `${state.currentImageIndex + 1} / ${state.images.length}`
        : '0 / 0';
    }

    const imageName = document.getElementById('me-image-name');
    const currentImage = this.store.getCurrentImage();
    if (imageName) {
      imageName.textContent = currentImage?.name || '';
    }
  }

  private updateZoomText(scale: number): void {
    const zoomText = document.getElementById('me-zoom-text');
    if (zoomText) {
      zoomText.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  private updateHistoryPanel(): void {
    const content = document.getElementById('me-history-content');
    if (!content) return;

    content.innerHTML = '';

    const image = this.store.getCurrentImage();
    if (!image) return;

    const history = this.store.getHistory(image.id);
    const currentIndex = this.store.getHistoryIndex(image.id);

    // Original state
    const originalItem = this.createHistoryItem('Original', null, currentIndex === -1);
    originalItem.onclick = () => this.store.jumpToHistory(image.id, -1);
    content.appendChild(originalItem);

    // History entries
    history.forEach((entry, index) => {
      const item = this.createHistoryItem(
        entry.description,
        entry.timestamp,
        index === currentIndex,
        index > currentIndex
      );
      item.onclick = () => this.store.jumpToHistory(image.id, index);
      content.appendChild(item);
    });

    // Update undo/redo buttons
    const undoBtn = document.getElementById('me-undo-btn') as HTMLButtonElement;
    const redoBtn = document.getElementById('me-redo-btn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = !this.store.canUndo(image.id);
    if (redoBtn) redoBtn.disabled = !this.store.canRedo(image.id);
  }

  private createHistoryItem(
    label: string,
    timestamp: number | null,
    isActive: boolean,
    isFuture = false
  ): HTMLElement {
    const item = document.createElement('div');
    item.className = 'me-history-item';
    if (isActive) item.classList.add('active');
    if (isFuture) item.classList.add('future');

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    item.appendChild(labelSpan);

    if (timestamp) {
      const time = document.createElement('span');
      time.className = 'me-history-time';
      time.textContent = new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      item.appendChild(time);
    }

    return item;
  }

  private updateNotesInput(): void {
    const textarea = document.getElementById('me-notes-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const image = this.store.getCurrentImage();
    textarea.value = image?.note || '';
    textarea.disabled = !image;
  }

  showEmptyState(): void {
    this.canvasContainer.innerHTML = `
      <div class="me-empty-state">
        ${createIcon('image', 'me-icon me-empty-icon').outerHTML}
        <h3 class="me-empty-title">No images loaded</h3>
        <p class="me-empty-text">Drag and drop images here or click to upload</p>
        <label class="me-btn me-btn-primary">
          ${createIcon('upload').outerHTML}
          <span>Upload Images</span>
          <input type="file" multiple accept="image/*" class="me-upload-input" />
        </label>
        <input
          type="text"
          class="me-url-input"
          placeholder="Or paste image URL and press Enter"
        />
      </div>
    `;

    const fileInput = this.canvasContainer.querySelector('.me-upload-input') as HTMLInputElement;
    fileInput.onchange = () => {
      if (fileInput.files) {
        this.options.onImageUpload?.(fileInput.files);
      }
    };

    const urlInput = this.canvasContainer.querySelector('.me-url-input') as HTMLInputElement;
    urlInput.onkeydown = (e) => {
      if (e.key === 'Enter' && urlInput.value.trim()) {
        this.options.onUrlInput?.(urlInput.value.trim());
        urlInput.value = '';
      }
    };
  }

  showLoading(): void {
    this.canvasContainer.innerHTML = `
      <div class="me-loading">
        <div class="me-spinner"></div>
        <p class="me-loading-text">Loading image...</p>
      </div>
    `;
  }

  showError(message: string, onRetry?: () => void): void {
    this.canvasContainer.innerHTML = `
      <div class="me-error">
        <p class="me-error-text">${message}</p>
        <button class="me-btn me-btn-primary">Retry</button>
      </div>
    `;

    const retryBtn = this.canvasContainer.querySelector('.me-btn-primary');
    if (retryBtn && onRetry) {
      retryBtn.addEventListener('click', onRetry);
    }
  }

  clearCanvasContainer(): void {
    this.canvasContainer.innerHTML = '';
  }

  getCanvasContainer(): HTMLElement {
    return this.canvasContainer;
  }

  registerCustomTool(tool: CustomTool): void {
    this.customTools.set(tool.id, tool);

    // Add button to toolbar
    const btn = document.createElement('button');
    btn.className = 'me-btn me-btn-tool';

    if (typeof tool.icon === 'string') {
      btn.innerHTML = tool.icon;
    } else {
      btn.appendChild(tool.icon);
    }

    if (tool.name) {
      const tooltip = document.createElement('span');
      tooltip.className = 'me-tooltip';
      tooltip.textContent = tool.shortcut ? `${tool.name} (${tool.shortcut})` : tool.name;
      btn.appendChild(tooltip);
    }

    btn.onclick = () => this.store.setTool(tool.id);
    this.toolButtons.set(tool.id, btn);
    this.toolbar.insertBefore(btn, this.toolbar.querySelector('.me-toolbar-divider'));
  }

  unregisterCustomTool(toolId: string): void {
    this.customTools.delete(toolId);
    const btn = this.toolButtons.get(toolId);
    if (btn) {
      btn.remove();
      this.toolButtons.delete(toolId);
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
