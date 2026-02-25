import { Scene } from "./components/Scene";
import { DevicePanel } from "./components/DevicePanel";
import { DeviceModal } from "./components/DeviceModal";
import { DashboardWidgets } from "./components/DashboardWidgets";
import { ThemeToggle } from "./components/ThemeToggle";
import { FocusCarousel } from "./components/FocusCarousel";
import { ImportExportModal } from "./components/ImportExportModal";
import { ModelImporter } from "./components/ModelImporter";
import { useStore } from "./store/useStore";
import { sampleRacks } from "./utils/storage";

function App() {
  const {
    addRack,
    loadState,
    selectedRackId,
    isEditMode,
    setEditMode,
    setImportExportModalRackId,
  } = useStore();

  const loadSample = () => {
    loadState(sampleRacks);
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
          zIndex: 10,
        }}
      >
        {/* Theme Toggle */}
        <ThemeToggle />

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

        <div className="grafana-toolbar-divider" />

        {/* Add Rack */}
        <div className="grafana-toolbar-group">
          <span className="grafana-toolbar-label">Add Standard:</span>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              addRack(24);
            }}
          >
            24U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              addRack(32);
            }}
          >
            32U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              addRack(48);
            }}
          >
            48U
          </button>

          <span
            className="grafana-toolbar-label"
            style={{ marginLeft: "12px" }}
          >
            Add Wide:
          </span>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              addRack(24, undefined, 1.0);
            }}
          >
            24U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              addRack(32, undefined, 1.0);
            }}
          >
            32U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              addRack(48, undefined, 1.0);
            }}
          >
            48U
          </button>
        </div>

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
      </div>

      {/* Dashboard Widgets (shown when no rack is selected) */}
      {!selectedRackId && <DashboardWidgets />}

      {/* Side Panel */}
      {selectedRackId && <DevicePanel />}

      {/* Global Device Modal */}
      <DeviceModal />

      {/* Global Import/Export Modal */}
      <ImportExportModal />

      {/* 3D Model Importer (Edit Mode only) */}
      <ModelImporter />

      {/* Rack Navigation Carousel (Normal Mode) */}
      <FocusCarousel />
    </div>
  );
}

export default App;
