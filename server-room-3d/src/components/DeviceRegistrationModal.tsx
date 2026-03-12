import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import { DEVICE_TEMPLATES } from "../utils/deviceTemplates";
import type { VendorName } from "../types";
import {
  exportRegisteredDevicesToExcel,
  parseRegisteredDevicesFromExcel,
} from "../utils/storage";
import { getNodeName } from "../utils/nodeUtils";

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
  z-index: 1000;
  animation: drm-fade-in 0.25s ease-out;
}
@keyframes drm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.drm-modal {
  background: var(--modal-bg);
  border: 1px solid var(--border-medium);
  border-radius: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
  width: 1000px;
  max-width: 95vw;
  max-height: 85vh;
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
  padding: 16px 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
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
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Card-like Sections */
.drm-section-card {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid var(--border-weak);
  border-radius: 20px;
  padding: 20px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
}

/* Form section */
.drm-form-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.drm-form-title .icon {
  font-size: 20px;
}
.drm-form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.drm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.drm-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}
.drm-field label .drm-required {
  color: var(--severity-critical);
  margin-left: 4px;
}
.drm-field input,
.drm-field select {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 13px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: inherit;
  transition: all 0.2s ease;
}
.drm-field select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 36px;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}
.drm-field input:focus,
.drm-field select:focus {
  outline: none;
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 4px rgba(110, 159, 255, 0.1);
  background-color: var(--bg-primary);
}
.drm-field .drm-error-hint {
  font-size: 12px;
  color: var(--severity-critical-text);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.drm-form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.drm-submit-btn {
  height: 38px;
  padding: 0 24px;
  background: linear-gradient(135deg, var(--theme-primary), #4872d8);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(110, 159, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;
}
.drm-submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(110, 159, 255, 0.35);
  filter: brightness(1.1);
}

/* Table section */
.drm-table-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.drm-table-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}
.drm-badge {
  padding: 4px 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border-weak);
}
.drm-badge.highlight {
  background: rgba(110, 159, 255, 0.15);
  color: var(--theme-primary);
  border-color: rgba(110, 159, 255, 0.3);
}
.drm-table-actions {
  display: flex;
  gap: 12px;
}
.drm-table-actions .grafana-btn {
  height: 36px;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.drm-table-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
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
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--border-weak);
  /* Removed backdrop-filter to prevent CSS stacking context bugs with fixed modal overlays */
}
.drm-table td {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-weak);
  color: var(--text-primary);
  font-size: 13px;
  vertical-align: middle;
}
.drm-table tr:last-child td {
  border-bottom: none;
}
.drm-table tr {
  transition: background 0.15s;
}
.drm-table tr:hover {
  background: rgba(255, 255, 255, 0.03);
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
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.drm-group-tag.group-gwacheon {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.drm-group-tag.group-daejeon {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.drm-vendor-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-primary);
  border-radius: 8px;
  font-size: 12px;
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
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.6) 0%,
    rgba(255, 255, 255, 0.15) 100%
  );
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.8);
  border-left: 1px solid rgba(255, 255, 255, 0.6);
  padding: 32px 32px;
  border-radius: 36px; 
  width: 320px;
  max-width: 90vw;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.15), 
    inset 0 4px 6px -2px rgba(255, 255, 255, 0.6); 
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

const ModalStyles = React.memo(() => <style>{MODAL_STYLES}</style>);

