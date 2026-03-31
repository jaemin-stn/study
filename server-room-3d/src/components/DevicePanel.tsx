import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore, checkFrontClearanceViolation } from "../store/useStore";
import type { PortState, RegisteredDevice } from "../types";
import { getHighestError } from "../utils/errorHelpers";
import { resolveDeviceImage } from "../utils/deviceAssets";
import { getNodeName } from "../utils/nodeUtils";

/* ---------- Device Tile Image with loading / fallback ---------- */
const DeviceTileImage = ({ src, alt }: { src: string; alt: string }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  return (
    <div className="device-tile-img-wrap">
      {status === "loading" && (
        <div className="device-tile-img-placeholder">
          <span className="device-tile-img-spinner" />
        </div>
      )}
      {status === "error" && (
        <div className="device-tile-img-placeholder">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className="device-tile-img"
        style={{ opacity: status === "loaded" ? 1 : 0 }}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        draggable={false}
      />
    </div>
  );
};

const PANEL_STYLES = `
/* ---------- Device Tile ---------- */
.device-tile {
    position: relative;
    border-radius: var(--radius-sm);
    overflow: hidden;
    cursor: pointer;
    display: flex;
    align-items: stretch;
    transition: box-shadow 0.2s, transform 0.15s;
    margin-bottom: 2px;
}
.device-tile:hover {
    box-shadow: 0 0 0 2px var(--theme-primary), var(--elevation-2);
    z-index: 2;
}

/* Image wrapper */
.device-tile-img-wrap {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
}
.device-tile-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s;
}
.device-tile-img-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
}
@keyframes dt-spin {
    to { transform: rotate(360deg); }
}
.device-tile-img-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-medium);
    border-top-color: var(--theme-primary);
    border-radius: 50%;
    animation: dt-spin 0.7s linear infinite;
}

@keyframes dt-error-pulse {
    0% { box-shadow: 0 0 0 0px var(--severity-critical); }
    50% { box-shadow: 0 0 12px 2px var(--severity-critical-bg); }
    100% { box-shadow: 0 0 0 0px var(--severity-critical); }
}
.device-tile.has-error {
    animation: dt-error-pulse 2s infinite;
    border-color: var(--severity-critical) !important;
    z-index: 1;
}
@keyframes dt-highlight-pulse {
    0% { box-shadow: 0 0 0 0px var(--theme-primary); outline: 2px solid transparent; }
    50% { box-shadow: 0 0 15px 4px var(--selected-bg); outline: 2px solid var(--theme-primary); }
    100% { box-shadow: 0 0 0 0px var(--theme-primary); outline: 2px solid transparent; }
}
.device-tile.is-highlighted {
    animation: dt-highlight-pulse 1.2s ease-in-out infinite;
    z-index: 10;
    border-color: var(--theme-primary) !important;
}

/* Gradient overlay for text legibility */
.device-tile-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.6) 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    z-index: 1;
}
.device-tile-overlay-plain {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    width: 100%;
    z-index: 1;
}

/* Delete button */
.device-tile-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--severity-critical-bg);
    background: var(--severity-critical-bg);
    color: var(--severity-critical-text);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    opacity: 0.6;
}
.device-tile:hover .device-tile-delete {
    opacity: 1;
    background: var(--severity-critical);
    color: #fff;
    border-color: var(--severity-critical);
    transform: scale(1.1);
    box-shadow: var(--elevation-2);
}
.device-tile-delete:active {
    transform: scale(0.9);
}

/* ---------- Add Device Modal ---------- */
.add-device-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
.add-device-modal {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--elevation-3);
    width: 520px;
    max-height: 90vh;
    overflow-y: auto;
}

/* Registered device list in modal */
.reg-device-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border-weak);
    border-radius: var(--radius-md);
}
.reg-device-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--border-weak);
    transition: background 0.15s;
}
.reg-device-item:last-child { border-bottom: none; }
.reg-device-item:hover {
    background: var(--bg-secondary);
}
.reg-device-item.selected {
    background: rgba(var(--theme-primary-rgb, 110, 159, 255), 0.15);
    border-left: 3px solid var(--theme-primary);
}
.reg-device-item-thumb {
    width: 48px;
    height: 32px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
}
.reg-device-item-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.reg-device-item-info {
    flex: 1;
    min-width: 0;
}
.reg-device-item-model {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.reg-device-item-details {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.reg-device-item-badge {
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    font-weight: 500;
}

/* ---------- Confirm Modal ---------- */
.confirm-modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.1s ease-out;
}
.confirm-modal-card {
    background: var(--modal-bg);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-lg);
    box-shadow: var(--elevation-3);
    width: 380px;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: scaleUp 0.15s ease-out;
}
@keyframes scaleUp {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
.confirm-modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
}
.confirm-modal-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--severity-critical-bg);
    color: var(--severity-critical-text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
}
.confirm-modal-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0;
}
.confirm-modal-body {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
}
.confirm-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
}
`;

const PanelStyles = React.memo(() => <style>{PANEL_STYLES}</style>);

export const DevicePanel = () => {
  const {
    racks,
    registeredDevices,
    nodes,
    selectedRackId,
    selectRack,
    addDevice,
    removeDevice,
    selectDevice,
    deleteRack,
    isEditMode,
    updateRackOrientation,
    updateRack,
    highlightedDeviceId,
    setHighlightedDevice,
    focusRack,
    showToast,
  } = useStore();
  const rack = racks.find((r) => r.id === selectedRackId);

  // Rack UI name edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Add-device modal state
  const [addModalSlot, setAddModalSlot] = useState<number | null>(null);
  const [selectedRegDeviceId, setSelectedRegDeviceId] = useState<string | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleteRackModalOpen, setIsDeleteRackModalOpen] = useState(false);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditingName]);

  // Handle ESC key for modal
  useEffect(() => {
    if (!isDeleteRackModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDeleteRackModalOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isDeleteRackModalOpen]);

  const handleNameSubmit = () => {
    if (!rack) return;
    const newName = editNameValue.trim();
    if (newName) {
      updateRack(rack.id, { displayName: newName });
    }
    setIsEditingName(false);
  };

  // Registered devices for this rack's exact node scope
  const groupRegDevices = useMemo(() => {
    if (!rack) return [];
    return registeredDevices.filter((rd) => rd.nodeId === rack.nodeId);
  }, [registeredDevices, rack?.nodeId]);

  // Helper to lookup a registered device by ID
  const findRegDevice = (id?: string): RegisteredDevice | undefined =>
    id ? registeredDevices.find((rd) => rd.id === id) : undefined;

  if (!rack) return null;

  const openAddModal = (slotU: number) => {
    setAddModalSlot(slotU);
    setSelectedRegDeviceId(null);
  };

  const closeAddModal = () => {
    setAddModalSlot(null);
    setSelectedRegDeviceId(null);
  };

  const handleAdd = () => {
    if (addModalSlot === null || !selectedRegDeviceId) return;

    const regDevice = findRegDevice(selectedRegDeviceId);
    if (!regDevice) return;

    const start = addModalSlot;
    const end = start + regDevice.uSize - 1;

    if (start < 1 || end > rack.uHeight) {
      showToast(
        `에러: 장비(${regDevice.uSize}U)가 랙 높이를 초과했습니다.`,
        "error",
      );
      return;
    }

    const collision = rack.devices.find((d) => {
      const dStart = d.uPosition;
      const dEnd = d.uPosition + d.uSize - 1;
      return start <= dEnd && end >= dStart;
    });

    if (collision) {
      showToast(`에러: "${collision.name}" 장비와 겹칩니다.`, "error");
      return;
    }

    const device = {
      type: regDevice.type,
      name: regDevice.deviceName,
      uSize: regDevice.uSize,
      uPosition: start,
      modelName: regDevice.modelName,
      vendor: regDevice.vendor,
      registeredDeviceId: regDevice.id,
      portStates: [] as PortState[],
    };

    const success = addDevice(rack.id, device);
    if (success) {
      closeAddModal();
    } else {
      showToast("장비 추가 실패: 알 수 없는 오류", "error");
    }
  };

  // Device Colors
  const UNIFIED_DEVICE_BG = "var(--bg-tertiary)";
  const UNIFIED_DEVICE_TEXT = "var(--text-primary)";
  const UNIFIED_DEVICE_BORDER = "var(--border-medium)";

  const renderSlots = () => {
    if (!rack) return null;

    const SLOT_HEIGHT = 22;
    const SLOT_MARGIN = 2;
    const TOTAL_SLOT_HEIGHT = SLOT_HEIGHT + SLOT_MARGIN;

    const usedSlots = new Set<number>();
    rack.devices.forEach((d) => {
      for (let i = 0; i < d.uSize; i++) {
        usedSlots.add(d.uPosition + i);
      }
    });

    const rendered = [];
    for (let u = 1; u <= rack.uHeight; u++) {
      const device = rack.devices.find((d) => d.uPosition === u);
      const occupied = usedSlots.has(u);

      if (device) {
        const heightPx = device.uSize * TOTAL_SLOT_HEIGHT - SLOT_MARGIN;
        // Resolve from registered device if available, else fallback
        const regDev = findRegDevice(device.registeredDeviceId);
        const displayName =
          (regDev
            ? regDev.deviceName || regDev.modelName
            : (device.modelName ?? device.name)) || "Device";
        const imageSrc = resolveDeviceImage(
          regDev?.modelName ?? device.modelName,
        );
        const hasImage = !!imageSrc;

        const errorInfo = getHighestError(device.portStates);
        const hasError = errorInfo !== null;
        const highestSeverity = errorInfo?.level ?? null;

        const bg = hasError
          ? `var(--severity-${highestSeverity})`
          : UNIFIED_DEVICE_BG;
        const textColor = hasImage
          ? "#ffffff"
          : hasError
            ? "#ffffff"
            : UNIFIED_DEVICE_TEXT;
        const borderColor = hasError
          ? `var(--severity-${highestSeverity})`
          : UNIFIED_DEVICE_BORDER;

        const isHighlighted = highlightedDeviceId === device.id;

        rendered.push(
          <div
            key={`dev-${u}`}
            className={`device-tile ${hasError ? "has-error" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
            style={{
              height: `${heightPx}px`,
              backgroundColor: bg,
              border: hasError
                ? "2px solid var(--severity-critical)"
                : `1px solid ${borderColor}`,
            }}
            onClick={() => {
              selectDevice(device.id);
              if (selectedRackId) {
                focusRack(selectedRackId);
              }
              setHighlightedDevice(device.id, 2500);
            }}
          >
            {hasImage && <DeviceTileImage src={imageSrc!} alt={displayName} />}

            <div
              className={
                hasImage ? "device-tile-overlay" : "device-tile-overlay-plain"
              }
              style={{
                color: textColor,
                fontWeight: hasError ? 700 : 500,
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  minWidth: 0,
                }}
              >
                {hasError && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: `var(--severity-${highestSeverity})`,
                      boxShadow: `0 0 6px var(--severity-${highestSeverity})`,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayName}
                </span>
                <span
                  style={{
                    opacity: 0.75,
                    fontSize: "var(--font-size-xs)",
                    flexShrink: 0,
                  }}
                >
                  ({device.uSize}U)
                </span>
              </div>

              <button
                className="device-tile-delete"
                aria-label={`Delete device ${displayName}`}
                title="Delete device"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDeleteConfirmId(device.id);
                }}
              >
                ✕
              </button>

              {/* Inline delete confirmation */}
              {deleteConfirmId === device.id && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.82)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    borderRadius: "var(--radius-sm)",
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                    }}
                  >
                    삭제?
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDevice(rack.id, device.id);
                      setDeleteConfirmId(null);
                    }}
                    style={{
                      padding: "4px 14px",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      background: "#e03131",
                      color: "#fff",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(null);
                    }}
                    style={{
                      padding: "4px 14px",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "var(--radius-sm)",
                      background: "transparent",
                      color: "#fff",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          </div>,
        );
      } else if (!occupied) {
        rendered.push(
          <div
            key={`empty-${u}`}
            onClick={() => openAddModal(u)}
            style={{
              height: `${SLOT_HEIGHT}px`,
              borderBottom: "1px solid var(--border-weak)",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              backgroundColor: "var(--severity-success-bg)",
              transition: "background 0.1s",
              marginBottom: "2px",
              borderRadius: "var(--radius-sm)",
            }}
            title="Click to add device at this slot"
          >
            <div
              style={{
                width: "30px",
                textAlign: "center",
                fontSize: "var(--font-size-xs)",
                color: "var(--text-secondary)",
                borderRight: "1px solid var(--border-weak)",
              }}
            >
              {u}
            </div>
            <div
              style={{
                flex: 1,
                paddingLeft: "10px",
                fontSize: "var(--font-size-xs)",
                color: "var(--severity-success-text)",
              }}
            >
              + Available
            </div>
            <div
              style={{
                width: "30px",
                textAlign: "center",
                fontSize: "var(--font-size-xs)",
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-weak)",
              }}
            >
              {u}
            </div>
          </div>,
        );
      }
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-weak)",
          borderRadius: "var(--radius-md)",
          padding: "4px",
          marginTop: "10px",
        }}
      >
        {rendered}
      </div>
    );
  };

  // ─── Add Device Modal ─────────────────────────────────────────────────────
  const renderAddDeviceModal = () => {
    if (addModalSlot === null) return null;

    const selectedRegDevice = findRegDevice(selectedRegDeviceId ?? undefined);

    // Calculate actual contiguous free space starting from addModalSlot
    const usedSlots = new Set<number>();
    rack.devices.forEach((d) => {
      for (let i = 0; i < d.uSize; i++) usedSlots.add(d.uPosition + i);
    });
    let contiguousFreeU = 0;
    for (let u = addModalSlot; u <= rack.uHeight; u++) {
      if (usedSlots.has(u)) break;
      contiguousFreeU++;
    }

    // Check if a device can be placed at this slot
    const canPlace = (uSize: number): boolean => uSize <= contiguousFreeU;

    const modalContent = (
      <div className="add-device-modal-overlay" onClick={closeAddModal}>
        <div className="add-device-modal" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="grafana-modal-header">
            <div>
              <h2 className="grafana-modal-title">Add New Device</h2>
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                Position: U{addModalSlot} · {getNodeName(nodes, rack.nodeId)} ·
                가용 공간 {contiguousFreeU}U
              </span>
            </div>
            <button className="grafana-modal-close" onClick={closeAddModal}>
              &times;
            </button>
          </div>

          {/* Modal Content */}
          <div className="grafana-modal-content">
            {/* Registered Device List */}
            <div className="grafana-field">
              <label className="grafana-label">등록 장비 선택</label>
              {groupRegDevices.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  등록된 장비가 없습니다.
                </div>
              ) : (
                <div className="reg-device-list">
                  {groupRegDevices.map((rd) => {
                    const thumb = resolveDeviceImage(rd.modelName);
                    const isSelected = selectedRegDeviceId === rd.id;
                    const placeable = canPlace(rd.uSize);
                    return (
                      <div
                        key={rd.id}
                        className={`reg-device-item ${isSelected ? "selected" : ""} ${!placeable ? "disabled" : ""}`}
                        onClick={() => {
                          if (placeable) setSelectedRegDeviceId(rd.id);
                        }}
                        style={{
                          opacity: placeable ? 1 : 0.45,
                          cursor: placeable ? "pointer" : "not-allowed",
                          position: "relative",
                        }}
                      >
                        <div className="reg-device-item-thumb">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={rd.modelName}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "var(--text-tertiary)",
                              }}
                            >
                              No IMG
                            </span>
                          )}
                        </div>
                        <div className="reg-device-item-info">
                          <div
                            className="reg-device-item-model"
                            style={{ marginBottom: "2px" }}
                          >
                            {rd.deviceName || rd.modelName}
                          </div>
                          <div className="reg-device-item-details">
                            {rd.deviceName &&
                              rd.deviceName !== rd.modelName && (
                                <span
                                  className="reg-device-item-badge"
                                  style={{
                                    background: "var(--bg-primary)",
                                    border: "1px solid var(--border-weak)",
                                  }}
                                >
                                  {rd.modelName}
                                </span>
                              )}
                            <span className="reg-device-item-badge">
                              {rd.uSize}U
                            </span>
                            <span className="reg-device-item-badge">
                              {rd.vendor}
                            </span>
                            <span>{rd.ip}</span>
                          </div>
                        </div>
                        {!placeable && (
                          <span
                            style={{
                              fontSize: "var(--font-size-xs)",
                              color: "#ff6b6b",
                              fontWeight: 600,
                              background: "rgba(255, 60, 60, 0.1)",
                              border: "1px solid rgba(255, 60, 60, 0.3)",
                              borderRadius: "var(--radius-sm)",
                              padding: "2px 8px",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            배치 불가
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected device info */}
            {selectedRegDevice && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-weak)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                    fontWeight: 600,
                  }}
                >
                  선택된 장비 정보
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px",
                    fontSize: "var(--font-size-xs)",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Model:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.modelName}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Size:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.uSize}U
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>IP: </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.ip}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>MAC: </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.mac}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Vendor:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.vendor}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      Type:{" "}
                    </span>
                    <span
                      style={{ color: "var(--text-primary)", fontWeight: 500 }}
                    >
                      {selectedRegDevice.type}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                className="grafana-btn grafana-btn-primary"
                onClick={handleAdd}
                disabled={!selectedRegDeviceId}
                style={{
                  flex: 1,
                  opacity: selectedRegDeviceId ? 1 : 0.5,
                  cursor: selectedRegDeviceId ? "pointer" : "not-allowed",
                }}
              >
                {selectedRegDevice
                  ? `${selectedRegDevice.deviceName || selectedRegDevice.modelName} 배치 (U${addModalSlot})`
                  : "장비를 선택하세요"}
              </button>
              <button
                className="grafana-btn grafana-btn-secondary"
                onClick={closeAddModal}
                style={{ flex: 0.4 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };

  return (
    <div className="grafana-side-panel" style={{ width: "400px" }}>
      <PanelStyles />

      <div className="grafana-side-panel-header">
        <div>
          {isEditingName ? (
            <input
              ref={editInputRef}
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              onBlur={handleNameSubmit}
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--text-primary)",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--theme-primary)",
                outline: "none",
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                width: "200px",
                margin: 0,
              }}
            />
          ) : (
            <h2
              onClick={() => {
                setEditNameValue(
                  rack.displayName || `Rack ${rack.id.substring(0, 4)}`,
                );
                setIsEditingName(true);
              }}
              style={{
                margin: 0,
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              title="클릭하여 랙 이름 변경"
            >
              {rack.displayName || `Rack ${rack.id.substring(0, 4)}`}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-tertiary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </h2>
          )}
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {rack.uHeight}U Configuration
            <span
              style={{
                marginLeft: "6px",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--theme-primary)",
                color: "#fff",
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
              }}
            >
              {getNodeName(nodes, rack.nodeId)}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => selectRack(null)}
            className="grafana-modal-close"
            style={{ position: "static", transform: "none" }}
          >
            ×
          </button>
        </div>
      </div>

      <div className="grafana-side-panel-content">
        {/* Orientation Control (Edit Mode Only) */}
        {isEditMode && (
          <div className="grafana-section" style={{ marginBottom: "16px" }}>
            <h3 className="grafana-section-title">Rack Orientation</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {[
                { label: "North (0°)", value: 0 },
                { label: "East (90°)", value: 90 },
                { label: "South (180°)", value: 180 },
                { label: "West (270°)", value: 270 },
              ].map((dir) => {
                const wouldViolate = checkFrontClearanceViolation(
                  racks.filter((r) => r.nodeId === rack.nodeId),
                  rack.id,
                  rack.position,
                  dir.value as 0 | 90 | 180 | 270,
                );
                const isCurrentDirection = rack.orientation === dir.value;
                const isDisabled = wouldViolate && !isCurrentDirection;

                return (
                  <button
                    key={dir.value}
                    className={`grafana-btn grafana-btn-sm ${isCurrentDirection ? "grafana-btn-primary" : "grafana-btn-secondary"}`}
                    onClick={() =>
                      !isDisabled &&
                      updateRackOrientation(
                        rack.id,
                        dir.value as 0 | 90 | 180 | 270,
                      )
                    }
                    disabled={isDisabled}
                    style={{
                      fontSize: "var(--font-size-xs)",
                      opacity: isDisabled ? 0.4 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                    }}
                    title={
                      isDisabled
                        ? "이 방향으로 회전하면 다른 장비의 정면 1.5단위 이내에 위치하게 됩니다."
                        : ""
                    }
                  >
                    {dir.label}
                    {isDisabled && " ⛔"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Rack Layout */}
        <div
          className="grafana-section"
          style={{ background: "transparent", border: "none", padding: 0 }}
        >
          <h3 className="grafana-section-title">Rack Layout</h3>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-tertiary)",
              marginBottom: "8px",
            }}
          >
            빈 슬롯을 클릭하면 등록 장비를 배치할 수 있습니다.
          </div>
          {renderSlots()}
        </div>

        {/* Delete Rack Section */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "20px",
            borderTop: "1px solid var(--severity-critical-bg)",
          }}
        >
          <button
            className="grafana-btn grafana-btn-md grafana-btn-destructive"
            style={{ width: "100%" }}
            onClick={() => setIsDeleteRackModalOpen(true)}
          >
            Rack 삭제
          </button>
        </div>
      </div>

      {renderAddDeviceModal()}

      {/* Rack Deletion Confirm Modal */}
      {isDeleteRackModalOpen &&
        createPortal(
          <div
            className="confirm-modal-overlay"
            onClick={() => setIsDeleteRackModalOpen(false)}
          >
            <div
              className="confirm-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-modal-header">
                <div className="confirm-modal-icon">🗑️</div>
                <h3 className="confirm-modal-title">랙 삭제</h3>
              </div>
              <div className="confirm-modal-body">
                <strong>
                  {rack.displayName || `Rack ${rack.id.substring(0, 4)}`}
                </strong>
                을(를) 삭제하시겠습니까?
                <br />랙 내부의 모든 장비도 함께 삭제됩니다.
              </div>
              <div className="confirm-modal-actions">
                <button
                  className="grafana-btn grafana-btn-md grafana-btn-secondary"
                  onClick={() => setIsDeleteRackModalOpen(false)}
                >
                  취소
                </button>
                <button
                  className="grafana-btn grafana-btn-md grafana-btn-destructive"
                  onClick={() => {
                    deleteRack(rack.id);
                    setIsDeleteRackModalOpen(false);
                    showToast("랙이 삭제되었습니다.", "success");
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
