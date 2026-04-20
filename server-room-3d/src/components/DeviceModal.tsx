import { useEffect, useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useStore } from "../store/useStore";
import type { Device, PortState } from "../types";
import { resolveDeviceSvgContent, hasDeviceSvgAsset } from "../utils/deviceAssets";
import { ERROR_COLORS } from "../utils/errorHelpers";

// ─── Severity helpers ────────────────────────────────────────────────────────
const severityBadgeClass: Record<string, string> = {
  critical: "grafana-badge-critical",
  major: "grafana-badge-major",
  minor: "grafana-badge-minor",
  warning: "grafana-badge-warning",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--severity-critical)",
  major: "var(--severity-major, #e05c17)",
  minor: "var(--severity-minor)",
  warning: "var(--severity-warning, #f2cc0c)",
};

// ─── CSS keyframe injection ───────────────────────────────────────────────────
const injectedKeyframes = new Set<string>();
function ensureKeyframe(name: string, color: string) {
  if (injectedKeyframes.has(name)) return;
  injectedKeyframes.add(name);
  const style = document.createElement("style");
  style.dataset.portAnim = name;
  // fill: 0%=55(33%), 50%=dd(87%) — 눈에 잘 보이도록 불투명도 높임
  // filter: drop-shadow 글로우 효과
  style.textContent = `
    @keyframes ${name} {
      0%,100% {
        fill: ${color}55;
        stroke: ${color};
        stroke-width: 3;
        filter: drop-shadow(0 0 3px ${color}aa);
        opacity: 1;
      }
      50% {
        fill: ${color}dd;
        stroke: ${color};
        stroke-width: 3;
        filter: drop-shadow(0 0 7px ${color});
        opacity: 0.55;
      }
    }
  `;
  document.head.appendChild(style);
}

