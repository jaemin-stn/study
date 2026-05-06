import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { equipmentModels, loadCardSvgRaw, loadCardSvgRawSync } from '../utils/cardAssets';
import { resolveDeviceSvgContent } from '../utils/deviceAssets';
import {
  generatePortMap,
  buildPortStatusMapFromPortStates,
  applyPortStatuses,
} from '../utils/portUtils';
import type { GeneratedPort } from '../types/equipment';
import { ERROR_COLORS } from '../utils/errorHelpers';

// 외부 타입 임포트 에러 우회를 위해 내부 정의 사용
export interface PortState {
  portId: string;
  status: "normal" | "error";
  errorLevel?: "critical" | "major" | "minor" | "warning";
  errorMessage?: string;
  portName?: string;
  portNumber?: string;
}

export interface Device {
  itemId: string;
  rackId?: string;
  deviceId?: string;
  title: string;
  position: number;
  imageName?: string;
  size: number;
  type: string;
  modelName?: string;
  portStates: PortState[];
  insertedCards?: any[];
  dashboardThumbnailUrl?: string;
}

const CARD_ROW_HEIGHT = 46;

/** 포트 상태별 색상 (GeneratedPort.status 기준) */
const PORT_STATUS_COLORS: Record<string, string> = {
  normal: "transparent",
  critical: ERROR_COLORS.critical,
  warning: ERROR_COLORS.warning,
  disabled: "#666666",
};

