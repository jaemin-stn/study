import React, { useRef } from "react";
import { Scene } from "./components/Scene";
import { DevicePanel } from "./components/DevicePanel";
import { DashboardWidgets } from "./components/DashboardWidgets";
import { ThemeToggle } from "./components/ThemeToggle";
import { FocusCarousel } from "./components/FocusCarousel";
import { Breadcrumb } from "./components/Breadcrumb";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";

const DeviceModal = React.lazy(() => import("./components/DeviceModal").then((m) => ({ default: m.DeviceModal })));
const ImportExportModal = React.lazy(() => import("./components/ImportExportModal").then((m) => ({ default: m.ImportExportModal })));
const ModelImporter = React.lazy(() => import("./components/ModelImporter").then((m) => ({ default: m.ModelImporter })));
const DeviceRegistrationModal = React.lazy(() => import("./components/DeviceRegistrationModal").then((m) => ({ default: m.DeviceRegistrationModal })));
import {

  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  ArchiveBoxIcon,
  FloppyIcon,
  ArrowsPointingOutIcon,
} from "./components/Icons";
import { useTheme } from "./contexts/ThemeContext";
import { useStore } from "./store/useStore";
import {
  sampleRacks,
  sampleRegisteredDevices,
  sampleNodes,
} from "./utils/sampleData";
import { createPortal } from "react-dom";

/* ---------- Device Delete Confirmation Modal (top-level, z=99999) ---------- */
const DeviceDeleteConfirmModal = () => {
  const confirm = useStore((s) => s.deviceDeleteConfirm);
  const setConfirm = useStore((s) => s.setDeviceDeleteConfirm);
  const removeRegisteredDevice = useStore((s) => s.removeRegisteredDevice);
  const setOpen = useStore((s) => s.setDeviceRegistrationModalOpen);

  if (!confirm) return null;

  const handleConfirm = () => {
    removeRegisteredDevice(confirm.id);
    setConfirm(null);
    setOpen(true); // ensure main modal stays open
  };

  const handleCancel = () => {
    setConfirm(null);
    setOpen(true); // ensure main modal stays open
  };

  return createPortal(
    <>
      <div
        onClick={handleCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 99998,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 99999,
          background: "var(--bg-primary)",
          border: "1px solid var(--border-medium)",
          borderRadius: "16px",
          padding: "32px",
          width: "400px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <p
          style={{
            margin: "0 0 20px 0",
            fontSize: "15px",
            color: "var(--text-primary)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--text-primary)" }}>
            "{confirm.title}"
          </strong>
          {confirm.rackName
            ? `은(는) 「${confirm.rackName}」에 배치되어 있습니다. 삭제하시겠습니까?`
            : "을(를) 삭제하시겠습니까?"}
        </p>
        {confirm.rackName && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--severity-critical)",
              background: "rgba(239,68,68,0.1)",
              padding: "10px 12px",
              borderRadius: "8px",
              marginBottom: "20px",
              lineHeight: 1.5,
            }}
          >
            ⚠️ 삭제하면 현재 배치된 위치에서도 함께 제거됩니다.
          </div>
        )}
        <div
          style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
        >
          <button
            className="grafana-btn grafana-btn-secondary"
            style={{ padding: "8px 20px", fontSize: "13px" }}
            onClick={handleCancel}
          >
            취소
          </button>
          <button
            className="grafana-btn grafana-btn-destructive"
            style={{ padding: "8px 20px", fontSize: "13px" }}
            onClick={handleConfirm}
          >
            삭제
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
};