// ─── SvgPortView: SVG 장비 이미지 + 에러 포트 블링크 + hover tooltip ────────
const SvgPortView = ({
  modelName,
  portStates,
}: {
  modelName: string;
  portStates: PortState[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);

  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadSvg = async () => {
      const content = await resolveDeviceSvgContent(modelName);
      if (isMounted) {
        setSvgContent(content ?? null);
      }
    };
    loadSvg();
    return () => { isMounted = false; };
  }, [modelName]);

  const errorPortMap = useMemo(
    () =>
      new Map(
        portStates
          .filter((p) => p.status === "error")
          .map((p) => [
            p.portId,
            p.errorLevel ? ERROR_COLORS[p.errorLevel] : "#ef4444",
          ]),
      ),
    [portStates],
  );

  // portId → PortState 빠른 조회
  const portStateMap = useMemo(
    () => new Map(portStates.map((p) => [p.portId, p])),
    [portStates],
  );

  useEffect(() => {
    const container = containerRef.current;
    const tooltip   = tooltipRef.current;
    if (!container || !svgContent) return;

    const svgEl = container.querySelector("svg");
    if (!svgEl) return;

    // SVG 크기 맞춤
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");

    // SVG 기본 title tooltip 제거 (브라우저가 자동으로 보여주는 텍스트 숨김)
    container.querySelectorAll("title").forEach((t) => { t.textContent = ""; });

    // 모든 포트 초기화 + hover 가능하게
    const allPortEls = container.querySelectorAll("[id^='port-']");
    allPortEls.forEach((el) => {
      const svgEl = el as SVGElement;
      svgEl.style.cssText = "fill:none;stroke:none;animation:none;";
      svgEl.style.pointerEvents = "all";
      svgEl.style.cursor = "pointer";
    });

    // 에러 포트 블링크 적용
    errorPortMap.forEach((color, portId) => {
      const portEl = container.querySelector(`#${portId}`) as SVGElement | null;
      if (!portEl) return;
      const animName = `port-blink-v2-${portId.replace(/[^a-z0-9]/gi, "-")}`;
      ensureKeyframe(animName, color);
      portEl.style.fill = `${color}55`;
      portEl.style.stroke = color;
      portEl.style.strokeWidth = "3";
      portEl.style.animation = `${animName} 0.9s ease-in-out infinite`;
    });

    // ── Tooltip 이벤트 ──────────────────────────────────────────────────────
    const cleanups: (() => void)[] = [];

    allPortEls.forEach((el) => {
      const portId     = el.id;                              // e.g. "port-5"
      const portNum    = portId.replace("port-", "");        // e.g. "5"
      const ps         = portStateMap.get(portId);
      const isError    = ps?.status === "error";
      const errorColor = isError
        ? (errorPortMap.get(portId) ?? "#ef4444")
        : null;

      const onEnter = (e: Event) => {
        if (!tooltip) return;
        const me = e as MouseEvent;

        // 내용 구성
        let html = `<span style="font-size:13px;font-weight:700;">Port ${portNum}</span>`;
        if (isError && ps) {
          html += `<br/><span style="opacity:.85;">${ps.errorLevel?.toUpperCase() ?? "ERROR"}</span>`;
          if (ps.errorMessage) {
            html += `<br/><span style="opacity:.7;font-size:11px;">${ps.errorMessage}</span>`;
          }
        } else {
          html += `<br/><span style="opacity:.7;">Operational</span>`;
        }
        tooltip.innerHTML = html;
        tooltip.style.borderColor = errorColor ?? "#22c55e";
        // position: fixed 기준으로 clientX, clientY 직접 사용
        tooltip.style.left = `${me.clientX}px`;
        tooltip.style.top  = `${me.clientY - 4}px`;
        tooltip.style.transform = "translate(-50%, -100%)";
        tooltip.style.display = "block";
      };

      const onMove = (e: Event) => {
        if (!tooltip) return;
        const me = e as MouseEvent;
        tooltip.style.left = `${me.clientX}px`;
        tooltip.style.top  = `${me.clientY - 4}px`;
      };

      const onLeave = () => {
        if (tooltip) tooltip.style.display = "none";
      };

      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mousemove",  onMove);
      el.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mousemove",  onMove);
        el.removeEventListener("mouseleave", onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }); // 매 렌더 동기 적용 (의존성 없음)

  if (!svgContent) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-secondary)",
        padding: "16px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-weak)",
        position: "relative", // tooltip 기준점
      }}
    >
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      {/* Hover tooltip – DOM 직접 조작, React state 없음 */}
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "fixed",
          pointerEvents: "none",
          zIndex: 9999,
          background: "rgba(10,12,24,0.95)",
          color: "#f0f4ff",
          padding: "6px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          lineHeight: "1.5",
          whiteSpace: "nowrap",
          border: "1px solid #4dabf7",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          transform: "translate(-50%, -100%)",
        }}
      />
    </div>
  );
};