const ensureKeyframe = (name: string, color: string) => {
  const styleId = `style-${name}`;
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    @keyframes ${name} {
      0% { fill: ${color}22; stroke: ${color}; stroke-width: 1px; }
      50% { fill: ${color}aa; stroke: ${color}; stroke-width: 3px; }
      100% { fill: ${color}22; stroke: ${color}; stroke-width: 1px; }
    }
  `;
  document.head.appendChild(style);
};

// 합성된 SVG HTML 모듈 레벨 캐시 (재열기 시 즉시 렌더링)
const _composedHtmlCache = new Map<string, string>();

const SvgPortView = memo(({ device, portStates }: { device: Device; portStates: PortState[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { modelName, insertedCards = [] } = device;
  // Phase 2: JSON.stringify 대신 instanceId 조합으로 경량 캐시 키 생성
  const cardsKey = insertedCards.map(c => c.instanceId).join(',');
  const _cacheKey = `${modelName}::${cardsKey}`;

  // 캐시에서 동기 초기화 → 재열기 시 첫 렌더에서 즉시 표시
  const [composedHtml, setComposedHtml] = useState<string>(() =>
    _composedHtmlCache.get(_cacheKey) || ""
  );

  const equipModel = useMemo(() => {
    return equipmentModels.find(m => m.modelName === modelName);
  }, [modelName]);

  // 모듈러 카드 장비인지 판별
  const isModularDevice = !!equipModel && insertedCards.length > 0;

  // 카드 SVG raw text 캐시 (동기 캐시 우선 시도)
  const [cardSvgMap, setCardSvgMap] = useState<Map<string, string>>(() => {
    if (!isModularDevice) return new Map();
    const uniqueFileNames = [...new Set(insertedCards.map((c: any) => c.cardFileName))];
    const syncMap = new Map<string, string>();
    for (const fn of uniqueFileNames) {
      const cached = loadCardSvgRawSync(fn);
      if (cached) syncMap.set(fn, cached);
    }
    return syncMap.size === uniqueFileNames.length ? syncMap : new Map();
  });

  // 카드 SVG async fallback (동기 캐시 미스 시에만 실행)
  useEffect(() => {
    if (!isModularDevice || cardSvgMap.size > 0) return;
    let isMounted = true;
    const uniqueFileNames = [...new Set(insertedCards.map((c: any) => c.cardFileName))];
    Promise.all(
      uniqueFileNames.map(async (fn) => {
        const raw = await loadCardSvgRaw(fn);
        return [fn, raw] as const;
      })
    ).then((results) => {
      if (!isMounted) return;
      const map = new Map<string, string>();
      for (const [fn, raw] of results) { if (raw) map.set(fn, raw); }
      setCardSvgMap(map);
    });
    return () => { isMounted = false; };
  }, [isModularDevice, cardsKey]);

  // generatePortMap 기반 포트 목록 생성
  const generatedPorts = useMemo<GeneratedPort[]>(() => {
    if (!isModularDevice || cardSvgMap.size === 0) return [];
    const ports = generatePortMap(insertedCards, cardSvgMap);
    // 기존 portStates에서 에러 상태 가져와 적용
    const statusMap = buildPortStatusMapFromPortStates(portStates);
    return applyPortStatuses(ports, statusMap);
  }, [isModularDevice, insertedCards, cardSvgMap, portStates]);

  // realPortNumber 기반 포트 맵 (모듈러)
  const generatedPortMap = useMemo(() =>
    new Map(generatedPorts.map(p => [p.realPortNumber, p])),
    [generatedPorts]
  );

  // 1단계: SVG 합성 (캐시 히트 시 스킵)
  useEffect(() => {
    if (_composedHtmlCache.has(_cacheKey)) return; // 이미 캐시에서 초기화됨
    let isMounted = true;
    const compose = async () => {
      try {
        const baseSvg = await resolveDeviceSvgContent(modelName);
        if (!isMounted || !baseSvg) return;

        if (!equipModel || !insertedCards || insertedCards.length === 0) {
          setComposedHtml(baseSvg);
          return;
        }

        // 모듈러 장비: 카드 SVG 미로드 시 base만 표시 (waterfall 방지)
        if (isModularDevice && cardSvgMap.size === 0) {
          setComposedHtml(baseSvg);
          return;
        }

        const parser = new DOMParser();
        const baseDoc = parser.parseFromString(baseSvg, "image/svg+xml");
        const baseSvgEl = baseDoc.querySelector("svg");
        if (!baseSvgEl) { setComposedHtml(baseSvg); return; }

        // cardSvgMap에서 동기적으로 조회 (중복 비동기 로드 제거)
        const cardResults = insertedCards.map((card) => ({
          card,
          raw: cardSvgMap.get(card.cardFileName),
        }));

        for (const { card, raw } of cardResults) {
          if (!raw) continue;
          const cardDoc = parser.parseFromString(raw, "image/svg+xml");
          const cardSvgEl = cardDoc.querySelector("svg");
          if (!cardSvgEl) continue;

          let x: number, y: number, cardW: number, cardH: number;

          // slots 모델: slotId로 좌표 결정
          if (equipModel.slots && card.slotId) {
            const slotDef = equipModel.slots.find(s => s.slotId === card.slotId);
            if (!slotDef || !equipModel.cardArea) continue;
            x = equipModel.cardArea.x + slotDef.x;
            y = equipModel.cardArea.y + slotDef.y;
            cardW = slotDef.width;
            cardH = slotDef.height;
          } else if (equipModel.rows && card.rowId && card.slotId) {
            // row-based 모델: rowId와 slotId로 결정
            const rowDef = equipModel.rows.find(r => r.rowId === card.rowId);
            if (!rowDef) continue;
            const subDef = rowDef.subSlots.find(s => s.slotId === card.slotId);
            if (!subDef) continue;
            x = rowDef.x + subDef.x;
            y = rowDef.y + subDef.y;
            cardW = subDef.width;
            cardH = subDef.height;
          } else if (equipModel.cardArea) {
            // uniform grid 모델
            const row = Math.floor(card.positionIndex / equipModel.cardArea.columns);
            const col = card.positionIndex % equipModel.cardArea.columns;
            x = equipModel.cardArea.x + col * equipModel.cardArea.columnWidth;
            y = equipModel.cardArea.y + row * CARD_ROW_HEIGHT;
            cardW = card.widthType === "full" ? equipModel.cardArea.columnWidth * 2 : equipModel.cardArea.columnWidth;
            cardH = CARD_ROW_HEIGHT;
          } else {
            continue; // fallback
          }

          const vb = cardSvgEl.getAttribute("viewBox");
          const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 20];
          const origW = parts[2] || 100;
          const origH = parts[3] || 20;

          // SVG id 충돌 방지: 카드 내부 id를 instanceId 기반으로 프리픽싱
          const instancePrefix = card.instanceId || `card-${card.positionIndex}`;
          prefixSvgIds(cardSvgEl, instancePrefix);

          // port-hitbox 요소에 data-port-number (realPortNumber) 주입
          const hitboxes = cardSvgEl.querySelectorAll(".port-hitbox");
          hitboxes.forEach((hb) => {
            const localPort = hb.getAttribute("data-local-port");
            if (localPort) {
              const realPortNumber = `${card.shelfNo}/${card.slotNo}/${localPort}`;
              hb.setAttribute("data-port-number", realPortNumber);
              hb.setAttribute("data-card-instance", instancePrefix);
            }
          });

          const g = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
          const scaleX = cardW / origW;
          const scaleY = cardH / origH;
          g.setAttribute("transform", `translate(${x}, ${y}) scale(${scaleX}, ${scaleY})`);
          g.setAttribute("data-card-instance", instancePrefix);

          while (cardSvgEl.firstChild) {
            g.appendChild(cardSvgEl.firstChild);
          }
          baseSvgEl.appendChild(g);
        }

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);
        _composedHtmlCache.set(_cacheKey, finalHtml);
        if (isMounted) setComposedHtml(finalHtml);
      } catch (e) {
        console.error("Compose Error:", e);
      }
    };
    compose();
    return () => { isMounted = false; };
  }, [modelName, cardsKey, equipModel, isModularDevice, cardSvgMap, _cacheKey]);

  // 기존 포트 에러 맵 (비-모듈러 장비용)
  const errorPortMap = useMemo(() => 
    new Map(portStates.filter(p => p.status === "error").map(p => [p.portId, p.errorLevel ? ERROR_COLORS[p.errorLevel] : "#ef4444"])),
    [portStates]
  );
  const portStateMap = useMemo(() => new Map(portStates.map(p => [p.portId, p])), [portStates]);

  // 2단계: SVG 스타일 조정 및 상호작용 바인딩
  // (dangerouslySetInnerHTML이 DOM 주입을 처리하므로 innerHTML 직접 설정 불필요)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !composedHtml) return;

    // 스타일 조정: 최초 1회만 실행 (해시 비교)
    const currentHash = _cacheKey + '::' + composedHtml.length;
    if (container.dataset.renderedHash !== currentHash) {
      container.dataset.renderedHash = currentHash;
      
      const svgEl = container.querySelector("svg");
      if (svgEl) {
        const containerWidth = 880;
        const svgWidth = svgEl.viewBox?.baseVal?.width || 984;
        const svgHeight = svgEl.viewBox?.baseVal?.height || 200;

        const scale = svgWidth > containerWidth ? containerWidth / svgWidth : 1;

        if (scale < 1) {
          container.style.transform = `scale(${scale})`;
          container.style.transformOrigin = "top center";
        } else {
          container.style.transform = "none";
        }

        if (container.parentElement) {
          container.parentElement.style.height = `${svgHeight * scale}px`;
          container.parentElement.style.overflow = "hidden";
        }

        svgEl.style.width = "auto";
        svgEl.style.height = "auto";
        svgEl.style.display = "block";
      }
      container.querySelectorAll("title").forEach(t => t.textContent = "");
    }

    // 포트 요소 수집 (모듈러 + 기존 방식 모두)
    const allPortEls = Array.from(container.querySelectorAll("[id^='port-'], [id^='p'], .port-hitbox")).filter(el => {
      const id = el.id;
      if (el.classList.contains("port-hitbox")) return true;
      if (!id || id === "ports-layer" || id === "port-layer") return false;
      return id.startsWith("port-") || /^p\d+$/.test(id);
    }) as SVGElement[];

    allPortEls.forEach((el: SVGElement) => {
      // 포트 상태 시각화 (모듈러 장비)
      if (el.classList.contains("port-hitbox")) {
        const realPortNumber = el.getAttribute("data-port-number");
        if (realPortNumber && isModularDevice) {
          const gp = generatedPortMap.get(realPortNumber);
          if (gp && gp.status !== "normal") {
            // 에러 상태 포트: 배경색 적용
            const color = PORT_STATUS_COLORS[gp.status] || "transparent";
            el.style.fill = `${color}33`;
            el.style.stroke = color;
            el.style.strokeWidth = "1.5px";
          } else {
            el.style.fill = "transparent";
            el.style.stroke = "none";
          }
        } else {
          el.style.fill = "transparent";
          el.style.stroke = "none";
        }
      }
      el.style.pointerEvents = "all";
      el.style.cursor = "pointer";
      el.querySelectorAll("path, rect, circle, polyline, polygon").forEach((p) => ((p as unknown) as SVGElement).style.pointerEvents = "none");
    });

    // 이벤트 위임
    const tooltip = document.querySelector(".port-tooltip") as HTMLElement;
    const handleMouseOver = (e: MouseEvent) => {
      let target = e.target as unknown as SVGElement;
      const isPort = (id: string) => (id.startsWith("port-") && id !== "ports-layer") || /^p\d+$/.test(id);
      let portEl: SVGElement | null = null;
      if (target.id && isPort(target.id)) portEl = target;
      else if (target.classList.contains("port-hitbox")) portEl = target;
      else if (target.parentElement?.id && isPort(target.parentElement.id)) portEl = target.parentElement as unknown as SVGElement;

      if (!portEl || !tooltip) return;

      const realPortNumber = portEl.getAttribute("data-port-number") || portEl.querySelector(".port-hitbox")?.getAttribute("data-port-number");
      const gp = realPortNumber && isModularDevice ? generatedPortMap.get(realPortNumber) : null;
      const rawId = realPortNumber || portEl.id;

      let pType = gp?.portType || 
                  portEl.getAttribute("data-port-type") || 
                  portEl.getAttribute("data-porttype") || 
                  portEl.querySelector(".port-hitbox")?.getAttribute("data-port-type") || 
                  "";
      let displayId = rawId;

      // 만약 여전히 pType이 빈 문자열이거나 "port"와 같은 일반적인 문자열이라면 속성이나 ID에서 유추 시도
      if (!pType || pType.toLowerCase() === "port") {
        const fallbackType = portEl.getAttribute("data-port-type") || 
                             portEl.getAttribute("data-porttype") || 
                             portEl.querySelector(".port-hitbox")?.getAttribute("data-port-type");
        if (fallbackType && fallbackType.toLowerCase() !== "port") {
          pType = fallbackType;
        } else {
          const idMatch = portEl.id.match(/port-(qsfp28|qsfp|sfp|console|mgmt|usb)-/i);
          if (idMatch) {
            pType = idMatch[1];
          }
        }
      }

      if (displayId.startsWith("port-")) {
        const parts = displayId.split("-");
        if (parts.length >= 3) {
          if (!pType) pType = parts[1];
          displayId = parts.slice(2).join("-");
        } else {
          displayId = displayId.replace(/^port-/, "");
        }
      } else if (/^p\d+$/.test(displayId)) {
        displayId = displayId.replace(/^p/, "");
      }

      const displayType = pType ? pType.toUpperCase() : "PORT";

      let statusStr = "NORMAL";
      let statusColor = "#22c55e";

      if (gp) {
        statusStr = gp.status.toUpperCase();
        statusColor = gp.status === "normal" ? "#22c55e"
          : gp.status === "critical" ? ERROR_COLORS.critical
          : gp.status === "warning" ? ERROR_COLORS.warning
          : "#888";
      } else {
        const ps = portStateMap.get(rawId);
        if (ps) {
          statusStr = ps.status.toUpperCase();
          const isError = ps.status === "error";
          // 지원하는 경우 에러 레벨 색상 매핑
          if (isError && ps.errorLevel && ERROR_COLORS[ps.errorLevel]) {
            statusColor = ERROR_COLORS[ps.errorLevel];
          } else {
            statusColor = isError ? "#ff4d4d" : "#22c55e";
          }
        }
      }

      tooltip.innerHTML = `
        <div style="font-weight:700; font-size:13px; margin-bottom:6px;">${displayType} ${displayId}</div>
        <div style="font-weight:600; color:${statusColor}; font-size:12px;">${statusStr}</div>
      `;
      tooltip.style.display = "block";
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 10}px`;
        tooltip.style.transform = "translate(-50%, -100%)";
      }
    };
    const handleMouseOut = () => { if (tooltip) tooltip.style.display = "none"; };

    // 포트 클릭 이벤트
    const handleClick = (e: MouseEvent) => {
      let target = e.target as unknown as SVGElement;
      let portEl: SVGElement | null = null;
      if (target.classList.contains("port-hitbox")) portEl = target;
      else if (target.parentElement?.classList.contains("port-hitbox")) portEl = target.parentElement as unknown as SVGElement;
      if (!portEl) return;

      const realPortNumber = portEl.getAttribute("data-port-number");
      const localPort = portEl.getAttribute("data-local-port");
      const portType = portEl.getAttribute("data-port-type");
      const cardInstance = portEl.getAttribute("data-card-instance");

      if (realPortNumber && isModularDevice) {
        const gp = generatedPortMap.get(realPortNumber);
        console.info("[DeviceModal] Port clicked:", {
          realPortNumber,
          localPort: gp?.localPort || localPort,
          cardInstanceId: gp?.cardInstanceId || cardInstance,
          portType: gp?.portType || portType,
          status: gp?.status || "normal",
        });
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);

    // 에러 블링킹 (모듈러 장비)
    if (isModularDevice) {
      generatedPorts.forEach((gp) => {
        if (gp.status === "normal") return;
        const color = PORT_STATUS_COLORS[gp.status] || "#ef4444";
        const el = container.querySelector(`[data-port-number='${gp.realPortNumber}']`) as SVGElement | null;
        if (el) {
          const animName = `blink-${gp.realPortNumber.replace(/[^a-z0-9]/gi, "-")}`;
          ensureKeyframe(animName, color);
          el.style.animation = `${animName} 1.5s infinite`;
        }
      });
    } else {
      // 비-모듈러 장비: 기존 에러 블링킹
      errorPortMap.forEach((color, portId) => {
        const el = container.querySelector(`[id='${portId}']`) as SVGElement | null;
        if (el) {
          const animName = `blink-${portId.replace(/[^a-z0-9]/gi, "-")}`;
          ensureKeyframe(animName, color);
          el.style.animation = `${animName} 1.5s infinite`;
        }
      });
    }

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [composedHtml, portStateMap, errorPortMap, isModularDevice, generatedPortMap, generatedPorts]);

  // 초기 렌더에서 캐시된 HTML을 dangerouslySetInnerHTML로 즉시 표시
  // → 리마운트 시에도 useEffect 실행 전에 SVG가 바로 보임
  return <div ref={containerRef} style={{ position: "relative" }} dangerouslySetInnerHTML={composedHtml ? { __html: composedHtml } : undefined} />;
}, (prevProps, nextProps) => {
  // Custom areEqual: 핵심 필드만 비교하여 불필요한 리렌더 방지
  if (prevProps.device === nextProps.device && prevProps.portStates === nextProps.portStates) return true;
  const pd = prevProps.device;
  const nd = nextProps.device;
  if (pd.itemId !== nd.itemId || pd.modelName !== nd.modelName) return false;
  // Phase 2: insertedCards 배열 길이 + 경계값 instanceId 비교 (O(1))
  if (pd.insertedCards?.length !== nd.insertedCards?.length) return false;
  if (pd.insertedCards?.length) {
    if (pd.insertedCards[0]?.instanceId !== nd.insertedCards![0]?.instanceId) return false;
    const pLast = pd.insertedCards[pd.insertedCards.length - 1];
    const nLast = nd.insertedCards![nd.insertedCards!.length - 1];
    if (pLast?.instanceId !== nLast?.instanceId) return false;
  }
  if (pd.dashboardThumbnailUrl !== nd.dashboardThumbnailUrl) return false;
  // portStates: 에러 상태만 비교 (길이 + 에러포트 내용)
  const prevErr = prevProps.portStates.filter(p => p.status === 'error');
  const nextErr = nextProps.portStates.filter(p => p.status === 'error');
  if (prevErr.length !== nextErr.length) return false;
  for (let i = 0; i < prevErr.length; i++) {
    if (prevErr[i].portId !== nextErr[i].portId || prevErr[i].errorLevel !== nextErr[i].errorLevel) return false;
  }
  return true;
});

