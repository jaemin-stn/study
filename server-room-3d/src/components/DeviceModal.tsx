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
import type { GeneratedPort, InsertedModule, ModuleType } from '../types/equipment';
import { ERROR_COLORS } from '../utils/errorHelpers';
import { moduleDefinitions, loadModuleSvgRaw } from '../utils/moduleAssets';

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
  insertedModules?: InsertedModule[];
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

/**
 * SVG 요소(rect, path 등)에서 BBox(x, y, w, h)를 추출하거나 파싱하는 헬퍼
 */
function getElementBBox(el: Element): { x: number; y: number; w: number; h: number } {
  const xAttr = el.getAttribute("x");
  const yAttr = el.getAttribute("y");
  const wAttr = el.getAttribute("width");
  const hAttr = el.getAttribute("height");

  if (xAttr && yAttr && wAttr && hAttr) {
    return { 
      x: parseFloat(xAttr), 
      y: parseFloat(yAttr), 
      w: parseFloat(wAttr), 
      h: parseFloat(hAttr) 
    };
  }

  const d = el.getAttribute("d");
  if (d) {
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (nums && nums.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < nums.length; i += 2) {
        if (!isNaN(nums[i])) {
          minX = Math.min(minX, nums[i]);
          maxX = Math.max(maxX, nums[i]);
        }
        if (nums[i + 1] !== undefined && !isNaN(nums[i + 1])) {
          minY = Math.min(minY, nums[i + 1]);
          maxY = Math.max(maxY, nums[i + 1]);
        }
      }
      if (minX !== Infinity) {
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
    }
  }

  const cx = el.getAttribute("cx");
  const cy = el.getAttribute("cy");
  const r = el.getAttribute("r");
  if (cx && cy && r) {
    const rv = parseFloat(r);
    return { x: parseFloat(cx) - rv, y: parseFloat(cy) - rv, w: rv * 2, h: rv * 2 };
  }

  return { x: 0, y: 0, w: 20, h: 20 };
}