/* ---------- Premium Toast Component ---------- */
const Toast = () => {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;

  return createPortal(
    <div className={`toast-overlay ${toast.type}`}>
      <div className={`toast-card ${toast.type}`}>
        <div className="toast-icon">
          {toast.type === "success" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <span className="toast-message">{toast.message}</span>
      </div>
    </div>,
    document.body,
  );
};

const APP_STYLES = `
.toast-overlay {
  position: fixed;
  left: 50%;
  z-index: 9999;
  pointer-events: none;
}
.toast-overlay.success {
  top: 50%;
  transform: translate(-50%, -50%);
}
.toast-overlay.error {
  bottom: 40px;
  transform: translateX(-50%);
}
.toast-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-radius: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  box-shadow: var(--elevation-3);
  color: var(--text-primary);
  animation: toast-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
}
.toast-card.success {
  border-color: var(--severity-success);
  background: var(--severity-success-bg);
  color: var(--severity-success-text);
  padding: 18px 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  animation: toast-center-appear 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.toast-card.success .toast-message {
  font-size: 16px;
}
.toast-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.toast-message {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
@keyframes toast-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes toast-center-appear {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
`;

function App() {
  const {
    addRack,
    loadState,
    selectedRackId,
    isEditMode,
    setEditMode,
    setImportExportModalRackId,
    setDeviceRegistrationModalOpen,
    deviceRegistrationModalOpen,
    importExportModalRackId,
    selectedDeviceId,
    setPendingImportFile,
    undo,
    saveChanges,
    getIsDirty,
  } = useStore();

  const isDirty = getIsDirty();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        // Prevent undo when typing in inputs/textareas
        const activeElem = document.activeElement;
        const isInput =
          activeElem instanceof HTMLInputElement ||
          activeElem instanceof HTMLTextAreaElement ||
          (activeElem as HTMLElement)?.isContentEditable;

        if (!isInput) {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  const toolbarImportInputRef = useRef<HTMLInputElement>(null);

  const isModalOpen =
    deviceRegistrationModalOpen ||
    importExportModalRackId !== null ||
    selectedDeviceId !== null;

  const loadSample = () => {
    loadState(sampleRacks, undefined, sampleRegisteredDevices, sampleNodes);
  };

  const handleToolbarImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toolbarImportInputRef.current) {
      toolbarImportInputRef.current.value = "";
      toolbarImportInputRef.current.click();
    }
  };

  const handleToolbarImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImportFile(file);
      setDeviceRegistrationModalOpen(false);
      setImportExportModalRackId("all");
    }
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {/* 3D Scene Layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      >
        <Scene />
      </div>

      {/* UI Overlay Layer (Toolbar) */}
      <div
        className="grafana-toolbar"
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 1000,
        }}
      >
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Hierarchy Breadcrumb */}
        <Breadcrumb />

        {/* Edit Mode Toggle */}
        <div
          className={`grafana-mode-indicator ${isEditMode ? "active" : ""}`}
          onClick={() => setEditMode(!isEditMode)}
        >
          <div
            className={`grafana-status-dot ${isEditMode ? "grafana-status-dot-active" : "grafana-status-dot-inactive"}`}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: "var(--font-size-sm)",
              lineHeight: 1,
              color: isEditMode
                ? "var(--severity-success-text)"
                : "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isEditMode ? "Edit Mode: ON" : "Edit Mode: OFF"}
          </span>
        </div>

        {isEditMode && (
          <>
            <div className="grafana-toolbar-divider" />

            {/* Add Rack Consolidated */}
            <div className="grafana-toolbar-group" style={{ gap: "4px" }}>
              <span
                className="grafana-toolbar-label"
                style={{ fontSize: "11px", opacity: 0.8 }}
              >
                Std:
              </span>
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(24)}
              >
                24
              </button>
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(32)}
              >
                32
              </button>
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(48)}
              >
                48
              </button>

              <div
                className="grafana-toolbar-divider"
                style={{ height: "16px", margin: "0 6px" }}
              />

              <span
                className="grafana-toolbar-label"
                style={{ fontSize: "11px", opacity: 0.8 }}
              >
                Wide:
              </span>
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(24, undefined, 1.0)}
              >
                24
              </button>
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(32, undefined, 1.0)}
              >
                32
              </button>
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(48, undefined, 1.0)}
              >
                48
              </button>
            </div>

            <div className="grafana-toolbar-divider" />

            {/* Device Registration */}
            <button
              className="grafana-btn grafana-btn-md grafana-btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                // Close other modals
                setImportExportModalRackId(null);
                setDeviceRegistrationModalOpen(true);
              }}
              title="장비 관리"
            >
              <ArchiveBoxIcon />
              장비
            </button>

            <div className="grafana-toolbar-divider" />

            {/* Unified Room Operations */}
            <div className="grafana-toolbar-group">
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary"
                onClick={() => {
                  setDeviceRegistrationModalOpen(false);
                  setImportExportModalRackId("all");
                }}
                title="Export Room Data"
              >
                <ArrowUpTrayIcon />
                Export
              </button>
              <button
                className="grafana-btn grafana-btn-md grafana-btn-secondary"
                title="Import Room Data"
                onClick={handleToolbarImportClick}
              >
                <ArrowDownTrayIcon />
                Import
              </button>
              <input
                type="file"
                ref={toolbarImportInputRef}
                style={{ display: "none" }}
                accept=".xlsx"
                onChange={handleToolbarImportFile}
              />

              <div
                className="grafana-toolbar-divider"
                style={{ height: "20px", margin: "0 8px" }}
              />

              <button
                className={`grafana-btn grafana-btn-md ${isDirty ? "grafana-btn-primary" : "grafana-btn-secondary"}`}
                onClick={saveChanges}
                disabled={!isDirty}
                title={isDirty ? "Save Unsaved Changes" : "No Changes to Save"}
                style={{
                  opacity: isDirty ? 1 : 0.5,
                  cursor: isDirty ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
              >
                <FloppyIcon />
                Save
              </button>

              <button
                className="grafana-btn grafana-btn-md grafana-btn-tertiary"
                onClick={loadSample}
              >
                <SparklesIcon /> Sample
              </button>
            </div>
          </>
        )}
      </div>

      {/* Dashboard Widgets (shown when no rack is selected and no modal is open) */}
      {!selectedRackId && !isModalOpen && <DashboardWidgets />}

      {/* Side Panel */}
      {selectedRackId && <DevicePanel />}

      {/* Global Device Modal */}
      {selectedDeviceId && (
        <React.Suspense fallback={null}>
          <DeviceModal />
        </React.Suspense>
      )}

      {/* Global Import/Export Modal */}
      {importExportModalRackId !== null && (
        <React.Suspense fallback={null}>
          <ImportExportModal />
        </React.Suspense>
      )}

      {/* Device Registration Modal */}
      {deviceRegistrationModalOpen && (
        <React.Suspense fallback={null}>
          <DeviceRegistrationModal />
        </React.Suspense>
      )}

      {/* Device Delete Confirm Modal - top-level, always above everything */}
      <DeviceDeleteConfirmModal />

      {/* 3D Model Importer (Edit Mode only) */}
      {isEditMode && (
        <React.Suspense fallback={null}>
          <ModelImporter />
        </React.Suspense>
      )}

      {/* Rack Navigation Carousel (Normal Mode) */}
      <FocusCarousel />

      <UnsavedChangesDialog />

      {/* 2D UI Overlay - Fit to Models (Fixed next to Gizmo) */}
      <FitToModelsButton />

      <Toast />
      <style>{APP_STYLES}</style>
    </div>
  );
}