/**
 * SVG 내부 id 속성들을 instancePrefix로 프리픽싱하여 충돌 방지.
 * id="foo" → id="instancePrefix-foo"
 * url(#foo) → url(#instancePrefix-foo)
 * href="#foo" → href="#instancePrefix-foo"
 */
function prefixSvgIds(svgEl: Element, prefix: string) {
  const idMap = new Map<string, string>();

  // 1차: 모든 id 수집 및 치환
  svgEl.querySelectorAll("[id]").forEach((el) => {
    const oldId = el.getAttribute("id")!;
    // ports-layer 같은 구조적 id는 제외
    if (oldId === "ports-layer" || oldId === "port-layer") return;
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    el.setAttribute("id", newId);
  });

  if (idMap.size === 0) return;

  // 2차: url(#id) 및 href="#id" 참조 갱신
  const allElements = svgEl.querySelectorAll("*");
  allElements.forEach((el) => {
    // fill, stroke, clip-path 등의 url(#id) 참조
    for (const attr of ["fill", "stroke", "clip-path", "mask", "filter"]) {
      const val = el.getAttribute(attr);
      if (val && val.includes("url(#")) {
        let updated = val;
        idMap.forEach((newId, oldId) => {
          updated = updated.replace(`url(#${oldId})`, `url(#${newId})`);
        });
        if (updated !== val) el.setAttribute(attr, updated);
      }
    }
    // xlink:href 및 href 참조
    for (const attr of ["href", "xlink:href"]) {
      const val = el.getAttribute(attr);
      if (val && val.startsWith("#")) {
        const refId = val.slice(1);
        const newId = idMap.get(refId);
        if (newId) el.setAttribute(attr, `#${newId}`);
      }
    }
    // style 속성 내 url(#id)
    const styleVal = el.getAttribute("style");
    if (styleVal && styleVal.includes("url(#")) {
      let updated = styleVal;
      idMap.forEach((newId, oldId) => {
        updated = updated.replace(new RegExp(`url\\(#${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'), `url(#${newId})`);
      });
      if (updated !== styleVal) el.setAttribute("style", updated);
    }
  });
}

export const DeviceModal = ({ deviceId, onClose }: { deviceId: string; onClose: () => void }) => {
  // Phase 1: racks 전체 대신 세분화된 셀렉터 — 이 device가 속한 rack의 devices만 구독
  const { rawDevice, rackName } = useStore(useShallow(useCallback((s) => {
    if (!deviceId) return { rawDevice: null, rackName: "" };
    for (const r of s.racks) {
      const d = r.devices.find(d => d.itemId === deviceId || d.deviceId === deviceId);
      if (d) return { rawDevice: d, rackName: r.rackTitle || `Rack ${r.rackId.slice(0, 4).toUpperCase()}` };
    }
    return { rawDevice: null, rackName: "" };
  }, [deviceId])));

  // Phase 1: device 참조 안정화 — 실제 데이터가 변하지 않으면 이전 참조 재사용
  const prevDeviceRef = useRef<{ device: Device | null; key: string }>({ device: null, key: "" });
  const device = useMemo(() => {
    if (!rawDevice) {
      prevDeviceRef.current = { device: null, key: "" };
      return null;
    }
    // 핵심 필드만 비교하여 불필요한 SvgPortView 리렌더 방지
    // Phase 2: JSON.stringify 대신 경량 필드 조합으로 키 생성
    const newKey = `${rawDevice.itemId}::${rawDevice.modelName}::${rawDevice.insertedCards?.length ?? 0}::${rawDevice.insertedCards?.[0]?.instanceId ?? ""}::${rawDevice.portStates.length}::${rawDevice.portStates.filter(p => p.status === 'error').length}::${rawDevice.dashboardThumbnailUrl?.length ?? 0}`;
    if (prevDeviceRef.current.key === newKey && prevDeviceRef.current.device) {
      return prevDeviceRef.current.device;
    }
    const stable = rawDevice as unknown as Device;
    prevDeviceRef.current = { device: stable, key: newKey };
    return stable;
  }, [rawDevice]);

  const devicePortStates = useMemo(() => device?.portStates || [], [device]);

  if (!device) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "var(--modal-backdrop)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(5px)"
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        backgroundColor: "var(--modal-bg)", borderRadius: "var(--radius-lg)", width: "940px", border: "1px solid var(--modal-border)", boxShadow: "var(--elevation-3)",
        maxHeight: "90vh", display: "flex", flexDirection: "column"
      }}>
        <div style={{ padding: "24px 24px 0 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: "20px", fontWeight: "600" }}>{device.title}</h2>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "24px", cursor: "pointer", lineHeight: "1" }}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ 
                backgroundColor: "var(--severity-success-bg)", 
                color: "var(--severity-success-text)", 
                padding: "2px 8px", 
                borderRadius: "12px", 
                fontSize: "12px", 
                fontWeight: "600",
                textTransform: "capitalize" 
              }}>
                {device.type || "Router"}
              </span>
              <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Rack: {rackName || device.rackId || "Unknown"}</span>
            </div>
          </div>
          <div style={{ margin: "0 -24px", borderBottom: "1px solid var(--border-medium)" }} />
        </div>

        <div style={{ padding: "20px 24px 24px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ 
            backgroundColor: "var(--bg-secondary)", 
            borderRadius: "var(--radius-md)", 
            border: "1px solid var(--border-medium)",
            padding: "16px",
            overflow: "hidden", 
            minHeight: "200px", 
            display: "flex", 
            alignItems: "flex-start", 
            justifyContent: "center" 
          }}>
            <SvgPortView device={device} portStates={devicePortStates} />
          </div>
        
        {/* Active Faults */}
        {(() => {
          const errorPorts = devicePortStates.filter((p) => p.status === "error");
          if (errorPorts.length === 0) return null;
          
          return (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                backgroundColor: "var(--bg-secondary)",
                borderLeft: "4px solid var(--text-secondary)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <h4
                style={{
                  color: "var(--text-primary)",
                  margin: "0 0 12px 0",
                  fontSize: "15px",
                  fontWeight: "600",
                }}
              >
                Active Faults
              </h4>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {errorPorts.map((err, idx) => {
                  const level = err.errorLevel || err.status || "error";
                  const badgeClass = 
                    level === "critical" ? "grafana-badge-critical" : 
                    level === "major" ? "grafana-badge-major" : 
                    level === "minor" ? "grafana-badge-minor" : 
                    level === "warning" ? "grafana-badge-warning" : "grafana-badge-critical";
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <strong style={{ color: "var(--text-primary)" }}>
                        {err.portId}
                      </strong>
                      <span>{err.errorMessage || "Unknown Error"}</span>
                      {level && (
                        <span className={`grafana-badge ${badgeClass}`}>
                          {level}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        </div>

        <div className="port-tooltip" style={{
          position: "fixed", pointerEvents: "none", display: "none", backgroundColor: "var(--panel-bg)",
          color: "var(--text-primary)", padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: "12px", zIndex: 10001, border: "1px solid var(--border-medium)", boxShadow: "var(--elevation-2)"
        }} />
      </div>
    </div>,
    document.body
  );
};
