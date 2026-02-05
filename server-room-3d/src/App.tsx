import { useRef } from "react";
import { Scene } from "./components/Scene";
import { DevicePanel } from "./components/DevicePanel";
import { DeviceModal } from "./components/DeviceModal";
import { DashboardWidgets } from "./components/DashboardWidgets";
import { ThemeToggle } from "./components/ThemeToggle";
import { FocusCarousel } from "./components/FocusCarousel";
import { useStore } from "./store/useStore";
import {
  saveToJSON,
  loadFromJSON,
  saveToExcel,
  loadFromExcel,
  sampleRacks,
} from "./utils/storage";

function App() {
  const { addRack, loadState, selectedRackId, racks, isEditMode, setEditMode } =
    useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const loadedRacks = await loadFromJSON(e.target.files[0]);
        loadState(loadedRacks);
        alert("JSON loaded successfully!");
      } catch (err) {
        alert("Failed to load JSON");
        console.error(err);
      }
      e.target.value = ""; // Reset for re-uploading same file
    }
  };

  const handleExcelLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const loadedRacks = await loadFromExcel(e.target.files[0]);
        loadState(loadedRacks);
        alert("Excel loaded successfully!");
      } catch (err) {
        alert("Failed to load Excel: " + (err as Error).message);
        console.error(err);
      }
      e.target.value = ""; // Reset
    }
  };

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
          <span className="grafana-toolbar-label">Add Rack:</span>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() =>
              addRack(24, [
                Math.round(Math.random() * 5 * 2) / 2,
                Math.round(Math.random() * 5 * 2) / 2,
              ])
            }
          >
            24U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() =>
              addRack(32, [
                Math.round(Math.random() * 5 * 2) / 2,
                Math.round(Math.random() * 5 * 2) / 2,
              ])
            }
          >
            32U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() =>
              addRack(48, [
                Math.round(Math.random() * 5 * 2) / 2,
                Math.round(Math.random() * 5 * 2) / 2,
              ])
            }
          >
            48U
          </button>
        </div>

        <div className="grafana-toolbar-divider" />

        {/* File Operations */}
        <div className="grafana-toolbar-group">
          <button
            className="grafana-btn grafana-btn-primary"
            onClick={() => saveToJSON(racks)}
            title="Export as JSON"
          >
            Export JSON
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".json"
            onChange={handleLoad}
          />

          <div
            style={{
              width: "1px",
              height: "20px",
              background: "rgba(255,255,255,0.1)",
              margin: "0 8px",
            }}
          />

          <button
            className="grafana-btn grafana-btn-primary"
            onClick={() => saveToExcel(racks)}
            title="Export as Excel"
          >
            Export Excel
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() => excelInputRef.current?.click()}
          >
            Import Excel
          </button>
          <input
            type="file"
            ref={excelInputRef}
            style={{ display: "none" }}
            accept=".xlsx"
            onChange={handleExcelLoad}
          />

          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={loadSample}
            style={{ marginLeft: "12px" }}
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

      {/* Rack Navigation Carousel (Normal Mode) */}
      <FocusCarousel />
    </div>
  );
}

export default App;
