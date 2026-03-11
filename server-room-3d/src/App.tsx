import { Scene } from "./components/Scene";
import { DevicePanel } from "./components/DevicePanel";
import { DeviceModal } from "./components/DeviceModal";
import { DashboardWidgets } from "./components/DashboardWidgets";
import { ThemeToggle } from "./components/ThemeToggle";
import { FocusCarousel } from "./components/FocusCarousel";
import { ImportExportModal } from "./components/ImportExportModal";
import { ModelImporter } from "./components/ModelImporter";
import { DeviceRegistrationModal } from "./components/DeviceRegistrationModal";
import { useStore } from "./store/useStore";
import { sampleRacks, sampleRegisteredDevices } from "./utils/storage";
import type { GroupName } from "./types";

const GROUP_TABS: GroupName[] = ["과천", "대전"];

function App() {
  const {
    addRack,
    loadState,
    selectedRackId,
    isEditMode,
    setEditMode,
    setImportExportModalRackId,
    setDeviceRegistrationModalOpen,
    activeGroup,
    setActiveGroup,
    deviceRegistrationModalOpen,
    importExportModalRackId,
    selectedDeviceId,
  } = useStore();

  const isModalOpen =
    deviceRegistrationModalOpen ||
    importExportModalRackId !== null ||
    selectedDeviceId !== null;

  const loadSample = () => {
    loadState(sampleRacks, undefined, sampleRegisteredDevices);
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

        <div className="grafana-toolbar-divider" />

        {/* STN Group Switcher */}
        <div className="grafana-toolbar-group" style={{ gap: "4px" }}>
          <span
            className="grafana-toolbar-label"
            style={{
              fontWeight: 700,
              fontSize: "var(--font-size-sm)",
              color: "var(--theme-primary)",
              letterSpacing: "0.05em",
            }}
          >
            STN
          </span>
          <span
            style={{
              color: "var(--text-tertiary)",
              fontSize: "var(--font-size-sm)",
              margin: "0 2px",
            }}
          >
            ›
          </span>
          {GROUP_TABS.map((group) => (
            <button
              key={group}
              className={`grafana-btn ${activeGroup === group ? "grafana-btn-primary" : "grafana-btn-secondary"}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveGroup(group);
              }}
              style={{
                fontSize: "var(--font-size-xs)",
                padding: "4px 12px",
                minWidth: "48px",
              }}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="grafana-toolbar-divider" />

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
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
              color: isEditMode
                ? "var(--severity-success-text)"
                : "var(--text-secondary)",
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
                className="grafana-btn grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(24)}
              >
                24
              </button>
              <button
                className="grafana-btn grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(32)}
              >
                32
              </button>
              <button
                className="grafana-btn grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(48)}
              >
                48
              </button>

              <div
                style={{
                  width: "1px",
                  height: "16px",
                  background: "rgba(255,255,255,0.1)",
                  margin: "0 6px",
                }}
              />

              <span
                className="grafana-toolbar-label"
                style={{ fontSize: "11px", opacity: 0.8 }}
              >
                Wide:
              </span>
              <button
                className="grafana-btn grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(24, undefined, 1.0)}
              >
                24
              </button>
              <button
                className="grafana-btn grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(32, undefined, 1.0)}
              >
                32
              </button>
              <button
                className="grafana-btn grafana-btn-secondary grafana-btn-compact"
                onClick={() => addRack(48, undefined, 1.0)}
              >
                48
              </button>
            </div>

            <div className="grafana-toolbar-divider" />

            {/* Device Registration */}
            <button
              className="grafana-btn grafana-btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                setDeviceRegistrationModalOpen(true);
              }}
              title="장비 등록"
              style={{ fontSize: "var(--font-size-sm)" }}
            >
              📋 장비 등록
            </button>

            <div className="grafana-toolbar-divider" />

            {/* Unified Room Operations */}
            <div className="grafana-toolbar-group">
              <button
                className="grafana-btn grafana-btn-primary"
                onClick={() => setImportExportModalRackId("all")}
                title="Export Room Data"
              >
                Export
              </button>
              <button
                className="grafana-btn grafana-btn-secondary"
                onClick={() => setImportExportModalRackId("all")}
                title="Import Room Data"
              >
                Import
              </button>

              <div
                style={{
                  width: "1px",
                  height: "20px",
                  background: "rgba(255,255,255,0.1)",
                  margin: "0 8px",
                }}
              />

              <button
                className="grafana-btn grafana-btn-secondary"
                onClick={loadSample}
              >
                Sample
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
      <DeviceModal />

      {/* Global Import/Export Modal */}
      <ImportExportModal />

      {/* Device Registration Modal */}
      <DeviceRegistrationModal />

      {/* 3D Model Importer (Edit Mode only) */}
      <ModelImporter />

      {/* Rack Navigation Carousel (Normal Mode) */}
      <FocusCarousel />
    </div>
  );
}

export default App;
