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
  { id: 'curve', name: 'Curve', shortcut: 'U', icon: 'curve' },
  { id: 'caption', name: 'Caption', shortcut: 'F', icon: 'caption' },
  { id: 'callout', name: 'Callout', shortcut: 'K', icon: 'callout' },
  { id: 'measure', name: 'Measure', shortcut: 'M', icon: 'measure' },
];

const DEFAULT_COLORS = [
  '#EF4444', '#10B981', '#2563EB', '#FFFF00', '#7C3AED',
  '#F472B6', '#FFFFFF', '#000000', "#00FFFF", '#FF1493'
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

interface UIOptions {
  showToolbar?: boolean;
  showHistoryPanel?: boolean;
  showNotesPanel?: boolean;
  withoutThumb?: boolean;
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
  private kebabBtn: HTMLButtonElement | null = null;
  private kebabDropdown: HTMLElement | null = null;
  private toolbarResizeObserver: ResizeObserver | null = null;
  private topbarKebabBtn: HTMLButtonElement | null = null;
  private topbarKebabDropdown: HTMLElement | null = null;
  private topbarResizeObserver: ResizeObserver | null = null;
  private topbarCenterItems: { el: HTMLElement; label: string; priority: 'primary' | 'secondary' | 'tertiary'; action: () => void; iconName?: keyof typeof icons }[] = [];

  constructor(container: HTMLElement, store: Store, options: UIOptions = {}) {
    this.container = container;
    this.store = store;
    this.options = {
      showToolbar: true,
      showHistoryPanel: true,
      showNotesPanel: true,
      withoutThumb: false,
      showTopBar: true,
      ...options,
    };

    this.createLayout();
    this.setupStoreListeners();
    this.setupTopbarOverflow();
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
    if (!this.options.withoutThumb) {
      this.previewPanel = this.createPreviewPanel();
      this.root.appendChild(this.previewPanel);
    }

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

    if (!this.options.withoutThumb) {
      leftSection.appendChild(prevBtn);
      leftSection.appendChild(navText);
      leftSection.appendChild(nextBtn);
    }
    // leftSection.appendChild(imageName);

    // Center section: Rotation and zoom
    const centerSection = document.createElement('div');
    centerSection.className = 'me-topbar-center';

    // Build center items array — items are tracked for overflow into kebab
    this.topbarCenterItems = [];

    // Rotate left
    const rotateCcwBtn = this.createButton('rotateCcw', 'Rotate left');
    rotateCcwBtn.classList.add('me-topbar-item');
    rotateCcwBtn.onclick = () => this.store.rotateImage(-90);
    this.topbarCenterItems.push({ el: rotateCcwBtn, label: 'Rotate left', priority: 'secondary', action: () => this.store.rotateImage(-90), iconName: 'rotateCcw' });

    // Rotate right
    const rotateCwBtn = this.createButton('rotateCw', 'Rotate right');
    rotateCwBtn.classList.add('me-topbar-item');
    rotateCwBtn.onclick = () => this.store.rotateImage(90);
    this.topbarCenterItems.push({ el: rotateCwBtn, label: 'Rotate right', priority: 'secondary', action: () => this.store.rotateImage(90), iconName: 'rotateCw' });

    // Divider 1
    const divider1 = document.createElement('div');
    divider1.className = 'me-topbar-divider me-topbar-item';
    divider1.style.cssText = 'width:1px;height:24px;background:var(--me-border);margin:0 8px';
    this.topbarCenterItems.push({ el: divider1, label: '', priority: 'secondary', action: () => {}, iconName: undefined });

    // Zoom out
    const zoomOutBtn = this.createButton('zoomOut', 'Zoom out');
    zoomOutBtn.classList.add('me-topbar-item');
    zoomOutBtn.onclick = () => { const s = this.store.getState(); this.store.setScale(s.scale / 1.2); };
    this.topbarCenterItems.push({ el: zoomOutBtn, label: 'Zoom out', priority: 'primary', action: () => { const s = this.store.getState(); this.store.setScale(s.scale / 1.2); }, iconName: 'zoomOut' });

    // Zoom text
    const zoomText = document.createElement('span');
    zoomText.className = 'me-zoom-text me-topbar-item';
    zoomText.id = 'me-zoom-text';
    zoomText.textContent = '100%';
    this.topbarCenterItems.push({ el: zoomText, label: '', priority: 'primary', action: () => {}, iconName: undefined });

    // Zoom in
    const zoomInBtn = this.createButton('zoomIn', 'Zoom in');
    zoomInBtn.classList.add('me-topbar-item');
    zoomInBtn.onclick = () => { const s = this.store.getState(); this.store.setScale(s.scale * 1.2); };
    this.topbarCenterItems.push({ el: zoomInBtn, label: 'Zoom in', priority: 'primary', action: () => { const s = this.store.getState(); this.store.setScale(s.scale * 1.2); }, iconName: 'zoomIn' });

    // Fit to screen
    const fitBtn = this.createButton('maximize', 'Fit to screen');
    fitBtn.classList.add('me-topbar-item');
    fitBtn.onclick = () => this.store.emit('fitToScreen');
    this.topbarCenterItems.push({ el: fitBtn, label: 'Fit to screen', priority: 'tertiary', action: () => this.store.emit('fitToScreen'), iconName: 'maximize' });

    // Reset 100%
    const resetBtn = document.createElement('button');
    resetBtn.className = 'me-btn me-topbar-item';
    resetBtn.textContent = '100%';
    resetBtn.style.fontSize = '12px';
    resetBtn.style.padding = '4px 8px';
    resetBtn.onclick = () => this.store.resetView();
    this.topbarCenterItems.push({ el: resetBtn, label: 'Reset 100%', priority: 'tertiary', action: () => this.store.resetView(), iconName: undefined });

    // Divider 2
    const divider2 = document.createElement('div');
    divider2.className = 'me-topbar-divider me-topbar-item';
    divider2.style.cssText = 'width:1px;height:24px;background:var(--me-border);margin:0 8px';
    this.topbarCenterItems.push({ el: divider2, label: '', priority: 'secondary', action: () => {}, iconName: undefined });

    // Grid toggle
    const gridBtn = this.createButton('grid', 'Toggle grid (G)');
    gridBtn.id = 'me-grid-btn';
    gridBtn.classList.add('me-topbar-item');
    gridBtn.onclick = () => this.options.onGridToggle?.();
    this.topbarCenterItems.push({ el: gridBtn, label: 'Toggle grid', priority: 'secondary', action: () => this.options.onGridToggle?.(), iconName: 'grid' });

    // Append all center items to DOM
    this.topbarCenterItems.forEach((item) => {
      centerSection.appendChild(item.el);
    });

    // Topbar kebab (more) button — hidden by default
    this.topbarKebabBtn = document.createElement('button');
    this.topbarKebabBtn.className = 'me-btn me-btn-icon me-topbar-kebab-btn';
    this.topbarKebabBtn.title = 'More options';
    this.topbarKebabBtn.appendChild(createIcon('moreVertical'));
    this.topbarKebabBtn.onclick = () => this.toggleTopbarKebabMenu();
    centerSection.appendChild(this.topbarKebabBtn);

    // Right section: Overlay
    const rightSection = document.createElement('div');
    rightSection.className = 'me-topbar-section';

    this.overlaySection = this.createOverlaySection();
    // rightSection.appendChild(this.overlaySection);

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
      btn.dataset.toolId = tool.id;
      btn.innerHTML = createIcon(tool.icon).outerHTML;

      const tooltip = document.createElement('span');
      tooltip.className = 'me-tooltip';
      tooltip.textContent = `${tool.name} (${tool.shortcut})`;
      btn.appendChild(tooltip);

      btn.onclick = () => this.store.setTool(tool.id);
      this.toolButtons.set(tool.id, btn);
      toolbar.appendChild(btn);
    });

    // Kebab (more) button — hidden by default, shown when tools overflow
    this.kebabBtn = document.createElement('button');
    this.kebabBtn.className = 'me-btn me-btn-tool me-kebab-btn';
    this.kebabBtn.title = 'More tools';
    this.kebabBtn.appendChild(createIcon('moreVertical'));
    this.kebabBtn.onclick = () => this.toggleKebabMenu();
    toolbar.appendChild(this.kebabBtn);

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

    // Divider before history actions
    const divider2 = document.createElement('div');
    divider2.className = 'me-toolbar-divider';
    toolbar.appendChild(divider2);

    // Undo button
    const toolbarUndoBtn = document.createElement('button');
    toolbarUndoBtn.className = 'me-btn me-btn-tool';
    toolbarUndoBtn.dataset.toolId = '__undo';
    toolbarUndoBtn.title = 'Undo';
    toolbarUndoBtn.innerHTML = createIcon('undo').outerHTML;
    const undoTooltip = document.createElement('span');
    undoTooltip.className = 'me-tooltip';
    undoTooltip.textContent = 'Undo (Cmd+Z)';
    toolbarUndoBtn.appendChild(undoTooltip);
    toolbarUndoBtn.onclick = () => { const img = this.store.getCurrentImage(); if (img) this.store.undo(img.id); };
    this.toolButtons.set('__undo', toolbarUndoBtn);
    toolbar.appendChild(toolbarUndoBtn);

    // Redo button
    const toolbarRedoBtn = document.createElement('button');
    toolbarRedoBtn.className = 'me-btn me-btn-tool';
    toolbarRedoBtn.dataset.toolId = '__redo';
    toolbarRedoBtn.title = 'Redo';
    toolbarRedoBtn.innerHTML = createIcon('redo').outerHTML;
    const redoTooltip = document.createElement('span');
    redoTooltip.className = 'me-tooltip';
    redoTooltip.textContent = 'Redo (Cmd+Shift+Z)';
    toolbarRedoBtn.appendChild(redoTooltip);
    toolbarRedoBtn.onclick = () => { const img = this.store.getCurrentImage(); if (img) this.store.redo(img.id); };
    this.toolButtons.set('__redo', toolbarRedoBtn);
    toolbar.appendChild(toolbarRedoBtn);

    // History toggle button
    const toolbarHistoryBtn = document.createElement('button');
    toolbarHistoryBtn.className = 'me-btn me-btn-tool';
    toolbarHistoryBtn.dataset.toolId = '__history';
    toolbarHistoryBtn.title = 'History';
    toolbarHistoryBtn.innerHTML = createIcon('panelRight').outerHTML;
    const historyTooltip = document.createElement('span');
    historyTooltip.className = 'me-tooltip';
    historyTooltip.textContent = 'History';
    toolbarHistoryBtn.appendChild(historyTooltip);
    toolbarHistoryBtn.onclick = () => {
      const hw = this.root.querySelector('.me-history-wrapper');
      if (hw) hw.classList.toggle('collapsed');
    };
    this.toolButtons.set('__history', toolbarHistoryBtn);
    toolbar.appendChild(toolbarHistoryBtn);

    // Update active tool
    this.updateActiveTool();

    // Watch for toolbar resize to manage overflow
    this.setupToolbarOverflow(toolbar);

    return toolbar;
  }

  private setupToolbarOverflow(toolbar: HTMLElement): void {
    this.toolbarResizeObserver = new ResizeObserver(() => {
      this.updateToolbarOverflow(toolbar);
    });
    this.toolbarResizeObserver.observe(toolbar);
    // Also observe the root for container size changes
    requestAnimationFrame(() => {
      if (this.root) {
        this.toolbarResizeObserver?.observe(this.root);
      }
    });
  }

  // IDs that should always remain visible in the toolbar
  private static PINNED_TOOLS = new Set(['__undo', '__redo']);

  private updateToolbarOverflow(toolbar: HTMLElement): void {
    const isHorizontal = getComputedStyle(toolbar).flexDirection === 'row';
    const toolEntries = Array.from(this.toolButtons.entries()).filter(([id]) => !UI.PINNED_TOOLS.has(id));

    if (isHorizontal) {
      // Horizontal: calculate how many tools fit based on available width
      const toolbarWidth = toolbar.clientWidth;
      // Reserve space for: kebab(36) + 2 dividers(~20) + color(~40) + stroke(~40) + undo(36) + redo(36) + history(36) + padding/gaps
      const reservedWidth = 260;
      const availableWidth = toolbarWidth - reservedWidth;
      const buttonSize = 36;
      const fitCount = Math.max(2, Math.floor(availableWidth / buttonSize));
      // Cap at half the tools max
      const maxVisible = Math.min(fitCount, Math.ceil(toolEntries.length / 2));

      let hiddenCount = 0;
      toolEntries.forEach(([_id, btn], index) => {
        if (index < maxVisible) {
          btn.style.display = '';
        } else {
          btn.style.display = 'none';
          hiddenCount++;
        }
      });

      // Pinned tools are always visible
      UI.PINNED_TOOLS.forEach((id) => {
        const btn = this.toolButtons.get(id);
        if (btn) btn.style.display = '';
      });

      if (this.kebabBtn) {
        this.kebabBtn.style.display = hiddenCount > 0 ? 'flex' : 'none';
      }
    } else {
      // Vertical: show half, rest in kebab
      const maxVisible = Math.ceil(toolEntries.length / 2);
      let hiddenCount = 0;

      toolEntries.forEach(([_id, btn], index) => {
        if (index < maxVisible) {
          btn.style.display = '';
        } else {
          btn.style.display = 'none';
          hiddenCount++;
        }
      });

      UI.PINNED_TOOLS.forEach((id) => {
        const btn = this.toolButtons.get(id);
        if (btn) btn.style.display = '';
      });

      if (this.kebabBtn) {
        this.kebabBtn.style.display = hiddenCount > 0 ? 'flex' : 'none';
      }
    }
  }

  private toggleKebabMenu(): void {
    if (this.kebabDropdown) {
      this.kebabDropdown.remove();
      this.kebabDropdown = null;
      return;
    }

    this.closeDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'me-kebab-dropdown';

    const currentTool = this.store.getState().currentTool;

    // Action button metadata for undo/redo/history
    const actionMeta: Record<string, { label: string; icon: keyof typeof icons; shortcut: string; action: () => void }> = {
      '__undo': { label: 'Undo', icon: 'undo', shortcut: 'Cmd+Z', action: () => { const img = this.store.getCurrentImage(); if (img) this.store.undo(img.id); } },
      '__redo': { label: 'Redo', icon: 'redo', shortcut: 'Cmd+Shift+Z', action: () => { const img = this.store.getCurrentImage(); if (img) this.store.redo(img.id); } },
      '__history': { label: 'History', icon: 'panelRight', shortcut: '', action: () => { const hw = this.root.querySelector('.me-history-wrapper'); const ht = this.root.querySelector('.me-history-toggle') as HTMLElement; if (hw) { hw.classList.toggle('collapsed'); if (ht) ht.style.display = hw.classList.contains('collapsed') ? 'none' : 'flex'; } } },
    };

    // Add all hidden tools to the dropdown
    this.toolButtons.forEach((btn, id) => {
      if (btn.style.display !== 'none') return; // skip visible tools

      const tool = TOOLS.find((t) => t.id === id);
      const action = actionMeta[id];

      if (!tool && !action) return;

      const item = document.createElement('button');
      item.className = 'me-kebab-item';

      if (tool) {
        if (id === currentTool) item.classList.add('active');

        const iconEl = createIcon(tool.icon);
        iconEl.classList.add('me-kebab-item-icon');

        const label = document.createElement('span');
        label.className = 'me-kebab-item-label';
        label.textContent = tool.name;

        const shortcut = document.createElement('span');
        shortcut.className = 'me-kebab-item-shortcut';
        shortcut.textContent = tool.shortcut;

        item.appendChild(iconEl);
        item.appendChild(label);
        item.appendChild(shortcut);

        item.onclick = () => {
          this.store.setTool(tool.id);
          dropdown.remove();
          this.kebabDropdown = null;
        };
      } else if (action) {
        const iconEl = createIcon(action.icon);
        iconEl.classList.add('me-kebab-item-icon');

        const label = document.createElement('span');
        label.className = 'me-kebab-item-label';
        label.textContent = action.label;

        if (action.shortcut) {
          const shortcut = document.createElement('span');
          shortcut.className = 'me-kebab-item-shortcut';
          shortcut.textContent = action.shortcut;
          item.appendChild(iconEl);
          item.appendChild(label);
          item.appendChild(shortcut);
        } else {
          item.appendChild(iconEl);
          item.appendChild(label);
        }

        item.onclick = () => {
          action.action();
          dropdown.remove();
          this.kebabDropdown = null;
        };
      }

      dropdown.appendChild(item);
    });

    // Also add any custom tools that are hidden
    this.customTools.forEach((tool) => {
      const btn = this.toolButtons.get(tool.id);
      if (!btn || btn.style.display !== 'none') return;

      const item = document.createElement('button');
      item.className = 'me-kebab-item';
      if (tool.id === currentTool) item.classList.add('active');

      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'me-kebab-item-icon';
      if (typeof tool.icon === 'string') {
        iconWrapper.innerHTML = tool.icon;
      } else {
        iconWrapper.appendChild(tool.icon.cloneNode(true));
      }

      const label = document.createElement('span');
      label.className = 'me-kebab-item-label';
      label.textContent = tool.name || tool.id;

      item.appendChild(iconWrapper);
      item.appendChild(label);

      item.onclick = () => {
        this.store.setTool(tool.id);
        dropdown.remove();
        this.kebabDropdown = null;
      };

      dropdown.appendChild(item);
    });

    if (this.kebabBtn) {
      this.kebabBtn.parentElement?.appendChild(dropdown);
      this.positionKebabDropdown(this.kebabBtn, dropdown);
    }

    this.kebabDropdown = dropdown;

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (this.kebabBtn?.contains(e.target as Node)) return;
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        this.kebabDropdown = null;
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
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
      this.positionDropdownFixed(swatch, dropdown);
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
      this.positionDropdownFixed(btn, dropdown);
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

    const closeBtn = this.createButton('x', 'Close history');
    closeBtn.className = 'me-btn me-btn-icon me-history-close-btn';
    closeBtn.onclick = () => wrapper.classList.add('collapsed');

    actions.appendChild(undoBtn);
    actions.appendChild(redoBtn);
    actions.appendChild(closeBtn);
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
    wrapper.classList.add('collapsed');
    toggleBtn.appendChild(createIcon('panelRight'));
    toggleBtn.onclick = () => {
      wrapper.classList.toggle('collapsed');
      if (wrapper.classList.contains('collapsed')) {
        toggleStrip.style.display = 'none';
      }
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

  private isToolbarHorizontal(): boolean {
    if (!this.toolbar) return false;
    return getComputedStyle(this.toolbar).flexDirection === 'row';
  }

  private positionKebabDropdown(trigger: HTMLElement, dropdown: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.marginLeft = '0';
    dropdown.style.marginTop = '0';

    if (this.isToolbarHorizontal()) {
      // Horizontal toolbar: open below the 3-dot button
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.top = `${rect.bottom + 8}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.right = 'auto';

      requestAnimationFrame(() => {
        const dropRect = dropdown.getBoundingClientRect();
        if (dropRect.right > window.innerWidth) {
          dropdown.style.left = `${window.innerWidth - dropRect.width - 8}px`;
        }
        if (dropRect.left < 0) {
          dropdown.style.left = '8px';
        }
        if (dropRect.bottom > window.innerHeight) {
          // No room below, flip above
          dropdown.style.top = 'auto';
          dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        }
      });
    } else {
      // Vertical toolbar: open to the right, vertically centered on the 3-dot button
      dropdown.style.left = `${rect.right + 8}px`;
      dropdown.style.top = '0px';
      dropdown.style.bottom = 'auto';
      dropdown.style.right = 'auto';

      requestAnimationFrame(() => {
        const dropRect = dropdown.getBoundingClientRect();
        const triggerCenterY = rect.top + rect.height / 2;
        const centeredTop = triggerCenterY - dropRect.height / 2;
        dropdown.style.top = `${centeredTop}px`;

        const newDropRect = dropdown.getBoundingClientRect();
        if (newDropRect.right > window.innerWidth) {
          dropdown.style.left = `${rect.left - dropRect.width - 8}px`;
        }
        if (newDropRect.bottom > window.innerHeight) {
          dropdown.style.top = `${window.innerHeight - dropRect.height - 8}px`;
        }
        if (newDropRect.top < 0) {
          dropdown.style.top = '8px';
        }
      });
    }
  }

  private positionDropdownFixed(trigger: HTMLElement, dropdown: HTMLElement): void {
    if (!this.isToolbarHorizontal()) return;
    const rect = trigger.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + 8}px`;
    dropdown.style.bottom = 'auto';
    dropdown.style.right = 'auto';
    dropdown.style.marginLeft = '0';
    dropdown.style.marginTop = '0';

    // After rendering, clamp to viewport edges
    requestAnimationFrame(() => {
      const dropRect = dropdown.getBoundingClientRect();
      if (dropRect.right > window.innerWidth) {
        dropdown.style.left = `${window.innerWidth - dropRect.width - 8}px`;
      }
      if (dropRect.left < 0) {
        dropdown.style.left = '8px';
      }
      if (dropRect.bottom > window.innerHeight) {
        // If no room below, flip above
        dropdown.style.top = 'auto';
        dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
      }
    });
  }

  private setupTopbarOverflow(): void {
    if (!this.topBar) return;

    this.topbarResizeObserver = new ResizeObserver(() => {
      this.updateTopbarOverflow();
    });
    this.topbarResizeObserver.observe(this.topBar);
    requestAnimationFrame(() => {
      if (this.root) {
        this.topbarResizeObserver?.observe(this.root);
      }
    });
  }

  private updateTopbarOverflow(): void {
    const topbarWidth = this.topBar.clientWidth;
    // Left section ~120px, right section ~40px, padding ~24px, kebab btn ~32px
    const reservedWidth = 220;
    const availableWidth = topbarWidth - reservedWidth;
    const itemSize = 34; // approximate width per center item

    const maxVisible = Math.max(2, Math.floor(availableWidth / itemSize));

    let visibleCount = 0;
    let hiddenCount = 0;

    this.topbarCenterItems.forEach((item) => {
      // Dividers (no label): show only if adjacent items are visible
      if (!item.label) {
        // Will be handled after
        return;
      }
      if (visibleCount < maxVisible) {
        item.el.style.display = '';
        visibleCount++;
      } else {
        item.el.style.display = 'none';
        hiddenCount++;
      }
    });

    // Show/hide dividers based on neighbors
    this.topbarCenterItems.forEach((item, index) => {
      if (item.label) return; // skip non-dividers
      const prev = this.topbarCenterItems[index - 1];
      const next = this.topbarCenterItems[index + 1];
      const prevVisible = prev && prev.el.style.display !== 'none';
      const nextVisible = next && next.el.style.display !== 'none';
      item.el.style.display = (prevVisible && nextVisible) ? '' : 'none';
    });

    if (this.topbarKebabBtn) {
      this.topbarKebabBtn.style.display = hiddenCount > 0 ? 'flex' : 'none';
    }
  }

  private toggleTopbarKebabMenu(): void {
    if (this.topbarKebabDropdown) {
      this.topbarKebabDropdown.remove();
      this.topbarKebabDropdown = null;
      return;
    }

    this.closeDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'me-kebab-dropdown';

    // Add hidden topbar items to dropdown
    this.topbarCenterItems.forEach((item) => {
      if (!item.label) return; // skip dividers
      if (item.el.style.display !== 'none') return; // skip visible

      const menuItem = document.createElement('button');
      menuItem.className = 'me-kebab-item';

      if (item.iconName) {
        const iconEl = createIcon(item.iconName);
        iconEl.classList.add('me-kebab-item-icon');
        menuItem.appendChild(iconEl);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'me-kebab-item-icon';
        placeholder.textContent = '';
        menuItem.appendChild(placeholder);
      }

      const label = document.createElement('span');
      label.className = 'me-kebab-item-label';
      label.textContent = item.label;
      menuItem.appendChild(label);

      menuItem.onclick = () => {
        item.action();
        dropdown.remove();
        this.topbarKebabDropdown = null;
      };

      dropdown.appendChild(menuItem);
    });

    if (this.topbarKebabBtn) {
      this.topBar.appendChild(dropdown);
      // Position below the kebab button
      const rect = this.topbarKebabBtn.getBoundingClientRect();
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.right = 'auto';
      dropdown.style.bottom = 'auto';

      requestAnimationFrame(() => {
        const dropRect = dropdown.getBoundingClientRect();
        if (dropRect.right > window.innerWidth) {
          dropdown.style.left = `${window.innerWidth - dropRect.width - 8}px`;
        }
      });
    }

    this.topbarKebabDropdown = dropdown;

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (this.topbarKebabBtn?.contains(e.target as Node)) return;
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        this.topbarKebabDropdown = null;
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
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
    if (this.kebabDropdown) {
      this.kebabDropdown.remove();
      this.kebabDropdown = null;
    }
    if (this.topbarKebabDropdown) {
      this.topbarKebabDropdown.remove();
      this.topbarKebabDropdown = null;
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
      // Don't highlight action buttons (undo/redo/history) as active tool
      if (id.startsWith('__')) return;
      btn.classList.toggle('active', id === state.currentTool);
    });
    // Highlight kebab button if the active tool is hidden (inside kebab)
    if (this.kebabBtn) {
      const activeBtn = this.toolButtons.get(state.currentTool);
      const activeIsHidden = activeBtn?.style.display === 'none';
      this.kebabBtn.classList.toggle('active', activeIsHidden);
    }
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
    this.toolbarResizeObserver?.disconnect();
    this.topbarResizeObserver?.disconnect();
    this.root.remove();
  }
}