export const DeviceRegistrationModal = () => {
  const isOpen = useStore((s) => s.deviceRegistrationModalOpen);
  const setOpen = useStore((s) => s.setDeviceRegistrationModalOpen);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const racks = useStore((s) => s.racks);
  const addRegisteredDevice = useStore((s) => s.addRegisteredDevice);
  const removeRegisteredDevice = useStore((s) => s.removeRegisteredDevice);
  const upsertRegisteredDevices = useStore((s) => s.upsertRegisteredDevices);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const nodes = useStore((s) => s.nodes);

  // Form state
  // Form state. Initialize with activeNodeId, later synced by useEffect
  const [nodeId, setNodeId] = useState<string>(activeNodeId);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [deviceName, setDeviceName] = useState("");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [vendor, setVendor] = useState<VendorName>("Nokia");

  // Table state
  const [search, setSearch] = useState("");
  // Table filter state
  const [nodeFilter, setNodeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(
    null,
  );

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNodeId(activeNodeId);
      const activeNode = nodes.find((n) => n.nodeId === activeNodeId);
      // If root/MAIN node (parentId === null), default to "all" devices view
      if (!activeNode || activeNode.parentId === null) {
        setNodeFilter("all");
      } else {
        setNodeFilter(activeNodeId);
      }
    }
  }, [isOpen, activeNodeId, nodes]);

  // Filtered list — respects nodeFilter selection
  const filteredDevices = useMemo(() => {
    let list = registeredDevices;
    if (nodeFilter !== "all") {
      list = list.filter((d) => d.nodeId === nodeFilter);
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

  const selectedTemplate = DEVICE_TEMPLATES[selectedModelIdx];

  const showToast = (
    message: string,
    type: "success" | "error",
    action?: ToastState["action"],
  ) => {
    setToast({ message, type, action });
    setTimeout(() => setToast(null), 3000);
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

  const handleImportExcel = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseRegisteredDevicesFromExcel(file, nodes);
      if (parsed.length === 0) {
        showToast(
          "파일에서 유효한 장비를 찾을 수 없습니다.",
          "error",
          "import",
        );
        return;
      }
      const { added, updated } = upsertRegisteredDevices(parsed);
      showToast(
        `일괄 등록 완료! (신규: ${added}건, 갱신: ${updated}건)`,
        "success",
        "import",
      );
    } catch (err: any) {
      console.error(err);
      showToast(`일괄 등록 실패: ${err.message}`, "error", "import");
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
    const scope = nodeFilter === "all" ? "SELECTED" : getNodeName(nodes, nodeFilter);
    exportRegisteredDevicesToExcel(selectedDevices, nodes, scope);
    showToast("선택한 장비 데이터가 내보내졌습니다.", "success", "export");
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!deviceName.trim()) newErrors.deviceName = "필수 입력";
    if (!ip.trim()) newErrors.ip = "필수 입력";
    else if (!isValidIP(ip.trim())) newErrors.ip = "형식: X.X.X.X";
    if (!mac.trim()) newErrors.mac = "필수 입력";
    else if (!isValidMAC(mac.trim())) newErrors.mac = "형식: XX:XX:XX:XX:XX:XX";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    addRegisteredDevice({
      nodeId: nodeId,
      deviceName: deviceName.trim(),
      modelName: selectedTemplate.modelName,
      type: selectedTemplate.type,
      uSize: selectedTemplate.uSize,
      ip: ip.trim(),
      mac: mac.trim().toUpperCase(),
      vendor,
    });

    showToast(
      `장비 "${deviceName.trim()}" 이(가) 등록되었습니다.`,
      "success",
      "add",
    );
    // Reset form
    setDeviceName("");
    setIp("");
    setMac("");
    setErrors({});
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

  return (
    <>
      <ModalStyles />

      {/* Delete confirmation popover */}
      {deleteConfirm && typeof document !== 'undefined' && createPortal(
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
              left: Math.min(deleteConfirm.rect.left, window.innerWidth - 300),
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
                style={{ fontSize: "var(--font-size-sm)", padding: "4px 12px" }}
                onClick={() => setDeleteConfirm(null)}
              >
                취소
              </button>
              <button
                className="grafana-btn grafana-btn-destructive"
                style={{ fontSize: "var(--font-size-sm)", padding: "4px 12px" }}
                onClick={confirmDelete}
              >
                삭제
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Modal */}
      <div className="drm-overlay" onClick={() => setOpen(false)}>
        <div className="drm-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="drm-header">
            <h2>
              <div className="icon-wrap">📋</div>
              장비 등록
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
            {/* Part A: Registration Form */}
            <div className="drm-section-card">
              <div className="drm-form-title">
                <span className="icon">➕</span> 새 장비 등록
              </div>
              <div className="drm-form-grid">
                {/* Group */}
                <div className="drm-field">
                  <label>
                    위치<span className="drm-required">*</span>
                  </label>
                  <select
                    value={nodeId}
                    onChange={(e) => setNodeId(e.target.value)}
                  >
                    {nodes.filter((n) => n.parentId !== null).map((n) => (
                      <option key={n.nodeId} value={n.nodeId}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model */}
                <div className="drm-field">
                  <label>
                    모델<span className="drm-required">*</span>
                  </label>
                  <select
                    value={selectedModelIdx}
                    onChange={(e) =>
                      setSelectedModelIdx(parseInt(e.target.value))
                    }
                  >
                    {DEVICE_TEMPLATES.map((t, i) => (
                      <option key={i} value={i}>
                        [{t.uSize}U] {t.modelName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Device Name */}
                <div className="drm-field">
                  <label>
                    장비명<span className="drm-required">*</span>
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => {
                      setDeviceName(e.target.value);
                      if (errors.deviceName)
                        setErrors((p) => ({ ...p, deviceName: "" }));
                    }}
                    placeholder="장비 이름 입력"
                  />
                  {errors.deviceName && (
                    <span className="drm-error-hint">{errors.deviceName}</span>
                  )}
                </div>

                {/* IP */}
                <div className="drm-field">
                  <label>
                    IP<span className="drm-required">*</span>
                  </label>
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => {
                      setIp(e.target.value);
                      if (errors.ip) setErrors((p) => ({ ...p, ip: "" }));
                    }}
                    placeholder="10.0.0.1"
                  />
                  {errors.ip && (
                    <span className="drm-error-hint">{errors.ip}</span>
                  )}
                </div>

                {/* MAC */}
                <div className="drm-field">
                  <label>
                    MAC<span className="drm-required">*</span>
                  </label>
                  <input
                    type="text"
                    value={mac}
                    onChange={(e) => {
                      setMac(e.target.value);
                      if (errors.mac) setErrors((p) => ({ ...p, mac: "" }));
                    }}
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                  {errors.mac && (
                    <span className="drm-error-hint">{errors.mac}</span>
                  )}
                </div>

                {/* Vendor */}
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
                <button className="drm-submit-btn" onClick={handleSubmit}>
                  <span>✨</span> 등록하기
                </button>
              </div>
            </div>

            {/* Part B: Device Table */}
            <div className="drm-section-card">
              <div className="drm-table-topbar">
                <div className="drm-table-title-group">
                  <div className="drm-form-title" style={{ marginBottom: 0 }}>
                    <span className="icon">📦</span> 등록 장비 목록
                  </div>
                  <div className="drm-badge">{filteredDevices.length}건</div>
                  {selectedIds.size > 0 && (
                    <div className="drm-badge highlight">
                      {selectedIds.size}개 선택됨
                    </div>
                  )}
                </div>
                <div className="drm-table-actions">
                  <input
                    type="file"
                    accept=".xlsx"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <button
                    className="grafana-btn grafana-btn-secondary"
                    onClick={handleExportExcel}
                  >
                    <span>📥</span> 선택 장비 내보내기
                  </button>
                  <button
                    className="grafana-btn grafana-btn-primary"
                    onClick={handleImportExcel}
                  >
                    <span>📤</span> 일괄 등록 (Excel)
                  </button>
                </div>
              </div>

              <div className="drm-table-filters">
                <div className="drm-search-wrap">
                  <span className="drm-search-icon">🔍</span>
                  <input
                    className="drm-search-input"
                    type="text"
                    placeholder="검색 (장비명, 모델명, IP, MAC, 벤더)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="drm-group-filter"
                  value={nodeFilter}
                  onChange={(e) => setNodeFilter(e.target.value)}
                >
                  <option value="all">전체 노드</option>
                  {nodes.filter((n) => n.parentId !== null).map((n) => (
                    <option key={n.nodeId} value={n.nodeId}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="drm-table-container">
                <div className="drm-table-scroll">
                  {filteredDevices.length > 0 ? (
                    <table className="drm-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40, textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={(e) =>
                                handleSelectAll(e.target.checked)
                              }
                            />
                          </th>
                          <th>그룹</th>
                          <th>장비명</th>
                          <th>모델명</th>
                          <th>IP 주소</th>
                          <th>MAC 주소</th>
                          <th>벤더</th>
                          <th style={{ width: 60, textAlign: "center" }}>
                            삭제
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDevices.map((device) => (
                          <tr key={device.id}>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(device.id)}
                                onChange={(e) =>
                                  handleSelectRow(device.id, e.target.checked)
                                }
                              />
                            </td>
                            <td>
                              <span
                                className="drm-group-tag group-gwacheon"
                              >
                                {getNodeName(nodes, device.nodeId)}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {device.deviceName || device.modelName}
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
                                className="drm-delete-btn"
                                title="삭제"
                                onClick={(e) => handleDeleteClick(e, device)}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        padding: "60px",
                        textAlign: "center",
                        color: "var(--text-tertiary)",
                      }}
                    >
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
      </div>

      {/* Toast (Centered Popup) - Rendered last to fix backdrop-filter stacking context bug */}
      {toast && typeof document !== 'undefined' && createPortal(
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
        document.body
      )}
    </>
  );
};
