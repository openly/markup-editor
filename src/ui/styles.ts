export const styles = `
.markup-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  background: var(--me-bg);
  color: var(--me-text);
  overflow: hidden;
}

/* Top Bar */
.me-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  flex-shrink: 0;
  background: var(--me-surface);
  border-bottom: 1px solid var(--me-border);
}

.me-topbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.me-topbar-center {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Image preview panel */
.me-preview-panel {
  display: flex;
  align-items: center;
  background: var(--me-surface);
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
  padding: 6px 12px;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

.me-preview-panel .me-preview-scroll {
  width: 100%;
}

.me-preview-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--me-border) transparent;
  padding: 2px 0;
}

.me-preview-scroll::-webkit-scrollbar {
  height: 4px;
}

.me-preview-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.me-preview-scroll::-webkit-scrollbar-thumb {
  background: var(--me-border);
  border-radius: 2px;
}

.me-preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 4px;
  border-radius: 6px;
  border: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.me-preview-item:hover {
  background: var(--me-surface-hover);
}

.me-preview-item.active {
  border-color: var(--me-primary);
}

.me-preview-thumb {
  display: inline-block;
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
}

.me-preview-label {
  font-size: 10px;
  color: var(--me-text-muted);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.me-preview-item.active .me-preview-label {
  color: var(--me-primary);
  font-weight: 500;
}

/* Main content area */
.me-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Toolbar */
.me-toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  background: var(--me-toolbar-bg);
  border-right: 1px solid var(--me-border);
  flex-shrink: 0;
  gap: 2px;
}

.me-toolbar.horizontal {
  flex-direction: row;
  width: 100%;
  height: auto;
  border-right: none;
  border-bottom: 1px solid var(--me-border);
}

.me-toolbar-divider {
  width: 32px;
  height: 1px;
  background: var(--me-border);
  margin: 8px 0;
}

.me-toolbar.horizontal .me-toolbar-divider {
  width: 1px;
  height: 24px;
  margin: 0 8px;
}

/* Canvas area */
.me-canvas-container {
  flex: 1;
  position: relative;
  background: var(--me-canvas-bg);
  overflow: hidden;
}

.me-canvas-stage {
  width: 100%;
  height: 100%;
}

/* Panels */
.me-panel {
  background: var(--me-panel-bg);
  border-left: 1px solid var(--me-border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.me-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--me-border);
  font-weight: 600;
  font-size: 13px;
}

.me-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* History panel */
.me-history-wrapper {
  display: flex;
  flex-shrink: 0;
  border-left: 1px solid var(--me-border);
}

.me-history-wrapper .me-history-panel {
  width: 220px;
  border-left: none;
  transition: width 0.2s ease;
  overflow: hidden;
}

.me-history-wrapper.collapsed .me-history-panel {
  width: 0;
}

.me-history-toggle {
  display: flex;
  align-items: flex-start;
  padding: 8px 2px;
  background: var(--me-panel-bg);
}

.me-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.me-history-item:hover {
  background: var(--me-surface-hover);
}

.me-history-item.active {
  background: var(--me-primary);
  color: white;
}

.me-history-item.future {
  opacity: 0.5;
  text-decoration: line-through;
}

.me-history-time {
  font-size: 11px;
  color: var(--me-text-muted);
}

.me-history-item.active .me-history-time {
  color: rgba(255,255,255,0.7);
}

/* Notes panel */
.me-notes-panel {
  padding: 12px;
  background: var(--me-surface);
  border-top: 1px solid var(--me-border);
  flex-shrink: 0;
}

.me-notes-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--me-text-muted);
  margin-bottom: 6px;
}

.me-notes-input {
  width: 100%;
  height: 56px;
  padding: 8px 12px;
  border: 1px solid var(--me-border);
  border-radius: 6px;
  background: var(--me-bg);
  color: var(--me-text);
  font-family: inherit;
  font-size: 13px;
  resize: none;
}

.me-notes-input:focus {
  outline: none;
  border-color: var(--me-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Buttons */
.me-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--me-text);
  cursor: pointer;
  transition: background 0.15s;
}

.me-btn:hover:not(:disabled) {
  background: var(--me-surface-hover);
}

.me-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.me-btn-primary {
  background: var(--me-primary);
  color: white;
  padding: 8px 16px;
  gap: 6px;
}

.me-btn-primary:hover:not(:disabled) {
  background: var(--me-primary-hover);
}

.me-btn-icon {
  width: 36px;
  height: 36px;
}

.me-btn-tool {
  width: 40px;
  height: 40px;
  position: relative;
}

.me-btn-tool.active {
  background: var(--me-primary);
  color: white;
}

.me-btn-tool .me-tooltip {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
  padding: 4px 8px;
  background: #1f2937;
  color: white;
  font-size: 12px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s, visibility 0.15s;
  z-index: 100;
}

.me-btn-tool:hover .me-tooltip {
  opacity: 1;
  visibility: visible;
}

/* Color picker */
.me-color-picker {
  position: relative;
}

.me-color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid var(--me-border);
  cursor: pointer;
}

.me-color-dropdown {
  position: absolute;
  left: 100%;
  bottom: 0;
  margin-left: 8px;
  padding: 8px;
  background: var(--me-surface);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
}

.me-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 24px);
  gap: 4px;
  margin-bottom: 8px;
}

.me-color-option {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s;
}

.me-color-option:hover {
  transform: scale(1.1);
}

.me-color-option.active {
  border-color: var(--me-primary);
}

.me-color-input {
  width: 100%;
  height: 28px;
  border: none;
  cursor: pointer;
}

/* Stroke picker */
.me-stroke-dropdown {
  position: absolute;
  left: 100%;
  bottom: -15px;
  margin-left: 8px;
  padding: 4px;
  background: var(--me-surface);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
}

.me-stroke-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.me-stroke-option:hover {
  background: var(--me-surface-hover);
}

.me-stroke-option.active {
  background: rgba(59, 130, 246, 0.1);
}

.me-stroke-preview {
  width: 32px;
  background: var(--me-text);
  border-radius: 2px;
}

.me-stroke-label {
  font-size: 12px;
  color: var(--me-text-muted);
}

/* Navigation */
.me-nav-text {
  font-size: 13px;
  color: var(--me-text-muted);
  min-width: 60px;
  text-align: center;
}

.me-image-name {
  font-size: 13px;
  color: var(--me-text-muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-zoom-text {
  font-size: 12px;
  color: var(--me-text-muted);
  min-width: 45px;
  text-align: center;
}

/* Empty state */
.me-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
}

.me-empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  color: var(--me-text-muted);
  opacity: 0.5;
}

.me-empty-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
}

.me-empty-text {
  font-size: 14px;
  color: var(--me-text-muted);
  margin-bottom: 20px;
}

.me-upload-input {
  display: none;
}

.me-url-input {
  width: 320px;
  padding: 10px 14px;
  border: 1px solid var(--me-border);
  border-radius: 6px;
  background: var(--me-surface);
  color: var(--me-text);
  font-size: 13px;
  margin-top: 16px;
}

.me-url-input:focus {
  outline: none;
  border-color: var(--me-primary);
}

.me-url-input::placeholder {
  color: var(--me-text-muted);
}

/* Loading state */
.me-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.me-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--me-border);
  border-top-color: var(--me-primary);
  border-radius: 50%;
  animation: me-spin 0.8s linear infinite;
}

@keyframes me-spin {
  to { transform: rotate(360deg); }
}

.me-loading-text {
  margin-top: 12px;
  color: var(--me-text-muted);
}

/* Error state */
.me-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
}

.me-error-text {
  color: #ef4444;
  margin-bottom: 16px;
}

/* Text edit modal */
.me-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.me-modal {
  background: var(--me-surface);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.me-modal-title {
  font-weight: 600;
  margin-bottom: 12px;
}

.me-modal-textarea {
  width: 320px;
  height: 96px;
  padding: 10px;
  border: 1px solid var(--me-border);
  border-radius: 6px;
  background: var(--me-bg);
  color: var(--me-text);
  font-family: inherit;
  font-size: 14px;
  resize: none;
}

.me-modal-textarea:focus {
  outline: none;
  border-color: var(--me-primary);
}

.me-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* Dropdown */
.me-dropdown {
  position: relative;
}

.me-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--me-surface);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 100;
}

.me-dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  color: var(--me-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.me-dropdown-item:hover {
  background: var(--me-surface-hover);
}

/* Overlay controls */
.me-overlay-section {
  position: relative;
}

.me-overlay-section .me-btn-icon.active {
  background: var(--me-primary);
  color: white;
}

.me-overlay-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 8px;
  padding: 12px;
  background: var(--me-surface);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
  min-width: 220px;
}

.me-overlay-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.me-overlay-desc {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-bottom: 12px;
}

.me-overlay-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  padding: 4px 8px;
  background: var(--me-surface-hover);
  border-radius: 4px;
  word-break: break-word;
}

.me-overlay-name-input {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid var(--me-border);
  border-radius: 4px;
  background: var(--me-surface);
  color: var(--me-text);
  outline: none;
  margin-bottom: 8px;
}

.me-overlay-name-input:focus {
  border-color: var(--me-primary);
}

.me-overlay-name-input::placeholder {
  color: var(--me-text-muted);
}

.me-overlay-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 12px;
}

.me-overlay-slider {
  flex: 1;
  height: 4px;
  accent-color: var(--me-primary);
  cursor: pointer;
}

.me-overlay-value {
  font-size: 12px;
  color: var(--me-text-muted);
  min-width: 36px;
  text-align: right;
}

.me-overlay-upload-btn {
  width: 100%;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}

.me-overlay-remove-btn {
  width: 100%;
  justify-content: center;
  gap: 6px;
  color: #ef4444;
}

.me-overlay-remove-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Multi-overlay list */
.me-overlay-list {
  max-height: 200px;
  overflow-y: auto;
  margin: 8px 0;
}

.me-overlay-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.me-overlay-item:hover {
  background: var(--me-surface-hover);
}

.me-overlay-item.active {
  background: rgba(59, 130, 246, 0.1);
}

.me-overlay-radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--me-border);
  flex-shrink: 0;
  transition: border-color 0.15s, background 0.15s;
}

.me-overlay-radio.selected {
  border-color: var(--me-primary);
  background: var(--me-primary);
  box-shadow: inset 0 0 0 2px white;
}

.me-overlay-item-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-overlay-delete {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.me-overlay-item:hover .me-overlay-delete {
  opacity: 1;
}

.me-overlay-delete:hover {
  color: #ef4444;
}

/* Grid & Compare button active states */
#me-grid-btn.active,
#me-compare-btn.active {
  background: var(--me-primary);
  color: white;
}

/* Compare mode toolbar disabled */
.me-toolbar.compare-disabled .me-btn-tool {
  opacity: 0.4;
  pointer-events: none;
}

/* Compare side-by-side */
.me-compare-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  background: var(--me-canvas-bg);
}

.me-compare-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.me-compare-label {
  position: absolute;
  top: 8px;
  left: 12px;
  z-index: 2;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  background: rgba(0,0,0,0.5);
  padding: 3px 10px;
  border-radius: 4px;
  pointer-events: none;
}

.me-compare-canvas {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  position: relative;
  min-height: 0;
}

.me-compare-divider {
  width: 2px;
  background: rgba(255,255,255,0.3);
  flex-shrink: 0;
}

/* Icons */
.me-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.me-icon-sm {
  width: 16px;
  height: 16px;
}

/* Kebab overflow menu */
.me-kebab-btn {
  display: none;
}

.me-kebab-btn .me-icon circle {
  fill: currentColor;
  stroke: none;
}

/* Topbar kebab menu */
.me-topbar-kebab-btn {
  display: none;
}

.me-topbar-kebab-btn .me-icon circle {
  fill: currentColor;
  stroke: none;
}

.me-kebab-dropdown {
  position: fixed;
  background: var(--me-surface);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  z-index: 200;
  padding: 4px;
  min-width: 160px;
  max-height: 320px;
  overflow-y: auto;
}

.me-kebab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--me-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.me-kebab-item:hover {
  background: var(--me-surface-hover);
}

.me-kebab-item.active {
  background: var(--me-primary);
  color: white;
}

.me-kebab-item-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.me-kebab-item-icon .me-icon {
  width: 18px;
  height: 18px;
}

.me-kebab-item-label {
  flex: 1;
}

.me-kebab-item-shortcut {
  font-size: 11px;
  color: var(--me-text-muted);
  opacity: 0.7;
}

.me-kebab-item.active .me-kebab-item-shortcut {
  color: rgba(255,255,255,0.7);
}

/* ===== RESPONSIVE: Container Queries ===== */
.markup-editor {
  container-type: inline-size;
  container-name: markup-editor;
}

/* ----- Medium: container < 768px ----- */
@container markup-editor (max-width: 768px) {
  .me-topbar {
    height: auto;
    min-height: 40px;
    padding: 4px 8px;
    flex-wrap: wrap;
    gap: 4px;
  }

  .me-topbar-section {
    gap: 4px;
  }

  .me-topbar-center {
    gap: 2px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .me-image-name {
    max-width: 120px;
    font-size: 12px;
  }

  .me-btn-icon {
    width: 32px;
    height: 32px;
  }

  .me-btn-tool {
    width: 36px;
    height: 36px;
  }

  .me-icon {
    width: 18px;
    height: 18px;
  }

  .me-history-wrapper .me-history-panel {
    width: 180px;
  }

  .me-notes-input {
    height: 44px;
  }

  .me-notes-panel {
    padding: 8px;
  }

  /* Scale down preview thumbs */
  .me-preview-thumb {
    width: 42px;
    height: 42px;
  }

  .me-preview-item {
    padding: 3px;
    gap: 2px;
  }

  .me-preview-label {
    font-size: 9px;
    max-width: 46px;
  }

  .me-preview-panel {
    padding: 4px 8px;
  }
}

/* ----- Small: container < 540px ----- */
@container markup-editor (max-width: 540px) {
  .me-topbar {
    min-height: 36px;
    padding: 4px 6px;
    gap: 2px;
  }

  .me-topbar-section {
    gap: 2px;
  }

  .me-topbar-center {
    order: 0;
    width: auto;
    justify-content: center;
    gap: 2px;
    padding-top: 0;
    flex: 1;
    min-width: 0;
  }

  .me-image-name {
    display: none;
  }

  .me-nav-text {
    font-size: 11px;
    min-width: 40px;
  }

  .me-zoom-text {
    font-size: 11px;
    min-width: 36px;
  }

  .me-btn-icon {
    width: 28px;
    height: 28px;
    padding: 4px;
  }

  .me-icon {
    width: 16px;
    height: 16px;
  }

  /* Preview thumbs small */
  .me-preview-thumb {
    width: 32px;
    height: 32px;
  }

  .me-preview-item {
    padding: 2px;
    gap: 2px;
  }

  .me-preview-label {
    font-size: 8px;
    max-width: 36px;
  }

  .me-preview-panel {
    padding: 3px 6px;
  }

  .me-preview-scroll {
    gap: 4px;
  }

  /* Switch toolbar to horizontal top */
  .me-main {
    flex-direction: column;
    overflow: visible;
  }

  .me-toolbar {
    flex-direction: row;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--me-border);
    padding: 4px 6px;
    gap: 2px;
    overflow: visible;
    justify-content: center;
    flex-wrap: wrap;
    align-items: center;
    position: relative;
    z-index: 50;
  }

  .me-toolbar-divider {
    width: 1px;
    height: 24px;
    margin: 0 4px;
  }

  .me-btn-tool {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
  }

  .me-btn-tool .me-tooltip {
    display: none;
  }

  /* Color picker & stroke picker alignment in horizontal toolbar */
  .me-color-picker {
    display: flex;
    align-items: center;
    position: static;
  }

  .me-color-picker .me-btn {
    padding: 4px;
  }

  /* Color dropdown: open above, anchored to canvas container */
  .me-color-dropdown {
    position: fixed;
    left: auto;
    right: auto;
    bottom: auto;
    top: auto;
    margin: 0;
    padding: 10px;
    z-index: 200;
  }

  /* Stroke dropdown: open above */
  .me-stroke-dropdown {
    position: fixed;
    left: auto;
    right: auto;
    bottom: auto;
    top: auto;
    margin: 0;
    padding: 6px;
    z-index: 200;
  }

  /* Hide history panel */
  .me-history-wrapper {
    display: none;
  }

  .me-notes-panel {
    padding: 6px;
  }

  .me-notes-input {
    height: 36px;
    font-size: 12px;
  }

  .me-notes-label {
    font-size: 11px;
    margin-bottom: 4px;
  }

  /* Preview panel compact */
  .me-preview-thumb {
    width: 36px;
    height: 36px;
  }

  .me-preview-label {
    font-size: 9px;
    max-width: 40px;
  }

  .me-preview-panel {
    padding: 4px 8px;
  }

  /* Overlay dropdown responsive */
  .me-overlay-dropdown {
    min-width: 180px;
    right: 0;
    left: auto;
  }

  /* Modal responsive */
  .me-modal {
    margin: 12px;
    padding: 16px;
  }

  .me-modal-textarea {
    width: 100%;
    min-width: 200px;
  }

  .me-url-input {
    width: 100%;
    max-width: 280px;
  }

  .me-empty-state {
    padding: 20px;
  }

  .me-empty-icon {
    width: 48px;
    height: 48px;
  }

  .me-empty-title {
    font-size: 16px;
  }

  .me-empty-text {
    font-size: 13px;
  }
}

/* ----- Extra small: container < 360px ----- */
@container markup-editor (max-width: 360px) {
  .me-topbar {
    padding: 2px 4px;
  }

  /* Hide overlay section on extra small */
  .me-overlay-section {
    display: none;
  }

  .me-btn-icon {
    width: 26px;
    height: 26px;
    padding: 3px;
  }

  .me-btn-tool {
    width: 30px;
    height: 30px;
  }

  .me-icon {
    width: 14px;
    height: 14px;
  }

  .me-topbar-center {
    gap: 1px;
  }

  .me-nav-text {
    font-size: 10px;
    min-width: 32px;
  }

  .me-zoom-text {
    display: none;
  }

  .me-notes-panel {
    display: none;
  }

  /* Preview: show tiny thumbs, no labels */
  .me-preview-thumb {
    width: 26px;
    height: 26px;
  }

  .me-preview-label {
    display: none;
  }

  .me-preview-item {
    padding: 2px;
    gap: 0;
  }

  .me-preview-panel {
    padding: 2px 4px;
  }

  .me-preview-scroll {
    gap: 3px;
  }

  .me-toolbar {
    padding: 2px;
  }

  .me-color-swatch {
    width: 20px;
    height: 20px;
  }

  .markup-editor {
    font-size: 12px;
  }
}

/* ----- Fallback: media queries for when container queries are unsupported ----- */
@supports not (container-type: inline-size) {
  @media (max-width: 768px) {
    .me-topbar {
      height: auto;
      min-height: 40px;
      padding: 4px 8px;
      flex-wrap: wrap;
      gap: 4px;
    }

    .me-topbar-center {
      gap: 2px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .me-image-name {
      max-width: 120px;
    }

    .me-btn-icon {
      width: 32px;
      height: 32px;
    }

    .me-btn-tool {
      width: 36px;
      height: 36px;
    }

    .me-history-wrapper .me-history-panel {
      width: 180px;
    }
  }

  @media (max-width: 540px) {
    .me-topbar-center {
      order: 3;
      width: 100%;
      justify-content: center;
    }

    .me-image-name {
      display: none;
    }

    .me-main {
      flex-direction: column;
      overflow: visible;
    }

    .me-toolbar {
      flex-direction: row;
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--me-border);
      padding: 4px 6px;
      gap: 2px;
      overflow: visible;
      justify-content: center;
      flex-wrap: wrap;
      align-items: center;
      position: relative;
      z-index: 50;
    }

    .me-toolbar-divider {
      width: 1px;
      height: 24px;
      margin: 0 4px;
    }

    .me-btn-tool .me-tooltip {
      display: none;
    }

    .me-color-picker {
      display: flex;
      align-items: center;
      position: static;
    }

    .me-history-wrapper {
      display: none;
    }

    .me-modal-textarea {
      width: 100%;
      min-width: 200px;
    }

    .me-url-input {
      width: 100%;
      max-width: 280px;
    }
  }
}
`;

export function injectStyles(): void {
  if (document.getElementById('markup-editor-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'markup-editor-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