const SvgPortView = memo(({ device, portStates, tooltipRef }: { device: Device; portStates: PortState[]; tooltipRef: React.RefObject<HTMLDivElement> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { modelName, insertedCards = [] } = device;
  const cardsKey = insertedCards.map(c => c.instanceId).join(',');
  // 모듈 변경 식별을 위한 키 생성 (hitboxId 포함)
  const modulesKey = useMemo(() => 
    (device.insertedModules || [])
      .map(m => `${m.portId}-${m.moduleType}-${m.hitboxId || ""}`)
      .sort()
      .join(","),
    [device.insertedModules]
  );
  const _cacheKey = `${modelName}::${cardsKey}::${modulesKey}`;

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

  // 모듈 SVG raw text 캐시
  const [moduleSvgMap, setModuleSvgMap] = useState<Map<string, string>>(new Map());

  // 모듈 SVG 로드
  useEffect(() => {
    const modules = device.insertedModules || [];
    if (modules.length === 0) return;

    let isMounted = true;
    const uniqueFileNames = [...new Set(modules.map(m => m.moduleSvgFileName))];
    
    Promise.all(
      uniqueFileNames.map(async (fn) => {
        const raw = await loadModuleSvgRaw(fn);
        return [fn, raw] as const;
      })
    ).then((results) => {
      if (!isMounted) return;
      const map = new Map<string, string>();
      for (const [fn, raw] of results) { if (raw) map.set(fn, raw); }
      setModuleSvgMap(map);
    });
    return () => { isMounted = false; };
  }, [device.insertedModules]);

  // realPortNumber 기반 포트 맵 (모듈러)
  const generatedPortMap = useMemo(() =>
    new Map(generatedPorts.map(p => [p.realPortNumber, p])),
    [generatedPorts]
  );

  // 1단계: SVG 합성
  useEffect(() => {
    let isMounted = true;
    const compose = async () => {
      try {
        const targetModelName = isModularDevice && equipModel?.baseSvgUrl
          ? equipModel.baseSvgUrl.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "")
          : modelName;
        
        const baseSvg = await resolveDeviceSvgContent(targetModelName);
        if (!isMounted || !baseSvg) return;

        const parser = new DOMParser();
        const baseDoc = parser.parseFromString(baseSvg, "image/svg+xml");
        const baseSvgEl = baseDoc.querySelector("svg");
        if (!baseSvgEl) { setComposedHtml(baseSvg); return; }

        if (!baseSvgEl.getAttribute('viewBox')) {
          const w = baseSvgEl.getAttribute('width') || '984';
          const h = baseSvgEl.getAttribute('height') || '200';
          baseSvgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
        }
        baseSvgEl.setAttribute("width", "100%");
        baseSvgEl.setAttribute("height", "auto");
        baseSvgEl.style.maxWidth = "880px";
        baseSvgEl.style.display = "block";

        // 카드 합성
        const cardResults = insertedCards.map((card) => ({
          card,
          raw: cardSvgMap.get(card.cardFileName),
        }));

        const insertedModules = device.insertedModules || [];

        for (const { card, raw } of cardResults) {
          if (!raw || !equipModel) continue;
          const cardDoc = parser.parseFromString(raw, "image/svg+xml");
          const cardSvgEl = cardDoc.querySelector("svg");
          if (!cardSvgEl) continue;

          let x: number, y: number, cardW: number, cardH: number;

          if (equipModel.slots && card.slotId) {
            const slotDef = equipModel.slots.find(s => s.slotId === card.slotId);
            if (!slotDef || !equipModel.cardArea) continue;
            x = equipModel.cardArea.x + slotDef.x;
            y = equipModel.cardArea.y + slotDef.y;
            cardW = slotDef.width;
            cardH = slotDef.height;
          } else if (equipModel.rows && card.rowId && card.slotId) {
            const rowDef = equipModel.rows.find(r => r.rowId === card.rowId);
            if (!rowDef) continue;
            const subDef = rowDef.subSlots.find(s => s.slotId === card.slotId);
            if (!subDef) continue;
            x = rowDef.x + subDef.x;
            y = rowDef.y + subDef.y;
            cardW = subDef.width;
            cardH = subDef.height;
          } else if (equipModel.cardArea) {
            const row = Math.floor(card.positionIndex / equipModel.cardArea.columns);
            const col = card.positionIndex % equipModel.cardArea.columns;
            x = equipModel.cardArea.x + col * equipModel.cardArea.columnWidth;
            y = equipModel.cardArea.y + row * CARD_ROW_HEIGHT;
            cardW = card.widthType === "full" ? equipModel.cardArea.columnWidth * 2 : equipModel.cardArea.columnWidth;
            cardH = CARD_ROW_HEIGHT;
          } else {
            continue;
          }

          const vb = cardSvgEl.getAttribute("viewBox");
          const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 20];
          const origW = parts[2] || 100;
          const origH = parts[3] || 20;

          const instancePrefix = card.instanceId || `card-${card.positionIndex}`;
          prefixSvgIds(cardSvgEl, instancePrefix);

          const cardGroup = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
          const scaleX = cardW / origW;
          const scaleY = cardH / origH;
          cardGroup.setAttribute("transform", `translate(${x}, ${y}) scale(${scaleX}, ${scaleY})`);
          cardGroup.setAttribute("data-card-instance", instancePrefix);

          // 포트 히트박스 속성 처리 (카드 내 포트 식별용)
          const hitboxes = cardSvgEl.querySelectorAll(".port-hitbox");
          hitboxes.forEach((hb) => {
            const localPort = hb.getAttribute("data-local-port");
            if (!localPort) return;
            
            // 사용자의 제안대로 type + port 조합으로 고유 식별자 생성
            const portType = hb.getAttribute("data-port-type") || hb.getAttribute("data-porttype") || "";
            const uniquePortKey = portType ? `${portType}-${localPort}` : localPort;
            
            const realPortNumber = `${card.shelfNo}/${card.slotNo}/${uniquePortKey}`;
            hb.setAttribute("data-port-number", realPortNumber);
            hb.setAttribute("data-card-instance", instancePrefix);
          });

          while (cardSvgEl.firstChild) {
            cardGroup.appendChild(cardSvgEl.firstChild);
          }
          baseSvgEl.appendChild(cardGroup);
        }

        // 전체 포트에 대해 모듈 합성 (장비 기본 포트 + 카드 포트 모두 포함)
        const allPortEls = Array.from(baseSvgEl.querySelectorAll("[id*='port-'], [id^='p'], .port-hitbox")).filter(el => {
          const id = el.id;
          if (el.classList.contains("port-hitbox")) return true;
          if (!id || id === "ports-layer" || id === "port-layer") return false;
          return id.includes("port-") || /^p\d+$/.test(id);
        }) as SVGElement[];

        // 모든 포트 엘리먼트에 기본적으로 pointer-events="all" 부여 (상호작용 보장)
        allPortEls.forEach(el => {
          el.setAttribute("pointer-events", "all");
          if (el instanceof SVGElement) el.style.pointerEvents = "all";
        });

        const hitboxesByPortId = new Map<string, SVGElement[]>();
        allPortEls.forEach((hb) => {
          const portId = hb.getAttribute("data-port-number") || hb.id || hb.getAttribute("data-local-port");
          if (!portId) return;
          if (!hitboxesByPortId.has(portId)) hitboxesByPortId.set(portId, []);
          hitboxesByPortId.get(portId)!.push(hb);
        });

        // 삽입된 모든 모듈 렌더링
        insertedModules.forEach((module) => {
          const hbs = hitboxesByPortId.get(module.portId);
          if (!hbs || hbs.length === 0) return;

          const moduleDef = moduleDefinitions.find(m => m.svgFileName === module.moduleSvgFileName);
          if (moduleDef) {
            const modType = module.moduleType.toLowerCase();
            let targetHb = hbs[0];
            
            if (hbs.length > 1) {
              // 1순위: 클릭했던 정확한 hitboxId 우선 매칭
              if (module.hitboxId) {
                const exactHb = hbs.find(hb => hb.id === module.hitboxId);
                if (exactHb) {
                  targetHb = exactHb;
                } else {
                  // hitboxId 매칭 실패 시 fallback (모듈 타입 기반)
                  const exactMatch = hbs.find(hb => {
                    const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
                    if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
                    if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
                    return false;
                  });
                  if (exactMatch) targetHb = exactMatch;
                }
              } else {
                // 이전 방식 fallback (명시적 hitboxId가 없을 때)
                const exactMatch = hbs.find(hb => {
                  const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
                  if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
                  if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
                  return false;
                });
                if (exactMatch) targetHb = exactMatch;
              }
            }

            const bbox = getElementBBox(targetHb);
            const scaleFactor = 1.2;
            const finalW = bbox.w * scaleFactor;
            const finalH = bbox.h * scaleFactor;
            const finalX = bbox.x - (finalW - bbox.w) / 2;
            const finalY = bbox.y - (finalH - bbox.h) / 2;

            // <image> 태그 생성
            const img = baseDoc.createElementNS("http://www.w3.org/2000/svg", "image");
            img.setAttribute("href", moduleDef.svgUrl);
            img.setAttribute("x", finalX.toString());
            img.setAttribute("y", finalY.toString());
            img.setAttribute("width", finalW.toString());
            img.setAttribute("height", finalH.toString());
            img.setAttribute("preserveAspectRatio", "none"); 
            img.setAttribute("class", "inserted-module");
            img.setAttribute("data-port-id", module.portId);
            img.setAttribute("pointer-events", "none");
            img.style.pointerEvents = "none";
            
            const parent = targetHb.parentNode;
            if (parent) {
              parent.insertBefore(img, targetHb);
              // targetHb를 다시 appendChild 하여 이미지보다 뒤에 오게 함 (렌더링은 위에 됨)
              parent.appendChild(targetHb);
            }
          }
        });

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);
        _composedHtmlCache.set(_cacheKey, finalHtml);
        if (isMounted) setComposedHtml(finalHtml);
      } catch (e) {
        console.error("Compose Error:", e);
      }
    };
    compose();
    return () => { isMounted = false; };
  }, [modelName, cardsKey, equipModel, isModularDevice, cardSvgMap, moduleSvgMap, device.insertedModules, _cacheKey]);


  const portStateMap = useMemo(() => new Map(portStates.map(p => [p.portId, p])), [portStates]);

  // 2단계: SVG 스타일 조정 및 상호작용 바인딩
  // (dangerouslySetInnerHTML이 DOM 주입을 처리하므로 innerHTML 직접 설정 불필요)
  useEffect(() => {
    let activePortEl: SVGElement | null = null;
    const container = containerRef.current;
    if (!container || !composedHtml) return;

    const svgEl = container.querySelector("svg");
    if (svgEl) {
      // viewBox가 없는 SVG에 대해 viewBox 강제 주입
      if (!svgEl.getAttribute('viewBox')) {
        const w = svgEl.getAttribute('width') || '984';
        const h = svgEl.getAttribute('height') || '200';
        svgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
      }

      // 컨테이너 초기화 (transform scale 제거)
      container.style.transform = "none";
      
      if (container.parentElement) {
        // 강제로 설정했던 height 및 overflow 초기화 (Flexbox에 맡김)
        container.parentElement.style.height = "auto";
        container.parentElement.style.overflow = "visible";
      }

      // SVG 자체를 CSS로 자연스럽게 스케일링
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.maxWidth = "880px";
      svgEl.style.display = "block";
    }
    container.querySelectorAll("title").forEach(t => t.textContent = "");

    // 포트 요소 수집 (모듈러 + 기존 방식 모두)
    const allPortEls = Array.from(container.querySelectorAll("[id*='port-'], [id^='p'], .port-hitbox")).filter(el => {
      const id = el.id;
      if (el.classList.contains("port-hitbox")) return true;
      if (!id || id === "ports-layer" || id === "port-layer") return false;
      return id.includes("port-") || /^p\d+$/.test(id);
    }) as SVGElement[];

    allPortEls.forEach((el: SVGElement) => {
      // 포트 식별자 결정
      const realPortNumber = el.getAttribute("data-port-number");
      const localPort = el.getAttribute("data-local-port");
      const portId = realPortNumber || el.id || localPort || "";
      
      // 상태 시각화 (모듈러 및 일반 장비 모두)
      if (el.classList.contains("port-hitbox")) {
        if (portId) {
          const gp = generatedPortMap.get(portId);
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
    });



    const resetHover = () => {
      const tooltip = tooltipRef.current;
      if (activePortEl) {
        if (activePortEl.classList.contains("port-hitbox")) {
          const realPortNumber = activePortEl.getAttribute("data-port-number");
          const localPort = activePortEl.getAttribute("data-local-port");
          const portId = realPortNumber || activePortEl.id || localPort || "";
          
          if (portId) {
            const gp = generatedPortMap.get(portId);
            if (gp && gp.status !== "normal") {
              const color = PORT_STATUS_COLORS[gp.status] || "transparent";
              activePortEl.style.fill = `${color}33`;
              activePortEl.style.stroke = color;
              activePortEl.style.strokeWidth = "1.5px";
            } else {
              activePortEl.style.fill = "transparent";
              activePortEl.style.stroke = "none";
            }
          } else {
            activePortEl.style.fill = "transparent";
            activePortEl.style.stroke = "none";
          }
        } else {
          activePortEl.style.opacity = "1";
          activePortEl.style.filter = "none";
        }
        activePortEl = null;
      }
      if (tooltip) tooltip.style.display = "none";
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      const isPortId = (id: string) => (id.includes("port-") && id !== "ports-layer" && id !== "port-layer") || /^p\d+$/.test(id);
      
      const portEl = target.closest<SVGElement>("[id*='port-'], [id^='p'], .port-hitbox");
      if (portEl && portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) {
        // ID가 있지만 포트 식별자가 아닌 경우 (예: 다른 메타 요소) 무시
        resetHover();
        return;
      }

      // 포트 영역이 아닌 곳으로 이동 시 즉시 hover 해제
      if (!portEl) {
        resetHover();
        return;
      }
      
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (activePortEl !== portEl) {
        resetHover();
        activePortEl = portEl;
        
        if (portEl.classList.contains("port-hitbox")) {
          const currentFill = portEl.style.fill;
          if (currentFill === "transparent" || !currentFill) {
            portEl.style.fill = "rgba(0, 229, 255, 0.2)";
          } else {
            portEl.style.stroke = "rgba(0, 229, 255, 0.8)";
            portEl.style.strokeWidth = "2px";
          }
        } else {
          portEl.style.opacity = "0.7";
          portEl.style.filter = "drop-shadow(0 0 4px var(--primary-light))";
          portEl.style.cursor = "pointer";
        }
      }

      const realPortNumber = portEl.getAttribute("data-port-number");
      const localPort = portEl.getAttribute("data-local-port");
      const portId = realPortNumber || portEl.id || localPort || "";
      const gp = portId ? generatedPortMap.get(portId) : null;
      const rawId = portId;

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

      if (displayId.includes("port-")) {
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

      // 사용자의 지적대로 툴팁 표시 시 중복된 type 접두어 제거 (예: 1/7/sfp-26 -> 1/7/26)
      if (pType && displayId.includes(`${pType.toLowerCase()}-`)) {
        displayId = displayId.replace(`${pType.toLowerCase()}-`, "");
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
          if (isError && ps.errorLevel && ERROR_COLORS[ps.errorLevel]) {
            statusColor = ERROR_COLORS[ps.errorLevel];
          } else {
            statusColor = isError ? "#ff4d4d" : "#22c55e";
          }
        } else {
          // fallback: 에러 블링킹 시 스탬프된 data-error-level 확인
          const stampedLevel = portEl.getAttribute("data-error-level") as keyof typeof ERROR_COLORS | null;
          if (stampedLevel && ERROR_COLORS[stampedLevel]) {
            statusStr = stampedLevel.toUpperCase();
            statusColor = ERROR_COLORS[stampedLevel];
          }
        }
      }

      tooltip.innerHTML = `
        <div style="font-weight:700; font-size:13px; margin-bottom:6px; color:#80deea;">${displayType} ${displayId}</div>
        <div style="font-weight:600; color:${statusColor}; font-size:12px; text-shadow:0 0 4px ${statusColor}40;">${statusStr}</div>
      `;
      tooltip.style.display = "block";
    };
    const handleMouseMove = (e: MouseEvent) => {
      const tooltip = tooltipRef.current;
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 10}px`;
        tooltip.style.transform = "translate(-50%, -100%)";
      }
    };
    const handleMouseOut = () => resetHover();

    // 포트 클릭 이벤트 → 모듈 삽입 팝오버 표시
    const handleClick = (e: MouseEvent) => {
      e.stopPropagation(); // 이벤트 전파 중단하여 window 클릭 리스너와의 충돌 방지
      const target = e.target as SVGElement;
      const isPortId = (id: string) => (id.includes("port-") && id !== "ports-layer" && id !== "port-layer") || /^p\d+$/.test(id);
      
      const portEl = target.closest<SVGElement>("[id*='port-'], [id^='p'], .port-hitbox");
      if (!portEl) return;
      if (portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) return;

      const realPortNumber = portEl.getAttribute("data-port-number");
      const localPort = portEl.getAttribute("data-local-port");
      const portType = portEl.getAttribute("data-port-type");

      // 포트 식별자 결정
      const portId = realPortNumber || portEl.id || localPort || "";
      if (!portId) return;

      // 포트 위치 계산 (SVG 컨테이너 기준)
      const rect = portEl.getBoundingClientRect();
      const popoverEvent = new CustomEvent("port-module-popover", {
        bubbles: true, // 이벤트가 상위로 전달되도록 설정
        detail: {
          portId,
          portType: portType || "port",
          hitboxId: portEl.id,
          x: rect.left + rect.width / 2,
          y: rect.top,
        },
      });
      container.dispatchEvent(popoverEvent);
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
          el.setAttribute("data-error-level", gp.status);
        }
      });
    } else {
      // 비-모듈러 장비: 기존 에러 블링킹 + data-error-level 스탬프
      portStates.filter(p => p.status === "error").forEach((ps) => {
        const color = ps.errorLevel && ERROR_COLORS[ps.errorLevel] ? ERROR_COLORS[ps.errorLevel] : "#ef4444";
        const el = container.querySelector(`[id='${ps.portId}']`) as SVGElement | null;
        if (el) {
          const animName = `blink-${ps.portId.replace(/[^a-z0-9]/gi, "-")}`;
          ensureKeyframe(animName, color);
          el.style.animation = `${animName} 1.5s infinite`;
          el.setAttribute("data-error-level", ps.errorLevel || "critical");
        }
      });
    }

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [composedHtml, portStateMap, portStates, isModularDevice, generatedPortMap, generatedPorts]);

  // 초기 렌더에서 캐시된 HTML을 dangerouslySetInnerHTML로 즉시 표시
  // → 리마운트 시에도 useEffect 실행 전에 SVG가 바로 보임
  return <div ref={containerRef} style={{ position: "relative", width: "100%", minWidth: 0 }} dangerouslySetInnerHTML={composedHtml ? { __html: composedHtml } : undefined} />;
}); // memo 비교 함수 제거하여 반응성 극대화

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
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Phase 1: racks 전체 대신 세분화된 셀렉터 — 이 device가 속한 rack의 devices만 구독
  const { rawDevice, rackName } = useStore(useShallow(useCallback((s) => {
    if (!deviceId) return { rawDevice: null, rackName: "" };
    for (const r of s.racks) {
      const d = r.devices.find(d => d.itemId === deviceId || d.deviceId === deviceId);
      if (d) return { rawDevice: d, rackName: r.rackTitle || `Rack ${r.rackId.slice(0, 4).toUpperCase()}` };
    }
    return { rawDevice: null, rackName: "" };
  }, [deviceId])));

  const updateRegisteredDevice = useStore((s) => s.updateRegisteredDevice);

  // Phase 1: device 참조 안정화 — 실제 데이터가 변하지 않으면 이전 참조 재사용
  const prevDeviceRef = useRef<{ device: Device | null; key: string }>({ device: null, key: "" });
  const device = useMemo(() => {
    if (!rawDevice) {
      prevDeviceRef.current = { device: null, key: "" };
      return null;
    }
    // 핵심 필드만 비교하여 불필요한 SvgPortView 리렌더 방지
    // Phase 2: JSON.stringify 대신 경량 필드 조합으로 키 생성
    const newKey = `${rawDevice.itemId}::${rawDevice.modelName}::${rawDevice.insertedCards?.length ?? 0}::${rawDevice.insertedCards?.[0]?.instanceId ?? ""}::${rawDevice.portStates.length}::${rawDevice.portStates.filter(p => p.status === 'error').length}::${rawDevice.dashboardThumbnailUrl?.length ?? 0}::${rawDevice.insertedModules?.length ?? 0}`;
    if (prevDeviceRef.current.key === newKey && prevDeviceRef.current.device) {
      return prevDeviceRef.current.device;
    }
    const stable = rawDevice as unknown as Device;
    prevDeviceRef.current = { device: stable, key: newKey };
    return stable;
  }, [rawDevice]);

  const devicePortStates = useMemo(() => device?.portStates || [], [device]);

  // 모듈 팝오버 상태
  const [modulePopover, setModulePopover] = useState<{
    portId: string;
    portType: string;
    hitboxId?: string;
    x: number;
    y: number;
  } | null>(null);

  // 삽입된 모듈 상태 (로컬 → store 동기화)
  const [localModules, setLocalModules] = useState<InsertedModule[]>([]);

  // 초기화: device의 insertedModules를 로컬 상태로 복사
  useEffect(() => {
    if (device?.insertedModules) {
      setLocalModules(device.insertedModules);
    } else {
      setLocalModules([]);
    }
  }, [device?.itemId]);

  // device + localModules 합성: localModules 변경 시 즉시 SvgPortView에 반영
  const deviceWithModules = useMemo(() => {
    if (!device) return null;
    return { ...device, insertedModules: localModules };
  }, [device, localModules]);

  // SVG 컨테이너에서 port-module-popover 이벤트 수신
  const svgContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;

    const handlePopover = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setModulePopover(detail);
    };

    // SvgPortView의 containerRef가 이 div 안에 있으므로 이벤트 버블링으로 받음
    container.addEventListener("port-module-popover", handlePopover);
    return () => container.removeEventListener("port-module-popover", handlePopover);
  }, []);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!modulePopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 팝오버 내부이거나, 다른 포트를 클릭한 경우 닫기 로직 수행 안 함
      if (target.closest(".module-popover, .port-hitbox, [id*='port-'], [id^='p']")) return;
      setModulePopover(null);
    };
    // 약간의 딜레이를 주어 클릭 이벤트가 전파된 후에 리스너 등록
    const timer = setTimeout(() => {
      window.addEventListener("click", handleClickOutside, { capture: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClickOutside, { capture: true });
    };
  }, [modulePopover]);

  // 모듈 삽입
  const handleInsertModule = useCallback((portId: string, moduleType: ModuleType, hitboxId?: string) => {
    const moduleDef = moduleDefinitions.find(m => m.moduleType === moduleType);
    if (!moduleDef) return;

    const newModule: InsertedModule = {
      portId,
      moduleType,
      moduleSvgFileName: moduleDef.svgFileName,
      hitboxId
    };

    setLocalModules(prev => {
      const filtered = prev.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId);
      return [...filtered, newModule];
    });
    setModulePopover(null);

    // Store에 저장
    if (device?.deviceId) {
      const currentModules = device.insertedModules || [];
      const updated = [...currentModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId), newModule];
      updateRegisteredDevice(device.deviceId, { insertedModules: updated });
    }
  }, [device, updateRegisteredDevice]);

  // 모듈 제거
  const handleRemoveModule = useCallback((portId: string, hitboxId?: string) => {
    setLocalModules(prev => prev.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId));
    setModulePopover(null);

    // Store에서 제거
    if (device?.deviceId) {
      const currentModules = device.insertedModules || [];
      const updated = currentModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId);
      updateRegisteredDevice(device.deviceId, { insertedModules: updated });
    }
  }, [device, updateRegisteredDevice]);

  // 해당 포트에 삽입된 모듈 조회
  const getModuleForPort = useCallback((portId: string, hitboxId?: string) => {
    return localModules.find(m => hitboxId ? m.hitboxId === hitboxId : m.portId === portId);
  }, [localModules]);

  if (!device || !deviceWithModules) return null;

  const existingModule = modulePopover ? getModuleForPort(modulePopover.portId, modulePopover.hitboxId) : null;

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
                border: "1px solid var(--severity-success-border)",
                padding: "2px 10px", 
                borderRadius: "12px", 
                fontSize: "12px", 
                fontWeight: "700",
                textTransform: "capitalize",
                letterSpacing: "0.03em"
              }}>
                {device.type || "Router"}
              </span>
              <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Rack: {rackName || device.rackId || "Unknown"}</span>
              {localModules.length > 0 && (
                <span style={{
                  backgroundColor: "rgba(0, 229, 255, 0.1)",
                  color: "#00e5ff",
                  border: "1px solid rgba(0, 229, 255, 0.3)",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}>
                  모듈 {localModules.length}개
                </span>
              )}
            </div>
          </div>
          <div style={{ margin: "0 -24px", borderBottom: "1px solid var(--border-medium)" }} />
        </div>

        <div style={{ padding: "20px 24px 24px 24px", overflowY: "auto", flex: 1, minWidth: 0 }}>
          <div style={{ 
            backgroundColor: "var(--bg-secondary)", 
            borderRadius: "var(--radius-md)", 
            border: "1px solid var(--border-medium)",
            padding: "16px",
            overflow: "visible", 
            minHeight: "auto", 
            display: "flex", 
            alignItems: "flex-start", 
            justifyContent: "center",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            minWidth: 0
          }}>
            <div ref={svgContainerRef} style={{ width: "100%", maxWidth: "880px", display: "flex", justifyContent: "center", minWidth: 0 }}>
              <SvgPortView device={deviceWithModules} portStates={devicePortStates} tooltipRef={tooltipRef as React.RefObject<HTMLDivElement>} />
            </div>
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

        <div ref={tooltipRef} className="port-tooltip" style={{
          position: "fixed", pointerEvents: "none", display: "none",
          backgroundColor: "rgba(4, 15, 33, 0.92)",
          color: "#e0f7fa",
          padding: "8px 14px",
          borderRadius: "4px",
          fontSize: "12px",
          zIndex: 10001,
          border: "1px solid rgba(0, 229, 255, 0.6)",
          boxShadow: "0 0 12px rgba(0, 229, 255, 0.3), 0 0 4px rgba(0, 229, 255, 0.15), inset 0 0 8px rgba(0, 229, 255, 0.05)",
          backdropFilter: "blur(8px)",
        }} />
      </div>

      {/* 모듈 선택 팝오버 */}
      {modulePopover && (
        <div
          className="module-popover"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: modulePopover.x,
            top: modulePopover.y < 150 ? modulePopover.y + 24 : modulePopover.y - 8,
            transform: modulePopover.y < 150 ? "translate(-50%, 0)" : "translate(-50%, -100%)",
            backgroundColor: "rgba(10, 20, 40, 0.95)",
            border: "1px solid rgba(0, 229, 255, 0.4)",
            borderRadius: "12px",
            padding: "12px",
            zIndex: 10002,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minWidth: "180px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 229, 255, 0.15)",
            backdropFilter: "blur(12px)",
            animation: "eam-fi .15s ease-out",
          }}
        >
          <div style={{
            fontSize: "11px",
            fontWeight: "700",
            color: "#80deea",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "2px",
          }}>
            {modulePopover.portType.toUpperCase()} — 모듈 선택
          </div>

          {existingModule && (
            <div style={{
              fontSize: "11px",
              color: "#a5d6a7",
              padding: "4px 8px",
              borderRadius: "6px",
              backgroundColor: "rgba(76, 175, 80, 0.12)",
              border: "1px solid rgba(76, 175, 80, 0.25)",
              marginBottom: "2px",
            }}>
              현재: {existingModule.moduleType === "ethernet" ? "Ethernet" : "SFP"}
            </div>
          )}

          <div style={{ display: "flex", gap: "6px" }}>
            {moduleDefinitions.map((md) => (
              <button
                key={md.moduleType}
                onClick={() => handleInsertModule(modulePopover.portId, md.moduleType, modulePopover.hitboxId)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 6px",
                  borderRadius: "8px",
                  border: existingModule?.moduleType === md.moduleType
                    ? "1px solid #00e5ff"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: existingModule?.moduleType === md.moduleType
                    ? "rgba(0, 229, 255, 0.1)"
                    : "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  color: "#e0f7fa",
                  fontSize: "11px",
                  fontWeight: "600",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0, 229, 255, 0.12)";
                  e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.5)";
                }}
                onMouseLeave={(e) => {
                  if (existingModule?.moduleType !== md.moduleType) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }
                }}
              >
                <img
                  src={md.svgUrl}
                  alt={md.displayName}
                  style={{ width: 28, height: 22, objectFit: "contain" }}
                />
                {md.displayName}
              </button>
            ))}
          </div>

          {existingModule && (
            <button
              onClick={() => handleRemoveModule(modulePopover.portId, modulePopover.hitboxId)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                background: "rgba(239, 68, 68, 0.08)",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "600",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
              }}
            >
              모듈 제거
            </button>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