const FitToModelsButton = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const fitToScene = useStore((s) => s.fitToScene);

  return (
    <div
      style={{
        position: "absolute",
        top: "240px",
        right: "380px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        width: "80px",
      }}
    >
      <button
        className="grafana-btn grafana-btn-secondary"
        onClick={(e) => {
          e.stopPropagation();
          fitToScene();
        }}
        title="모든 모델을 화면에 맞춤 (Fit All Models)"
        style={{
          width: "42px",
          height: "42px",
          padding: 0,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDarkMode ? "#2A3342" : "#ffffff",
          border: `1px solid ${isDarkMode ? "#526484" : "#dbdfea"}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          color: isDarkMode ? "#ffffff" : "#111827",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.borderColor = "#3b82f6";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = isDarkMode
            ? "#526484"
            : "#dbdfea";
        }}
      >
        <ArrowsPointingOutIcon style={{ width: "22px", height: "22px" }} />
      </button>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 800,
          color: isDarkMode ? "#ffffff" : "#364a63",
          textShadow: isDarkMode
            ? "0 1px 2px rgba(0,0,0,0.8)"
            : "0 1px 2px rgba(255,255,255,0.8)",
          pointerEvents: "none",
          background: isDarkMode
            ? "rgba(42,51,66,0.9)"
            : "rgba(255,255,255,0.9)",
          padding: "2px 8px",
          borderRadius: "12px",
          whiteSpace: "nowrap",
          border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
          letterSpacing: "0.02em",
        }}
      >
        FIT MODELS
      </span>
    </div>
  );
};

export default App;