// ─── Generic port grid (SVG 없는 장비용) ─────────────────────────────────────
const GenericPortGrid = ({
  device,
  highlightedPortId,
}: {
  device: Device;
  highlightedPortId: string | null;
}) => {
  const renderPort = (portIndex: number) => {
    const portIdNew = `port-${portIndex + 1}`;
    const portIdLegacy = `p${portIndex + 1}`;
    const portState = device.portStates.find(
      (p) => p.portId === portIdNew || p.portId === portIdLegacy,
    );
    const portId = portState?.portId ?? portIdNew;
    const isError = portState?.status === "error";
    const isHighlighted =
      highlightedPortId === portId ||
      highlightedPortId === portIdNew ||
      highlightedPortId === portIdLegacy;
    const ledColor = isHighlighted
      ? "var(--severity-minor)"
      : isError
        ? (SEVERITY_COLORS[portState?.errorLevel ?? ""] ?? "var(--severity-critical)")
        : "var(--severity-success)";

    return (
      <div
        key={portId}
        style={{
          width: "32px",
          height: "32px",
          backgroundColor: "var(--bg-tertiary)",
          border: isHighlighted
            ? `2px solid ${ledColor}`
            : isError
              ? `1px solid ${ledColor}`
              : "1px solid var(--border-medium)",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          cursor: "pointer",
          boxShadow: isHighlighted
            ? `0 0 15px rgba(242, 204, 12, 0.5)`
            : isError
              ? `0 0 8px ${ledColor}66`
              : "none",
          transform: isHighlighted ? "scale(1.15)" : "scale(1)",
          transition: "all 0.2s",
          zIndex: isHighlighted ? 10 : 1,
        }}
        title={
          isError
            ? `${portId}: ${portState?.errorMessage ?? "Error"} (${portState?.errorLevel ?? ""})`
            : `${portId}: Operational`
        }
      >
        <div
          style={{
            width: "12px",
            height: "10px",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "2px",
            border: "1px solid var(--border-medium)",
          }}
        />
        {/* Status LED */}
        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            backgroundColor: ledColor,
            boxShadow: `0 0 4px ${ledColor}`,
          }}
        />
        {isHighlighted && (
          <div
            style={{
              position: "absolute",
              bottom: "-16px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "var(--font-size-xs)",
              color: "var(--severity-minor)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {portId}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-secondary)",
        padding: "20px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-weak)",
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gap: "8px",
        justifyItems: "center",
      }}
    >
      {Array.from({ length: 24 }).map((_, i) => renderPort(i))}
    </div>
  );
};

// ─── DeviceModal ─────────────────────────────────────────────────────────────
export const DeviceModal = () => {
  const { racks, selectedDeviceId, highlightedPortId, selectDevice } =
    useStore();

  if (!selectedDeviceId) return null;

  let device: Device | undefined;
  let rack: import("../types").Rack | undefined;
  let rackId: string | undefined;

  for (const r of racks) {
    device = r.devices.find((d) => d.itemId === selectedDeviceId);
    if (device) {
      rackId = r.rackId;
      rack = r;
      break;
    }
  }

  if (!device) return null;

  // SVG 에셋이 있으면 SVG 뷰, 없으면 그리드 뷰
  const hasSvg = hasDeviceSvgAsset(device.modelName);
  const errorPorts = device.portStates.filter((p) => p.status === "error");

  return createPortal(
    <div
      className="grafana-modal-overlay"
      style={{ zIndex: 2000 }}
      onClick={() => selectDevice(null)}
    >
      <div
        className="grafana-modal"
        style={{
          width: "680px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="grafana-modal-header">
          <div>
            <h2 className="grafana-modal-title">{device.title}</h2>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <span
                className="grafana-badge grafana-badge-success"
                style={{ textTransform: "capitalize" }}
              >
                {device.type}
              </span>
              Rack: {rack?.rackTitle || rackId?.substring(0, 4)}
            </span>
          </div>
          <button
            className="grafana-modal-close"
            onClick={() => selectDevice(null)}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="grafana-modal-content">
          {/* Port View: SVG 있으면 실제 이미지, 없으면 그리드 */}
          {hasSvg ? (
            <SvgPortView
              modelName={device.modelName!}
              portStates={device.portStates}
            />
          ) : (
            <GenericPortGrid
              device={device}
              highlightedPortId={highlightedPortId}
            />
          )}

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              marginTop: "16px",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="grafana-status-dot grafana-status-dot-active" />
              <span style={{ color: "var(--text-secondary)" }}>
                Operational
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "var(--severity-critical)",
                  boxShadow: "0 0 6px var(--severity-critical)",
                }}
              />
              <span style={{ color: "var(--text-secondary)" }}>Error</span>
            </div>
          </div>

          {/* Active Faults – status === 'error' 포트만 표시 */}
          {errorPorts.length > 0 && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                backgroundColor: "var(--severity-critical-bg)",
                borderLeft: "4px solid var(--severity-critical)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <h4
                style={{
                  color: "var(--severity-critical-text)",
                  margin: "0 0 12px 0",
                  fontSize: "var(--font-size-md)",
                  fontWeight: "var(--font-weight-semibold)",
                }}
              >
                Active Faults
              </h4>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {errorPorts.map((err, idx) => (
                  <div
                    key={idx}
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "var(--font-size-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <strong style={{ color: "var(--severity-critical-text)" }}>
                      {err.portId}
                    </strong>
                    <span>{err.errorMessage}</span>
                    {err.errorLevel && (
                      <span
                        className={`grafana-badge ${severityBadgeClass[err.errorLevel] ?? ""}`}
                      >
                        {err.errorLevel.toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
