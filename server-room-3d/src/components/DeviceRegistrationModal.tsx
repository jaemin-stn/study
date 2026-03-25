import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import { DEVICE_TEMPLATES } from "../utils/deviceTemplates";
import type { VendorName } from "../types";
import {
  exportRegisteredDevicesToExcel,
  parseRegisteredDevicesFromExcel,
} from "../utils/storage";
import {
  getNodeName,
  getChildren,
  getAncestorPath,
  getSubtreeEquipmentCount,
  getSubtreeNodeIds,
} from "../utils/nodeUtils";
import type { HierarchyNode } from "../types";

const VENDORS: VendorName[] = [
  "코위버PTN",
  "CISCO",
  "Huawei",
  "Nokia",
  "유비쿼스",
];

// Simple IP format validation (X.X.X.X)
const isValidIP = (ip: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
  ip.split(".").every((n) => parseInt(n) >= 0 && parseInt(n) <= 255);

// Simple MAC format validation (XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX)
const isValidMAC = (mac: string) =>
  /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(mac);

// CSS for this modal
const MODAL_STYLES = `
.drm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: drm-fade-in 0.25s ease-out;
}
@keyframes drm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.drm-modal {
  background: var(--modal-bg);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  width: 1400px;
  max-width: 95vw;
  height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: drm-zoom-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes drm-zoom-in {
  from { transform: scale(0.96) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.drm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-weak);
}
.drm-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  letter-spacing: -0.01em;
}
.drm-header h2 .icon-wrap {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--theme-primary), #4872d8);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(110, 159, 255, 0.25);
  font-size: 18px;
  color: white;
}
.drm-close {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  line-height: 0;
  outline: none;
  margin: 0;
}
.drm-close:hover,
.drm-close:focus {
  background: var(--severity-critical);
  color: #fff;
  border-color: var(--severity-critical);
  transform: rotate(90deg);
  box-shadow: 0 4px 12px rgba(255, 60, 60, 0.3);
}
.drm-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  padding: 0;
}
.drm-sidebar {
  width: 280px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-weak);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.drm-sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-weak);
}
.drm-sidebar-search-wrap {
  position: relative;
}
.drm-sidebar-search {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 32px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: 13px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  outline: none;
}
.drm-sidebar-search:focus {
  border-color: var(--theme-primary);
  background: var(--bg-primary);
}
.drm-sidebar-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--text-tertiary);
}
.drm-sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}
.drm-content {
  flex: 1;
  overflow: hidden;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--bg-primary);
}

/* Node Tree Styles */
.drm-tree-node {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;
  gap: 6px;
  border-left: 3px solid transparent;
}
.drm-tree-node:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}
.drm-tree-node.selected {
  background: var(--selected-bg);
  color: var(--theme-primary);
  border-left-color: var(--theme-primary);
  font-weight: 600;
}
.drm-tree-node-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform 0.2s;
}
.drm-tree-node-toggle.expanded {
  transform: rotate(90deg);
}
.drm-tree-node-icon {
  font-size: 14px;
}
.drm-tree-node-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.drm-tree-node-count {
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 10px;
}
.drm-tree-node.match {
  color: var(--text-primary);
}
.drm-tree-node.match .drm-tree-node-name {
  text-decoration: underline;
  text-decoration-color: var(--theme-primary);
  text-underline-offset: 3px;
}

/* Registration Modal Layer (Separate from main modal) */
.drm-reg-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2100; /* Higher than main modal */
  backdrop-filter: blur(4px);
  animation: drm-fade-in 0.2s ease-out;
}
.drm-reg-modal {
  background: var(--modal-bg);
  border: 1px solid var(--border-medium);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 600px;
  max-width: 90vw;
  padding: 32px;
  animation: drm-zoom-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Table Horizontal Clipping & Responsiveness */
.drm-table-content {
  flex: 1;
  min-height: 0;
  overflow: auto; /* Handles both x and y scrolls in one container */
  background: var(--bg-primary);
  border: 1px solid var(--border-weak);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  position: relative;
}
.drm-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  min-width: 1000px; /* Force minimum width for small screens */
}

/* Fixed Column Widths */
.col-check { width: 44px; }
.col-group { width: 110px; }
.col-name { width: auto; min-width: 180px; }
.col-model { width: 130px; }
.col-ip { width: 110px; }
.col-mac { width: 150px; }
.col-vendor { width: 100px; }
.col-actions { width: 66px; }

/* 2-Line Name Clamping */
.drm-device-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  max-height: 2.8em; /* Exactly 2 lines */
  text-align: center;
  word-break: break-all;
  font-weight: 600;
  color: var(--text-primary);
}

/* Card-like Sections */
.drm-section-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-weak);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ... existing form styles preserved for use in the new modal ... */
.drm-form-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.drm-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 32px;
}
.drm-field-full {
  grid-column: span 2;
}
.drm-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.drm-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
}
.drm-field label .drm-required {
  color: var(--severity-critical);
  margin-left: 4px;
}
.drm-field input,
.drm-field select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 14px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  transition: all 0.2s;
}
.drm-field .drm-error-hint {
  font-size: 11px;
  color: var(--severity-critical);
  margin-top: 4px;
  font-weight: 500;
}
.drm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.drm-submit-btn {
  height: 42px;
  padding: 0 24px;
  background: linear-gradient(135deg, #4f83fd, #2c52c0);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(79, 131, 253, 0.35);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Node Picker Styles */
.drm-node-picker {
  position: relative;
  width: 100%;
}
.drm-node-picker-trigger {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 14px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.drm-node-picker-trigger:hover {
  background: var(--bg-secondary);
  border-color: var(--theme-primary);
}
.drm-node-picker-trigger.open {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 4px rgba(110, 159, 255, 0.1);
  background: var(--bg-primary);
}
.drm-node-picker-trigger .chevron {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform 0.2s;
}
.drm-node-picker-trigger.open .chevron {
  transform: rotate(180deg);
}
.drm-node-picker-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--modal-bg);
  border: 1px solid var(--border-medium);
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
  z-index: 2200;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: drm-pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.drm-node-picker-search {
  padding: 12px;
  border-bottom: 1px solid var(--border-weak);
  background: var(--bg-secondary);
}
.drm-node-picker-search input {
  width: 100%;
  height: 32px;
  padding: 0 10px 0 30px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 12px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  outline: none;
}
.drm-node-picker-search .search-icon {
  position: absolute;
  left: 22px;
  top: 21px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.drm-node-picker-tree {
  max-height: 280px;
  overflow-y: auto;
  padding: 8px 0;
}
.drm-node-picker-tree .drm-tree-node {
  border-left: none;
  padding-right: 12px;
  margin: 0 4px;
  border-radius: 6px;
}
.drm-node-picker-tree .drm-tree-node.selected {
  background: var(--theme-primary);
  color: white;
}
.drm-node-picker-tree .drm-tree-node.selected .drm-tree-node-count {
  background: rgba(255,255,255,0.2);
  color: white;
}
.drm-node-picker-tree .drm-tree-node.selected .drm-tree-node-toggle {
  color: rgba(255,255,255,0.7);
}

/* Table Refinement */
.drm-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-weak);
  font-size: 12px;
  vertical-align: middle;
  height: 52px; /* Force consistent row height for 2-line names */
}
.drm-table th {
  padding: 10px 12px;
  background: var(--bg-tertiary);
  font-size: 11px;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: inset 0 -1px 0 var(--border-weak);
}
.drm-table tr:hover {
  background: rgba(110, 159, 255, 0.05);
}

.drm-badge {
  padding: 3px 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-weak);
}
.drm-badge.highlight {
  background: rgba(110, 159, 255, 0.15);
  color: var(--theme-primary);
  border-color: rgba(110, 159, 255, 0.3);
}
/* --- New Structured Header & Toolbar --- */
.drm-table-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  flex-shrink: 0;
}
.drm-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.drm-metadata-cluster {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drm-metadata-cluster .drm-form-title {
  margin-bottom: 0;
  font-size: 18px;
}
.drm-action-cluster {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Button Hierarchy */
.drm-btn-primary {
  height: 38px;
  padding: 0 20px;
  background: linear-gradient(135deg, #4f83fd, #2c52c0);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(79, 131, 253, 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.drm-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(79, 131, 253, 0.45);
  filter: brightness(1.1);
}
.drm-btn-primary:active {
  transform: translateY(0);
}

.drm-btn-secondary {
  height: 38px;
  padding: 0 16px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.drm-btn-secondary:hover {
  background: var(--bg-secondary);
  border-color: var(--theme-primary);
  color: var(--theme-primary);
}

/* Search Row */
.drm-search-container {
  max-width: 500px;
  width: 100%;
}

/* Spacing Refinement */
.drm-section-card {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* Empty State centering */
.drm-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-tertiary);
}
.drm-search-wrap {
  flex: 1;
  position: relative;
}
.drm-search-input {
  width: 100%;
  height: 38px;
  padding: 0 12px 0 40px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 13px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transition: all 0.2s ease;
}
.drm-search-input:focus {
  background: var(--bg-primary);
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 4px rgba(110, 159, 255, 0.1);
  outline: none;
}
.drm-search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--text-tertiary);
  pointer-events: none;
}
.drm-group-filter {
  height: 38px;
  padding: 0 36px 0 16px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 13px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}
.drm-group-filter:focus {
  outline: none;
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 4px rgba(110, 159, 255, 0.1);
  background-color: var(--bg-primary);
}

.drm-table-container {
  border: 1px solid var(--border-weak);
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg-primary);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
.drm-table-scroll {
  max-height: 420px;
  overflow-y: auto;
}
.drm-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.drm-table th {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 16px;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--border-weak);
  /* Removed backdrop-filter to prevent CSS stacking context bugs with fixed modal overlays */
}
.drm-table td {
  padding: 4px 12px;
  border-bottom: 1px solid var(--border-weak);
  color: var(--text-primary);
  font-size: 12px;
  vertical-align: middle;
  text-align: center;
  line-height: 1.4;
}
.drm-table tr:last-child td {
  border-bottom: none;
}
.drm-table tr {
  transition: background 0.15s;
}
.drm-table tr:hover {
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
}
/* Checkbox styling */
.drm-table th input[type="checkbox"],
.drm-table td input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--theme-primary);
}

.drm-group-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.drm-group-tag.group-gwacheon {
  background: var(--tag-gwacheon-bg);
  color: var(--tag-gwacheon);
  border: 1px solid var(--tag-gwacheon-bg);
}
.drm-group-tag.group-daejeon {
  background: var(--tag-daejeon-bg);
  color: var(--tag-daejeon);
  border: 1px solid var(--tag-daejeon-bg);
}

.drm-vendor-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-weak);
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.drm-delete-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 100, 100, 0.05);
  border: 1px solid rgba(255, 100, 100, 0.2);
  color: var(--severity-critical);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
}
.drm-delete-btn:hover {
  background: var(--severity-critical);
  color: white;
  border-color: var(--severity-critical);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 60, 60, 0.3);
}
.drm-edit-btn {
  width: 36px;
  height: 36px;
  background: rgba(110, 159, 255, 0.05);
  border: 1px solid rgba(110, 159, 255, 0.2);
  color: var(--theme-primary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
}
.drm-edit-btn:hover {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(110, 159, 255, 0.3);
}

/* Toast notification (Centered Illustration) */
.drm-toast-wrapper {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  pointer-events: none; /* Let clicks pass through if needed, though they shouldn't with standard alerts */
  animation: drm-toast-fade-in 0.3s ease-out;
}
@keyframes drm-toast-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drm-toast {
  pointer-events: auto; /* Re-enable pointer events for the toast itself */
  background: var(--modal-bg);
  border: 1px solid var(--border-medium);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg); 
  width: 320px;
  max-width: 90vw;
  box-shadow: var(--elevation-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  animation: drm-toast-zoom-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  transition: all 0.3s ease;
  position: relative;
}

.drm-toast.compact {
  padding: 24px 32px;
  width: auto;
  min-width: 280px;
  border-radius: 20px;
  gap: 12px;
}
@keyframes drm-toast-zoom-in {
  from { transform: scale(0.9) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.drm-toast-image {
  width: 120px;
  height: 120px;
  object-fit: contain;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.1));
}

.drm-toast-content h3 {
  font-size: 20px;
  font-weight: 800;
  color: #1a1b1e;
  margin: 0 0 10px 0;
  letter-spacing: -0.02em;
}
.drm-toast-content p {
  font-size: 14px;
  font-weight: 500;
  color: #5c5f66;
  margin: 0;
  line-height: 1.5;
}

.drm-toast-success {
}
.drm-toast-error {
}

/* Delete confirm popover */
.drm-confirm-popover {
  position: fixed;
  z-index: 1501;
  background: var(--modal-bg);
  border: 1px solid var(--border-medium);
  border-radius: 20px;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05);
  padding: 24px;
  width: 320px;
  animation: drm-pop-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes drm-pop-in {
  from { transform: scale(0.9) translateY(10px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.drm-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: transparent;
}
.drm-confirm-popover p {
  margin: 0 0 16px 0;
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.5;
}
.drm-confirm-popover .drm-placement-warn {
  font-size: 13px;
  color: var(--severity-major-text);
  background: var(--severity-major-bg);
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 20px;
  border-left: 3px solid var(--severity-major);
}
.drm-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.drm-confirm-actions button {
  height: 38px;
  border-radius: 10px;
  font-weight: 600;
}
`;

interface ToastState {
  message: string;
  type: "success" | "error";
  action?: "export" | "import" | "add" | "delete";
}

interface DeleteConfirm {
  id: string;
  deviceName: string;
  placedCount: number;
  rect: DOMRect;
}

const TreeNodeItem = ({
  node,
  depth,
  nodes,
  selectedNodeId,
  expandedIds,
  nodeSearch,
  registeredDevices,
  onToggle,
  onSelect,
}: {
  node: HierarchyNode;
  depth: number;
  nodes: HierarchyNode[];
  selectedNodeId: string;
  expandedIds: Set<string>;
  nodeSearch: string;
  registeredDevices: any[];
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) => {
  const children = getChildren(nodes, node.nodeId);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.nodeId);
  const isSelected = selectedNodeId === node.nodeId;
  const count = getSubtreeEquipmentCount(nodes, registeredDevices, node.nodeId);

  const isMatch =
    nodeSearch && node.name.toLowerCase().includes(nodeSearch.toLowerCase());

  return (
    <>
      <div
        className={`drm-tree-node ${isSelected ? "selected" : ""} ${isMatch ? "match" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node.nodeId)}
      >
        <span
          className={`drm-tree-node-toggle ${isExpanded ? "expanded" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.nodeId);
          }}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          ▶
        </span>
        <span className="drm-tree-node-icon">
          {node.type === "root"
            ? "🏢"
            : node.type === "group"
              ? "📦"
              : node.type === "site"
                ? "📍"
                : "📁"}
        </span>
        <span className="drm-tree-node-name">{node.name}</span>
        {count > 0 && <span className="drm-tree-node-count">{count}</span>}
      </div>
      {isExpanded &&
        children.map((child) => (
          <TreeNodeItem
            key={child.nodeId}
            node={child}
            depth={depth + 1}
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            expandedIds={expandedIds}
            nodeSearch={nodeSearch}
            registeredDevices={registeredDevices}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
};

// --- Custom Hierarchical Node Picker Component ---
const NodePicker = ({
  nodes,
  selectedNodeId,
  registeredDevices,
  onSelect,
}: {
  nodes: HierarchyNode[];
  selectedNodeId: string;
  registeredDevices: any[];
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedNodeName = useMemo(() => {
    if (!selectedNodeId) return "선택하세요";
    return getNodeName(nodes, selectedNodeId);
  }, [nodes, selectedNodeId]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Expand parents if searching or if selected
  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const toExpand = new Set<string>();
      nodes.forEach((n) => {
        if (n.name.toLowerCase().includes(q)) {
          let curr = n;
          while (curr.parentId) {
            toExpand.add(curr.parentId);
            const parent = nodes.find((p) => p.nodeId === curr.parentId);
            if (!parent) break;
            curr = parent;
          }
        }
      });
      if (toExpand.size > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          toExpand.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [search, nodes]);

  // Expand ancestors of selected node on open
  useEffect(() => {
    if (isOpen && selectedNodeId) {
      const path = getAncestorPath(nodes, selectedNodeId);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        path.forEach((n) => next.add(n.nodeId));
        return next;
      });
    }
  }, [isOpen, selectedNodeId, nodes]);

  return (
    <div className="drm-node-picker" ref={pickerRef}>
      <div
        className={`drm-node-picker-trigger ${isOpen ? "open" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <span>{selectedNodeName}</span>
        <span className="chevron">▼</span>
      </div>

      {isOpen && (
        <div className="drm-node-picker-popover" onClick={(e) => e.stopPropagation()}>
          <div className="drm-node-picker-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="노드 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="drm-node-picker-tree">
            {nodes
              .filter((n) => n.parentId === null)
              .map((root) => (
                <TreeNodeItem
                  key={root.nodeId}
                  node={root}
                  depth={0}
                  nodes={nodes}
                  selectedNodeId={selectedNodeId}
                  expandedIds={expandedIds}
                  nodeSearch={search}
                  registeredDevices={registeredDevices}
                  onToggle={(id) =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onSelect={(id) => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Registration Form Modal (Separate Overlay) ---
const RegistrationFormModal = ({
  isOpen,
  onClose,
  editingDeviceId,
  activeNodeId,
  nodes,
  registeredDevices,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingDeviceId: string | null;
  activeNodeId: string;
  nodes: HierarchyNode[];
  registeredDevices: any[];
  onSuccess: (deviceName: string, isEdit: boolean) => void;
}) => {
  const addRegisteredDevice = useStore((s) => s.addRegisteredDevice);
  const updateRegisteredDevice = useStore((s) => s.updateRegisteredDevice);

  // Form state
  const [nodeId, setNodeId] = useState<string>(activeNodeId || "");
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [deviceName, setDeviceName] = useState("");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [vendor, setVendor] = useState<VendorName>("Nokia");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTemplate = DEVICE_TEMPLATES[selectedModelIdx];

  useEffect(() => {
    if (isOpen) {
      if (editingDeviceId) {
        const device = registeredDevices.find((d) => d.id === editingDeviceId);
        if (device) {
          setNodeId(device.nodeId);
          const idx = DEVICE_TEMPLATES.findIndex(
            (t) => t.modelName === device.modelName,
          );
          if (idx >= 0) setSelectedModelIdx(idx);
          setDeviceName(device.deviceName);
          setIp(device.ip);
          setMac(device.mac);
          setVendor(device.vendor);
        }
      } else {
        setNodeId(activeNodeId || "");
        setDeviceName("");
        setIp("");
        setMac("");
        setErrors({});
      }
    }
  }, [isOpen, editingDeviceId, activeNodeId, registeredDevices]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!deviceName.trim()) newErrors.deviceName = "필수 입력";
    if (!nodeId || nodeId === "") newErrors.nodeId = "위치를 선택하세요";
    if (!ip.trim()) newErrors.ip = "필수 입력";
    else if (!isValidIP(ip.trim())) newErrors.ip = "형식: X.X.X.X";
    if (!mac.trim()) newErrors.mac = "필수 입력";
    else if (!isValidMAC(mac.trim())) newErrors.mac = "형식: XX:XX:XX:XX:XX:XX";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const macTrimmed = mac.trim().toUpperCase();
    const existing = registeredDevices.find(
      (d) => d.mac === macTrimmed && d.id !== editingDeviceId,
    );
    if (existing) {
      setErrors((prev) => ({ ...prev, mac: "이미 존재하는 MAC입니다." }));
      return;
    }

    const payload = {
      nodeId: nodeId,
      deviceName: deviceName.trim(),
      modelName: selectedTemplate.modelName,
      type: selectedTemplate.type,
      uSize: selectedTemplate.uSize,
      ip: ip.trim(),
      mac: macTrimmed,
      vendor,
    };

    if (editingDeviceId) {
      updateRegisteredDevice(editingDeviceId, payload);
      onSuccess(deviceName.trim(), true);
    } else {
      addRegisteredDevice(payload);
      onSuccess(deviceName.trim(), false);
    }
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="drm-reg-modal-overlay" onClick={onClose}>
      <div className="drm-reg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drm-form-title">
          <span className="icon">{editingDeviceId ? "✏️" : "➕"}</span>{" "}
          {editingDeviceId ? "장비 정보 수정" : "새 장비 등록"}
        </div>

        <div className="drm-form-grid">
          <div className="drm-field">
            <label>
              위치<span className="drm-required">*</span>
            </label>
            <NodePicker
              nodes={nodes}
              selectedNodeId={nodeId}
              registeredDevices={registeredDevices}
              onSelect={(id) => setNodeId(id)}
            />
            {errors.nodeId && (
              <span className="drm-error-hint">{errors.nodeId}</span>
            )}
          </div>

          <div className="drm-field">
            <label>
              모델<span className="drm-required">*</span>
            </label>
            <select
              value={selectedModelIdx}
              onChange={(e) => setSelectedModelIdx(parseInt(e.target.value))}
            >
              {DEVICE_TEMPLATES.map((t, i) => (
                <option key={i} value={i}>
                  [{t.uSize}U] {t.modelName}
                </option>
              ))}
            </select>
          </div>

          <div className="drm-field">
            <label>
              장비명<span className="drm-required">*</span>
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="장비 이름 입력"
            />
            {errors.deviceName && (
              <span className="drm-error-hint">{errors.deviceName}</span>
            )}
          </div>

          <div className="drm-field">
            <label>
              IP<span className="drm-required">*</span>
            </label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="10.0.0.1"
            />
            {errors.ip && <span className="drm-error-hint">{errors.ip}</span>}
          </div>

          <div className="drm-field">
            <label>
              MAC<span className="drm-required">*</span>
            </label>
            <input
              type="text"
              value={mac}
              onChange={(e) => setMac(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
            />
            {errors.mac && <span className="drm-error-hint">{errors.mac}</span>}
          </div>

          <div className="drm-field">
            <label>
              벤더<span className="drm-required">*</span>
            </label>
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value as VendorName)}
            >
              {VENDORS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="drm-form-actions">
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={onClose}
            style={{ height: "42px", borderRadius: "12px", padding: "0 24px" }}
          >
            취소
          </button>
          <button className="drm-submit-btn" onClick={handleSubmit}>
            <span>{editingDeviceId ? "💾" : "✨"}</span>{" "}
            {editingDeviceId ? "저장하기" : "등록하기"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const ModalStyles = React.memo(() => <style>{MODAL_STYLES}</style>);

export const DeviceRegistrationModal = () => {
  const isOpen = useStore((s) => s.deviceRegistrationModalOpen);
  const setOpen = useStore((s) => s.setDeviceRegistrationModalOpen);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const racks = useStore((s) => s.racks);
  const removeRegisteredDevice = useStore((s) => s.removeRegisteredDevice);
  const upsertRegisteredDevices = useStore((s) => s.upsertRegisteredDevices);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const nodes = useStore((s) => s.nodes);
  const locateDevice = useStore((s) => s.locateDevice);

  // Table state
  const [search, setSearch] = useState("");
  // Table filter state
  const [nodeFilter, setNodeFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(
    null,
  );

  // New Redesign States
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeExpandedIds, setNodeExpandedIds] = useState<Set<string>>(
    new Set(),
  );

  // Redesign: Expand parents if searching or if activeNodeId exists
  useEffect(() => {
    if (nodeSearch.trim()) {
      const q = nodeSearch.toLowerCase();
      const toExpand = new Set<string>();

      nodes.forEach((n) => {
        if (n.name.toLowerCase().includes(q)) {
          let curr = n;
          while (curr.parentId) {
            toExpand.add(curr.parentId);
            const parent = nodes.find((p) => p.nodeId === curr.parentId);
            if (!parent) break;
            curr = parent;
          }
        }
      });

      if (toExpand.size > 0) {
        setNodeExpandedIds((prev) => {
          const next = new Set(prev);
          toExpand.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [nodeSearch, nodes]);

  // Expand parents of active node when opening
  useEffect(() => {
    if (isOpen && activeNodeId) {
      const path = getAncestorPath(nodes, activeNodeId);
      setNodeExpandedIds((prev) => {
        const next = new Set(prev);
        path.forEach((n) => next.add(n.nodeId));
        return next;
      });
    }
  }, [isOpen, activeNodeId, nodes]);

  // Sync state when modal opens ONLY (don't reset on nodes change during session)
  useEffect(() => {
    if (isOpen) {
      if (activeNodeId) {
        setNodeFilter(activeNodeId);
      } else {
        const root = nodes.find((n) => n.parentId === null);
        if (root) setNodeFilter(root.nodeId);
      }
      // Reset selection when modal opens
      setSelectedIds(new Set());
      // Redesign: Close registration modal by default
      setIsRegistrationModalOpen(false);
      setEditingDeviceId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Filtered list — respects nodeFilter selection
  const filteredDevices = useMemo(() => {
    let list = registeredDevices;
    if (nodeFilter !== "all" && nodeFilter !== "") {
      const descendantIds = getSubtreeNodeIds(nodes, nodeFilter);
      list = list.filter((d) => descendantIds.has(d.nodeId));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          (d.deviceName || "").toLowerCase().includes(q) ||
          d.modelName.toLowerCase().includes(q) ||
          d.ip.toLowerCase().includes(q) ||
          d.mac.toLowerCase().includes(q) ||
          d.vendor.toLowerCase().includes(q),
      );
    }
    return list;
  }, [registeredDevices, nodeFilter, search]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showToast = (
    message: string,
    type: "success" | "error",
    action?: ToastState["action"],
  ) => {
    setToast({ message, type, action });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditClick = (device: (typeof registeredDevices)[0]) => {
    setEditingDeviceId(device.id);
    setIsRegistrationModalOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredDevices.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isAllSelected =
    filteredDevices.length > 0 &&
    filteredDevices.every((d) => selectedIds.has(d.id));

  const handleImportExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("[DRM] Batch Import button clicked");
    if (fileInputRef.current) {
      console.log("[DRM] File input ref exists, triggering click");
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    } else {
      console.error("[DRM] File input ref is null!");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("[DRM] File input onChange fired", file?.name);
    if (!file) return;
    setIsProcessing(true);
    try {
      const { devices: parsed, newNodes } =
        await parseRegisteredDevicesFromExcel(file, nodes);
      if (parsed.length === 0) {
        showToast(
          "파일에서 유효한 장비를 찾을 수 없습니다.",
          "error",
          "import",
        );
        return;
      }

      // If there are new nodes in the path, upsert them first and apply mapping
      if (newNodes.length > 0) {
        const idMap = useStore.getState().upsertNodes(newNodes, false);
        parsed.forEach((d) => {
          if (idMap[d.nodeId]) {
            d.nodeId = idMap[d.nodeId];
          }
        });
      }

      const { added, updated } = upsertRegisteredDevices(parsed);
      showToast(
        `일괄 등록 완료! (신규: ${added}건, 갱신: ${updated}건${newNodes.length > 0 ? `, 신규 노드: ${newNodes.length}개` : ""})`,
        "success",
        "import",
      );
    } catch (err: any) {
      console.error(err);
      showToast(`일괄 등록 실패: ${err.message}`, "error", "import");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportExcel = () => {
    if (selectedIds.size === 0) {
      showToast("내보낼 장비를 선택하세요.", "error", "export");
      return;
    }
    const selectedDevices = registeredDevices.filter((d) =>
      selectedIds.has(d.id),
    );
    const scope = nodeFilter === "all" ? "ALL" : getNodeName(nodes, nodeFilter);
    exportRegisteredDevicesToExcel(selectedDevices, nodes, scope);
    showToast("선택한 장비 데이터가 내보내졌습니다.", "success", "export");
  };

  const handleRegistrationSuccess = (deviceName: string, isEdit: boolean) => {
    showToast(
      `장비 "${deviceName}" 정보가 ${isEdit ? "수정" : "등록"}되었습니다.`,
      "success",
      "add",
    );
    setIsRegistrationModalOpen(false);
    setEditingDeviceId(null);
  };

  const handleDeleteClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    device: (typeof registeredDevices)[0],
  ) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    // Count how many placed devices reference this registered device
    let placedCount = 0;
    for (const rack of racks) {
      placedCount += rack.devices.filter(
        (d) => d.registeredDeviceId === device.id,
      ).length;
    }
    setDeleteConfirm({
      id: device.id,
      deviceName: device.deviceName || device.modelName,
      placedCount,
      rect,
    });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    removeRegisteredDevice(deleteConfirm.id);
    showToast(
      `장비 "${deleteConfirm.deviceName}" 이(가) 삭제되었습니다.`,
      "success",
      "delete",
    );
    setDeleteConfirm(null);
  };

  const handleLocateDevice = (device: (typeof registeredDevices)[0]) => {
    const found = locateDevice(device.id);
    if (!found) {
      showToast("해당 장비는 랙에 탑재되어 있지 않습니다.", "error");
    } else {
      // Sync modal filter if navigation happened
      const newActiveId = useStore.getState().activeNodeId;
      if (newActiveId) {
        setNodeFilter(newActiveId);
        // Clear selection to avoid confusion
        setSelectedIds(new Set());
      }
    }
  };

  return (
    <>
      <ModalStyles />

      {/* Delete confirmation popover */}
      {deleteConfirm &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="drm-confirm-overlay"
              onClick={() => setDeleteConfirm(null)}
            />
            <div
              className="drm-confirm-popover"
              style={{
                top: Math.min(
                  deleteConfirm.rect.bottom + 8,
                  window.innerHeight - 200,
                ),
                left: Math.min(
                  deleteConfirm.rect.left,
                  window.innerWidth - 300,
                ),
              }}
            >
              <p>
                <strong>"{deleteConfirm.deviceName}"</strong>을(를)
                삭제하시겠습니까?
              </p>
              {deleteConfirm.placedCount > 0 && (
                <div className="drm-placement-warn">
                  ⚠️ 이 장비는 현재 {deleteConfirm.placedCount}개 랙 슬롯에
                  배치되어 있습니다. 삭제하면 함께 제거됩니다.
                </div>
              )}
              <div className="drm-confirm-actions">
                <button
                  className="grafana-btn grafana-btn-secondary"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    padding: "4px 12px",
                  }}
                  onClick={() => setDeleteConfirm(null)}
                >
                  취소
                </button>
                <button
                  className="grafana-btn grafana-btn-destructive"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    padding: "4px 12px",
                  }}
                  onClick={confirmDelete}
                >
                  삭제
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}

      {/* Modal */}
      {createPortal(
        <div className="drm-overlay" onClick={() => setOpen(false)}>
          <div className="drm-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="drm-header">
              <h2>
                <div className="icon-wrap">📋</div>
                장비
              </h2>
              <button
                className="drm-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="drm-body">
              {/* Left Sidebar: Node Hierarchy */}
              <div className="drm-sidebar">
                <div className="drm-sidebar-header">
                  <div className="drm-sidebar-search-wrap">
                    <span className="drm-sidebar-search-icon">🔍</span>
                    <input
                      type="text"
                      className="drm-sidebar-search"
                      placeholder="노드 검색..."
                      value={nodeSearch}
                      onChange={(e) => setNodeSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="drm-sidebar-content">
                  {nodes
                    .filter((n) => n.parentId === null)
                    .map((root) => (
                      <TreeNodeItem
                        key={root.nodeId}
                        node={root}
                        depth={0}
                        nodes={nodes}
                        selectedNodeId={nodeFilter}
                        expandedIds={nodeExpandedIds}
                        nodeSearch={nodeSearch}
                        registeredDevices={registeredDevices}
                        onToggle={(id) =>
                          setNodeExpandedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          })
                        }
                        onSelect={(id) => {
                          setNodeFilter(id);
                          setSelectedIds(new Set());
                        }}
                      />
                    ))}
                </div>
              </div>

              {/* Right Content: Equipment List */}
              <div className="drm-content">
                <RegistrationFormModal
                  isOpen={isRegistrationModalOpen}
                  onClose={() => {
                    setIsRegistrationModalOpen(false);
                    setEditingDeviceId(null);
                  }}
                  editingDeviceId={editingDeviceId}
                  activeNodeId={
                    (nodeFilter !== "all" ? nodeFilter : activeNodeId) || ""
                  }
                  nodes={nodes}
                  registeredDevices={registeredDevices}
                  onSuccess={handleRegistrationSuccess}
                />

                {/* Device Table */}
                <div className="drm-section-card" style={{ flex: 1 }}>
                  <div className="drm-table-header">
                    {/* First Row: Metadata & Actions */}
                    <div className="drm-header-row">
                      <div className="drm-metadata-cluster">
                        <div className="drm-form-title">
                          <span className="icon">📦</span> 등록 장비 목록
                        </div>
                        <div className="drm-badge highlight">
                          {getNodeName(nodes, nodeFilter)}
                        </div>
                        <div className="drm-badge">
                          {filteredDevices.length}건
                        </div>
                        {selectedIds.size > 0 && (
                          <div className="drm-badge highlight">
                            {selectedIds.size}개 선택됨
                          </div>
                        )}
                      </div>

                      <div className="drm-action-cluster">
                        <input
                          type="file"
                          accept=".xlsx"
                          ref={fileInputRef}
                          style={{ display: "none" }}
                          onChange={handleFileChange}
                        />
                        <button
                          className="drm-btn-primary"
                          onClick={() => {
                            setEditingDeviceId(null);
                            setIsRegistrationModalOpen(true);
                          }}
                        >
                          <span>➕</span> 새 장비 등록
                        </button>
                        <button
                          className="drm-btn-secondary"
                          onClick={handleExportExcel}
                        >
                          <span>📥</span> 내보내기
                        </button>
                        <button
                          className="drm-btn-secondary"
                          onClick={handleImportExcel}
                        >
                          <span>📤</span> 일괄 등록
                        </button>
                      </div>
                    </div>

                    {/* Second Row: Search */}
                    <div className="drm-header-row">
                      <div className="drm-search-container">
                        <div className="drm-search-wrap">
                          <span className="drm-search-icon">🔍</span>
                          <input
                            className="drm-search-input"
                            type="text"
                            placeholder="목록에서 검색 (장비명, 모델명, IP, MAC, 벤더)"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="drm-table-content">
                    {filteredDevices.length > 0 ? (
                      <table className="drm-table">
                        <thead>
                          <tr>
                            <th className="col-check">
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleSelectAll(e.target.checked);
                                }}
                              />
                            </th>
                            <th className="col-group">그룹</th>
                            <th className="col-name">장비명</th>
                            <th className="col-model">모델명</th>
                            <th className="col-ip">IP 주소</th>
                            <th className="col-mac">MAC 주소</th>
                            <th className="col-vendor">벤더</th>
                            <th className="col-actions">수정</th>
                            <th className="col-actions">삭제</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDevices.map((device) => (
                            <tr
                              key={device.id}
                              onClick={() => handleLocateDevice(device)}
                            >
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(device.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleSelectRow(
                                      device.id,
                                      e.target.checked,
                                    );
                                  }}
                                />
                              </td>
                              <td>
                                <span className="drm-group-tag group-gwacheon">
                                  {getNodeName(nodes, device.nodeId)}
                                </span>
                              </td>
                              <td>
                                <div className="drm-device-name">
                                  {device.deviceName || device.modelName}
                                </div>
                              </td>
                              <td>{device.modelName}</td>
                              <td
                                style={{
                                  fontFamily: "var(--font-family-mono)",
                                  fontSize: "12px",
                                }}
                              >
                                {device.ip}
                              </td>
                              <td
                                style={{
                                  fontFamily: "var(--font-family-mono)",
                                  fontSize: "12px",
                                }}
                              >
                                {device.mac}
                              </td>
                              <td>
                                <span className="drm-vendor-tag">
                                  {device.vendor}
                                </span>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  className="drm-edit-btn"
                                  title="수정"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(device);
                                  }}
                                >
                                  ✏️
                                </button>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  className="drm-delete-btn"
                                  title="삭제"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(e, device);
                                  }}
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="drm-empty-state">
                        <div style={{ fontSize: "40px", marginBottom: "16px" }}>
                          Empty
                        </div>
                        {search
                          ? "검색 결과가 없습니다."
                          : "등록된 장비가 없습니다."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Processing Overlay */}
      {isProcessing &&
        createPortal(
          <div
            className="drm-overlay"
            style={{ zIndex: 3000, background: "rgba(0,0,0,0.7)" }}
          >
            <div className="drm-toast" style={{ padding: "40px" }}>
              <div
                style={{
                  fontSize: "40px",
                  marginBottom: "16px",
                  animation: "spin 2s linear infinite",
                }}
              >
                ⏳
              </div>
              <h3 style={{ margin: 0 }}>일괄 등록 처리 중...</h3>
              <p style={{ marginTop: "8px", opacity: 0.7 }}>
                잠시만 기다려 주세요.
              </p>
            </div>
          </div>,
          document.body,
        )}

      {/* Toast (Centered Popup) - Rendered last to fix backdrop-filter stacking context bug */}
      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="drm-toast-wrapper" onClick={() => setToast(null)}>
            <div
              className={`drm-toast ${toast.type === "success" ? "drm-toast-success" : "drm-toast-error"} ${toast.action === "add" || toast.action === "delete" ? "compact" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              {toast.action !== "add" && toast.action !== "delete" && (
                <img
                  src={
                    toast.action === "export"
                      ? toast.type === "success"
                        ? "/assets/export_success.png"
                        : "/assets/export_error.png"
                      : toast.action === "import"
                        ? toast.type === "success"
                          ? "/assets/import_success.png"
                          : "/assets/import_error.png"
                        : toast.type === "success"
                          ? "/assets/success_popup.png"
                          : "/assets/error_popup.png"
                  }
                  alt="status illustration"
                  className="drm-toast-image"
                />
              )}
              <div className="drm-toast-content">
                <h3>
                  {toast.type === "success"
                    ? toast.action === "export"
                      ? "내보내기 완료"
                      : toast.action === "import"
                        ? "가져오기 완료"
                        : toast.action === "add"
                          ? "등록 성공"
                          : toast.action === "delete"
                            ? "삭제 완료"
                            : "완료되었습니다"
                    : toast.action === "export"
                      ? "내보내기 실패"
                      : toast.action === "import"
                        ? "가져오기 실패"
                        : "확인이 필요합니다"}
                </h3>
                <p>{toast.message}</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
