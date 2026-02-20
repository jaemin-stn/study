import { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";

/** Read a File as a base64 data URL */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isValidExtension = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.endsWith(".glb") || lower.endsWith(".gltf");
};

export const ModelImporter = () => {
  const isEditMode = useStore((s) => s.isEditMode);
  const addImportedModel = useStore((s) => s.addImportedModel);
  const importedModels = useStore((s) => s.importedModels);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const selectModel = useStore((s) => s.selectModel);
  const deleteModel = useStore((s) => s.deleteModel);
  const updateModel = useStore((s) => s.updateModel);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedModel = importedModels.find((m) => m.id === selectedModelId);

  const handleImport = useCallback(
    async (file: File) => {
      if (!isValidExtension(file.name)) {
        setError(
          "지원되지 않는 파일 형식입니다. .glb 또는 .gltf 파일만 가능합니다.",
        );
        setTimeout(() => setError(null), 4000);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const dataUrl = await fileToDataUrl(file);
        const baseName = file.name.replace(/\.(glb|gltf)$/i, "");

        addImportedModel({
          name: baseName,
          fileName: file.name,
          dataUrl,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        });
      } catch {
        setError("파일을 읽는 중 오류가 발생했습니다.");
        setTimeout(() => setError(null), 4000);
      } finally {
        setIsLoading(false);
      }
    },
    [addImportedModel],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImport(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleImport],
  );

  // Window-level listener for native file drag from desktop.
  // Only listens for "dragenter" events — does NOT intercept pointer events.
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files") && isEditMode) {
        setIsDragOver(true);
      }
    };
    window.addEventListener("dragenter", handleDragEnter);
    return () => window.removeEventListener("dragenter", handleDragEnter);
  }, [isEditMode]);

  if (!isEditMode) return null;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Toolbar section */}
      <div
        className="grafana-toolbar"
        style={{
          position: "absolute",
          top: "180px",
          left: "12px",
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxWidth: "320px",
        }}
      >
        {/* Import button */}
        <div
          className="grafana-toolbar-group"
          style={{ justifyContent: "flex-end" }}
        >
          <button
            className="grafana-btn grafana-btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid #fff",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block",
                  }}
                />
                Loading...
              </>
            ) : (
              "📦 Import 3D Model"
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--severity-critical-bg)",
              border: "1px solid var(--severity-critical)",
              borderRadius: "var(--radius-md)",
              color: "var(--severity-critical-text)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            {error}
          </div>
        )}

        {/* Imported models list */}
        {importedModels.length > 0 && (
          <div
            className="grafana-panel"
            style={{
              padding: "12px",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 700,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              Imported Models ({importedModels.length})
            </div>
            {importedModels.map((m) => (
              <div
                key={m.id}
                onClick={() => selectModel(m.id)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  background:
                    selectedModelId === m.id
                      ? "var(--selected-bg)"
                      : "transparent",
                  border:
                    selectedModelId === m.id
                      ? "1px solid var(--theme-primary)"
                      : "1px solid transparent",
                  marginBottom: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-primary)",
                  transition: "background 0.15s",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  📦 {m.name}
                </span>
                <button
                  className="grafana-btn grafana-btn-secondary"
                  style={{
                    padding: "2px 6px",
                    fontSize: "11px",
                    minWidth: "unset",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteModel(m.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Properties panel for selected model */}
        {selectedModel && (
          <ModelProperties
            model={selectedModel}
            onUpdate={(updates) => updateModel(selectedModel.id, updates)}
            onDelete={() => deleteModel(selectedModel.id)}
          />
        )}
      </div>

      {/* Drag-and-drop overlay */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: isDragOver ? 999 : -1,
          pointerEvents: isDragOver ? "auto" : "none",
          background: isDragOver ? "rgba(110, 159, 255, 0.12)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleImport(file);
        }}
      >
        {isDragOver && (
          <div
            style={{
              padding: "40px 60px",
              borderRadius: "16px",
              border: "3px dashed var(--theme-primary)",
              background: "var(--panel-bg)",
              boxShadow: "var(--elevation-3)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📦</div>
            <div
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Drop GLB/GLTF file here
            </div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--text-secondary)",
                marginTop: "4px",
              }}
            >
              Supported: .glb, .gltf
            </div>
          </div>
        )}
      </div>

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

// ─── Properties Panel ───
import type { ImportedModel } from "../types";

interface ModelPropertiesProps {
  model: ImportedModel;
  onUpdate: (updates: Partial<Omit<ImportedModel, "id">>) => void;
  onDelete: () => void;
}

const ModelProperties = ({
  model,
  onUpdate,
  onDelete,
}: ModelPropertiesProps) => {
  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 0.1,
  ) => (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <label
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-tertiary)",
          width: "14px",
          textAlign: "center",
        }}
      >
        {label}
      </label>
      <input
        type="number"
        value={Number(value.toFixed(3))}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: "64px",
          padding: "3px 6px",
          fontSize: "var(--font-size-xs)",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );

  const vec3Row = (
    label: string,
    values: [number, number, number],
    onChange: (v: [number, number, number]) => void,
    step = 0.1,
  ) => (
    <div style={{ marginBottom: "8px" }}>
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        {numInput(
          "X",
          values[0],
          (v) => onChange([v, values[1], values[2]]),
          step,
        )}
        {numInput(
          "Y",
          values[1],
          (v) => onChange([values[0], v, values[2]]),
          step,
        )}
        {numInput(
          "Z",
          values[2],
          (v) => onChange([values[0], values[1], v]),
          step,
        )}
      </div>
    </div>
  );

  return (
    <div className="grafana-panel" style={{ padding: "12px" }}>
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          fontWeight: 700,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "10px",
        }}
      >
        Model Properties
      </div>

      {/* Name */}
      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: "4px",
          }}
        >
          Name
        </div>
        <input
          type="text"
          value={model.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          style={{
            width: "100%",
            padding: "4px 8px",
            fontSize: "var(--font-size-sm)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            boxSizing: "border-box",
          }}
        />
      </div>

      {vec3Row("Position", model.position, (v) => onUpdate({ position: v }))}
      {vec3Row(
        "Rotation (°)",
        [
          (model.rotation[0] * 180) / Math.PI,
          (model.rotation[1] * 180) / Math.PI,
          (model.rotation[2] * 180) / Math.PI,
        ],
        (v) =>
          onUpdate({
            rotation: [
              (v[0] * Math.PI) / 180,
              (v[1] * Math.PI) / 180,
              (v[2] * Math.PI) / 180,
            ],
          }),
        15,
      )}
      {vec3Row("Scale", model.scale, (v) => onUpdate({ scale: v }), 0.1)}

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        <button
          className="grafana-btn grafana-btn-secondary"
          style={{ flex: 1, fontSize: "var(--font-size-xs)" }}
          onClick={() => {
            const { addImportedModel } = useStore.getState();
            addImportedModel({
              name: model.name + " (copy)",
              fileName: model.fileName,
              dataUrl: model.dataUrl,
              position: [
                model.position[0] + 1,
                model.position[1],
                model.position[2],
              ],
              rotation: [...model.rotation],
              scale: [...model.scale],
            });
          }}
        >
          Duplicate
        </button>
        <button
          className="grafana-btn grafana-btn-secondary"
          style={{
            flex: 1,
            fontSize: "var(--font-size-xs)",
            color: "var(--severity-critical-text)",
          }}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
};
