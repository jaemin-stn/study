import { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { DEVICE_TEMPLATES } from "../utils/deviceTemplates";
import type { GroupName, VendorName } from "../types";

const GROUPS: GroupName[] = ["과천", "대전"];
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
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: drm-fade-in 0.2s ease-out;
}
@keyframes drm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.drm-modal {
  background: var(--modal-bg);
  border: 1px solid var(--border-weak);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  width: 960px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: drm-zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes drm-zoom-in {
  from { transform: scale(0.95) translateY(10px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.drm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.02), transparent);
}
.drm-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  letter-spacing: -0.02em;
}
.drm-header h2 .icon-wrap {
  width: 32px;
  height: 32px;
  background: var(--theme-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(110, 159, 255, 0.3);
  font-size: 16px;
}
.drm-close {
  background: var(--bg-tertiary);
  border: none;
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}
.drm-close:hover {
  background: var(--severity-critical);
  color: #fff;
  transform: rotate(90deg);
}
.drm-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 32px 32px 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Card-like Sections */
.drm-section-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-weak);
  border-radius: 16px;
  padding: 24px;
}

/* Form section */
.drm-form-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.drm-form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
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
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.drm-field label .drm-required {
  color: var(--severity-critical);
  margin-left: 2px;
}
.drm-field input,
.drm-field select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-family);
  transition: all 0.2s;
}
.drm-field input:focus,
.drm-field select:focus {
  outline: none;
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 3px rgba(110, 159, 255, 0.15);
  background: var(--bg-primary);
}
.drm-field .drm-error-hint {
  font-size: 12px;
  color: var(--severity-critical-text);
  margin-top: 4px;
}
.drm-form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}
.drm-submit-btn {
  height: 42px;
  padding: 0 32px;
  background: var(--theme-primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(110, 159, 255, 0.3);
}
.drm-submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(110, 159, 255, 0.4);
}

/* Table section */
.drm-table-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.drm-search-wrap {
  flex: 1;
  position: relative;
}
.drm-search-input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 40px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.2s;
}
.drm-search-wrap::before {
  content: '🔍';
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  opacity: 0.5;
}
.drm-group-filter {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.drm-table-container {
  border: 1px solid var(--border-weak);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-primary);
}
.drm-table-scroll {
  max-height: 300px;
  overflow-y: auto;
}
.drm-table {
  width: 100%;
  border-collapse: collapse;
}
.drm-table th {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-weak);
  position: sticky;
  top: 0;
}
.drm-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-weak);
  color: var(--text-primary);
  font-size: 14px;
}
.drm-table tr:hover {
  background: rgba(110, 159, 255, 0.05);
}
.drm-vendor-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: rgba(110, 159, 255, 0.1);
  color: var(--theme-primary);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.drm-delete-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(255, 100, 100, 0.2);
  color: var(--severity-critical);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.drm-delete-btn:hover {
  background: var(--severity-critical);
  color: white;
  border-color: var(--severity-critical);
}

/* Toast notification */
.drm-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  animation: drm-toast-in 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes drm-toast-in {
  from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

/* Delete confirm popover */
.drm-confirm-popover {
  position: fixed;
  z-index: 1501;
  background: var(--modal-bg);
  border: 1px solid var(--border-medium);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  padding: 20px;
  width: 300px;
  animation: drm-pop-in 0.2s ease-out;
}
@keyframes drm-pop-in {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.drm-confirm-popover p {
  margin: 0 0 12px 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  line-height: 1.5;
}
.drm-confirm-popover .drm-placement-warn {
  font-size: var(--font-size-xs);
  color: var(--severity-major-text);
  background: var(--severity-major-bg);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}
.drm-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
`;

interface ToastState {
  message: string;
  type: "success" | "error";
}

interface DeleteConfirm {
  id: string;
  deviceName: string;
  placedCount: number;
  rect: DOMRect;
}

export const DeviceRegistrationModal = () => {
  const isOpen = useStore((s) => s.deviceRegistrationModalOpen);
  const setOpen = useStore((s) => s.setDeviceRegistrationModalOpen);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const racks = useStore((s) => s.racks);
  const addRegisteredDevice = useStore((s) => s.addRegisteredDevice);
  const removeRegisteredDevice = useStore((s) => s.removeRegisteredDevice);
  const activeGroup = useStore((s) => s.activeGroup);

  // Form state
  const [groupName, setGroupName] = useState<GroupName>(activeGroup);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [deviceName, setDeviceName] = useState("");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [vendor, setVendor] = useState<VendorName>("Nokia");

  // Table state
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupName | "all">("all");

  // UI state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(
    null,
  );

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filtered list — must come before any conditional return (React Hook rule)
  const filteredDevices = useMemo(() => {
    let list = registeredDevices;
    if (groupFilter !== "all") {
      list = list.filter((d) => d.groupName === groupFilter);
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
  }, [registeredDevices, groupFilter, search]);

  if (!isOpen) return null;

  const selectedTemplate = DEVICE_TEMPLATES[selectedModelIdx];

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
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
      groupName,
      deviceName: deviceName.trim(),
      modelName: selectedTemplate.modelName,
      type: selectedTemplate.type,
      uSize: selectedTemplate.uSize,
      ip: ip.trim(),
      mac: mac.trim().toUpperCase(),
      vendor,
    });

    showToast(`장비 "${deviceName.trim()}" 이(가) 등록되었습니다.`, "success");
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
    );
    setDeleteConfirm(null);
  };

  return (
    <>
      <style>{MODAL_STYLES}</style>

      {/* Toast */}
      {toast && (
        <div
          className={`drm-toast ${toast.type === "success" ? "drm-toast-success" : "drm-toast-error"}`}
        >
          {toast.message}
        </div>
      )}

      {/* Delete confirmation popover */}
      {deleteConfirm && (
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
        </>
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
            <button className="drm-close" onClick={() => setOpen(false)}>
              &times;
            </button>
          </div>

          {/* Body */}
          <div className="drm-body">
            {/* Part A: Registration Form */}
            <div className="drm-section-card">
              <div className="drm-form-title">
                <span>➕</span> 새 장비 등록
              </div>
              <div className="drm-form-grid">
                {/* Group */}
                <div className="drm-field">
                  <label>
                    그룹<span className="drm-required">*</span>
                  </label>
                  <select
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value as GroupName)}
                  >
                    {GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
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
                  등록하기
                </button>
              </div>
            </div>

            {/* Part B: Device Table */}
            <div className="drm-section-card">
              <div className="drm-form-title">
                <span>📦</span> 등록 장비 목록
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-tertiary)",
                    marginLeft: "8px",
                    fontWeight: 400,
                  }}
                >
                  ({filteredDevices.length}건)
                </span>
              </div>

              <div className="drm-table-toolbar">
                <div className="drm-search-wrap">
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
                  value={groupFilter}
                  onChange={(e) =>
                    setGroupFilter(e.target.value as GroupName | "all")
                  }
                >
                  <option value="all">전체 그룹</option>
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
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
                            <td>
                              <span className="grafana-badge grafana-badge-success">
                                {device.groupName}
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
    </>
  );
};
