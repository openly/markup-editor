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
  width: 56px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--me-canvas-bg);
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
  top: 0;
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
  top: 0;
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
`;

export function injectStyles(): void {
  if (document.getElementById('markup-editor-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'markup-editor-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
