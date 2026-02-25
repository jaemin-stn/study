import { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";
import type { ImportedModel } from "../types";

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
  const toggleModelMove = useStore((s) => s.toggleModelMove);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedModel = importedModels.find((m) => m.id === selectedModelId);

  const handleImport = useCallback(
    async (file: File) => {
      if (!isValidExtension(file.name)) {
        setError("Unsupported format. Use .glb or .gltf only.");
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
          isMoveEnabled: false,
        });
      } catch {
        setError("Failed to read file.");
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div
        style={{
          position: "absolute",
          top: "140px",
          left: "20px",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "300px",
          maxHeight: "calc(100vh - 160px)",
        }}
      >
        {/* Import Action Card */}
        <div
          className="grafana-panel"
          style={{
            padding: "16px",
            background:
              "linear-gradient(145deg, var(--bg-primary), var(--bg-secondary))",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          <button
            className="grafana-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            style={{
              width: "100%",
              height: "44px",
              background: "linear-gradient(to bottom, #4f46e5, #4338ca)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
              transition: "transform 0.1s, box-shadow 0.2s",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.98)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {isLoading ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span className="spinner-mini" /> Importing...
              </div>
            ) : (
              "📂 Import 3D Model"
            )}
          </button>

          {error && (
            <div
              style={{
                marginTop: "12px",
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "var(--radius-sm)",
                color: "#ef4444",
                fontSize: "12px",
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Models List Section */}
        {importedModels.length > 0 && (
          <div
            className="grafana-panel"
            style={{
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-primary)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              maxHeight: "260px",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-weak)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Objects ({importedModels.length})
              </span>
            </div>

            <div
              style={{
                padding: "8px",
                overflowY: "auto",
              }}
            >
              {importedModels.map((m) => {
                const isSelected = selectedModelId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => selectModel(m.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      background: isSelected
                        ? "var(--selected-bg)"
                        : "transparent",
                      border: "1px solid",
                      borderColor: isSelected
                        ? "var(--theme-primary)"
                        : "transparent",
                      marginBottom: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: isSelected
                          ? "var(--theme-primary)"
                          : "var(--text-disabled)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.name}
                    </span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        style={{
                          background: m.isMoveEnabled
                            ? "rgba(34, 197, 94, 0.1)"
                            : "rgba(249, 115, 22, 0.08)",
                          color: m.isMoveEnabled ? "#22c55e" : "#f97316",
                          border: "1px solid",
                          borderColor: m.isMoveEnabled
                            ? "rgba(34, 197, 94, 0.2)"
                            : "rgba(249, 115, 22, 0.2)",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "10px",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleModelMove(m.id);
                        }}
                      >
                        {m.isMoveEnabled ? "🔓" : "🔒"}
                      </button>
                      <button
                        style={{
                          background: "transparent",
                          color: "var(--text-tertiary)",
                          border: "none",
                          fontSize: "14px",
                          padding: "0 4px",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteModel(m.id);
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.color = "#ef4444")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.color = "var(--text-tertiary)")
                        }
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Properties Section */}
        {selectedModel && (
          <ModelProperties
            model={selectedModel}
            onUpdate={(updates) => updateModel(selectedModel.id, updates)}
            onDelete={() => deleteModel(selectedModel.id)}
          />
        )}
      </div>

      {/* Drag overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: isDragOver ? 1000 : -1,
          pointerEvents: isDragOver ? "auto" : "none",
          background: isDragOver ? "rgba(79, 70, 229, 0.08)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          backdropFilter: isDragOver ? "blur(4px)" : "none",
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
              padding: "48px",
              borderRadius: "24px",
              border: "2px dashed #4f46e5",
              background: "var(--bg-primary)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.15)",
              textAlign: "center",
              transform: "scale(1.05)",
              animation: "pulse 2s infinite",
            }}
          >
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>📦</div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Ready to Import
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                marginTop: "8px",
              }}
            >
              Drop your GLB or GLTF file to add it
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .spinner-mini {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid #fff;
          borderRadius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

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
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}
    >
      <span
        style={{
          fontSize: "9px",
          fontWeight: 700,
          color: "var(--text-tertiary)",
          textAlign: "center",
        }}
      >
        {label}
      </span>
      <input
        type="number"
        value={Number(value.toFixed(3))}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: "100%",
          padding: "6px 4px",
          fontSize: "11px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
          textAlign: "center",
          outline: "none",
        }}
      />
    </div>
  );

  const vec3Block = (
    label: string,
    values: [number, number, number],
    onChange: (v: [number, number, number]) => void,
    step = 0.1,
  ) => (
    <div style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: "8px",
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", gap: "8px" }}>
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
    <div
      className="grafana-panel"
      style={{
        padding: "20px",
        background: "var(--bg-primary)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        border: "1px solid var(--border-weak)",
        overflowY: "auto",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          value={model.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Model Name"
          style={{
            width: "100%",
            padding: "8px 0",
            fontSize: "18px",
            fontWeight: 700,
            background: "transparent",
            border: "none",
            borderBottom: "2px solid var(--border-weak)",
            color: "var(--text-primary)",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderBottomColor = "var(--theme-primary)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderBottomColor = "var(--border-weak)")
          }
        />
      </div>

      {vec3Block("Position", model.position, (v) => onUpdate({ position: v }))}
      {vec3Block(
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
      {vec3Block("Scale", model.scale, (v) => onUpdate({ scale: v }), 0.1)}

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          className="grafana-btn"
          style={{
            width: "100%",
            height: "36px",
            fontSize: "12px",
            fontWeight: 600,
            background: model.isMoveEnabled
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(249, 115, 22, 0.08)",
            color: model.isMoveEnabled ? "#16a34a" : "#ea580c",
            border: "1px solid",
            borderColor: model.isMoveEnabled
              ? "rgba(34, 197, 94, 0.3)"
              : "rgba(249, 115, 22, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onClick={() => useStore.getState().toggleModelMove(model.id)}
        >
          {model.isMoveEnabled ? "🔓 Move Enabled" : "🔒 Move Locked"}
        </button>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="grafana-btn"
            style={{
              flex: 1,
              height: "36px",
              fontSize: "12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-medium)",
              color: "var(--text-primary)",
            }}
            onClick={() => {
              const { addImportedModel } = useStore.getState();
              const { id, ...modelData } = model;
              addImportedModel({
                ...modelData,
                name: `${modelData.name} (copy)`,
                position: [
                  modelData.position[0] + 0.5,
                  modelData.position[1],
                  modelData.position[2] + 0.5,
                ],
              });
            }}
          >
            Duplicate
          </button>
          <button
            className="grafana-btn"
            style={{
              flex: 1,
              height: "36px",
              fontSize: "12px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
            }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModelPropertiesProps {
  model: ImportedModel;
  onUpdate: (updates: Partial<Omit<ImportedModel, "id">>) => void;
  onDelete: () => void;
}
