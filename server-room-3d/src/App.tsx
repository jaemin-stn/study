import { useRef } from "react";
import { Scene } from "./components/Scene";
import { DevicePanel } from "./components/DevicePanel";
import { DeviceModal } from "./components/DeviceModal";
import { DashboardWidgets } from "./components/DashboardWidgets";
import { useStore } from "./store/useStore";
import { saveToJSON, loadFromJSON, sampleRacks } from "./utils/storage";

function App() {
  const { addRack, loadState, selectedRackId, racks, isEditMode, setEditMode } =
    useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const loadedRacks = await loadFromJSON(e.target.files[0]);
        loadState(loadedRacks);
      } catch (err) {
        alert("Failed to load JSON");
        console.error(err);
      }
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
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 10,
          background: "rgba(255,255,255,0.9)",
          padding: "10px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Edit Mode Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: isEditMode ? "#e8f5e9" : "#f5f5f5",
            padding: "4px 12px",
            borderRadius: "20px",
            border: `1px solid ${isEditMode ? "#4caf50" : "#ddd"}`,
            cursor: "pointer",
            transition: "all 0.3s",
          }}
          onClick={() => setEditMode(!isEditMode)}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: isEditMode ? "#4caf50" : "#9e9e9e",
            }}
          />
          <strong style={{ color: isEditMode ? "#2e7d32" : "#616161" }}>
            {isEditMode ? "Edit Mode: ON" : "Edit Mode: OFF"}
          </strong>
        </div>

        <div
          style={{
            display: "flex",
            gap: "5px",
            borderRight: "1px solid #ddd",
            paddingRight: "10px",
            marginLeft: "10px",
          }}
        >
          <strong>Add Rack:</strong>
          <button
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

        <div style={{ display: "flex", gap: "5px" }}>
          <button onClick={() => saveToJSON(racks)}>Save JSON</button>
          <button onClick={() => fileInputRef.current?.click()}>
            Load JSON
          </button>
          <button onClick={loadSample}>Load Sample</button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".json"
            onChange={handleLoad}
          />
        </div>

        <div
          style={{
            marginLeft: "10px",
            fontSize: "12px",
            color: "#666",
            alignSelf: "center",
          }}
        >
          Use Left Mouse to Rotate, Right to Pan. Click Rack to Edit. Click
          Error Marker to Fly-to.
        </div>
      </div>

      {/* Dashboard Widgets (shown when no rack is selected) */}
      {!selectedRackId && <DashboardWidgets />}

      {/* Side Panel */}
      {selectedRackId && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            zIndex: 20,
          }}
        >
          <DevicePanel />
        </div>
      )}

      {/* Global Device Modal */}
      <DeviceModal />
    </div>
  );
}

export default App;
