/**
 * DeviceSvgPreview — 재사용 가능한 장비 SVG 프리뷰 + 모듈 설정 컴포넌트
 *
 * DeviceModal과 RegistrationFormModal에서 공통으로 사용.
 * SVG 합성(베이스 + 카드 + 모듈) 및 포트 클릭 → 모듈 팝오버 처리.
 */
import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { equipmentModels, loadCardSvgRaw, loadCardSvgRawSync } from '../utils/cardAssets';
import { resolveDeviceSvgContent } from '../utils/deviceAssets';
import { generatePortMap } from '../utils/portUtils';
import type { GeneratedPort, InsertedCard, InsertedModule } from '../types/equipment';
import { moduleDefinitions, loadModuleSvgRaw } from '../utils/moduleAssets';

const CARD_ROW_HEIGHT = 46;

function getElementBBox(el: Element): { x: number; y: number; w: number; h: number } {
  const xAttr = el.getAttribute("x");
  const yAttr = el.getAttribute("y");
  const wAttr = el.getAttribute("width");
  const hAttr = el.getAttribute("height");
  if (xAttr && yAttr && wAttr && hAttr) {
    return { x: parseFloat(xAttr), y: parseFloat(yAttr), w: parseFloat(wAttr), h: parseFloat(hAttr) };
  }
  const d = el.getAttribute("d");
  if (d) {
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (nums && nums.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < nums.length; i += 2) {
        if (!isNaN(nums[i])) { minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]); }
        if (nums[i + 1] !== undefined && !isNaN(nums[i + 1])) { minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]); }
      }
      if (minX !== Infinity) return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
  const cx = el.getAttribute("cx"); const cy = el.getAttribute("cy"); const r = el.getAttribute("r");
  if (cx && cy && r) { const rv = parseFloat(r); return { x: parseFloat(cx) - rv, y: parseFloat(cy) - rv, w: rv * 2, h: rv * 2 }; }
  return { x: 0, y: 0, w: 20, h: 20 };
}

function prefixSvgIds(svgEl: Element, prefix: string) {
  const idMap = new Map<string, string>();
  svgEl.querySelectorAll("[id]").forEach((el) => {
    const oldId = el.getAttribute("id")!;
    if (oldId === "ports-layer" || oldId === "port-layer") return;
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    el.setAttribute("id", newId);
  });
  if (idMap.size === 0) return;
  svgEl.querySelectorAll("*").forEach((el) => {
    for (const attr of ["fill", "stroke", "clip-path", "mask", "filter"]) {
      const val = el.getAttribute(attr);
      if (val && val.includes("url(#")) {
        let updated = val;
        idMap.forEach((newId, oldId) => { updated = updated.replace(`url(#${oldId})`, `url(#${newId})`); });
        if (updated !== val) el.setAttribute(attr, updated);
      }
    }
    for (const attr of ["href", "xlink:href"]) {
      const val = el.getAttribute(attr);
      if (val && val.startsWith("#")) { const newId = idMap.get(val.slice(1)); if (newId) el.setAttribute(attr, `#${newId}`); }
    }
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

// ── 합성 캐시 ──
const _previewCache = new Map<string, string>();

export interface DeviceSvgPreviewProps {
  modelName?: string;
  insertedCards?: InsertedCard[];
  insertedModules?: InsertedModule[];
  onModuleChange?: (modules: InsertedModule[]) => void;
  /** true이면 포트 클릭으로 모듈 편집 가능 */
  editable?: boolean;
  maxWidth?: string;
}

export const DeviceSvgPreview = memo(({
  modelName,
  insertedCards = [],
  insertedModules = [],
  onModuleChange,
  editable = true,
  maxWidth = "100%",
}: DeviceSvgPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsKey = insertedCards.map(c => c.instanceId).join(',');
  const modulesKey = insertedModules.map(m => `${m.portId}:${m.moduleType}`).join(',');
  const cacheKey = `${modelName}::${cardsKey}::${modulesKey}`;

  const [composedHtml, setComposedHtml] = useState<string>(() => _previewCache.get(cacheKey) || "");

  const equipModel = useMemo(() => equipmentModels.find(m => m.modelName === modelName), [modelName]);

  // 카드 SVG
  const [cardSvgMap, setCardSvgMap] = useState<Map<string, string>>(() => {
    if (insertedCards.length === 0) return new Map();
    const uniqueFns = [...new Set(insertedCards.map(c => c.cardFileName))];
    const syncMap = new Map<string, string>();
    for (const fn of uniqueFns) { const cached = loadCardSvgRawSync(fn); if (cached) syncMap.set(fn, cached); }
    return syncMap.size === uniqueFns.length ? syncMap : new Map();
  });

  useEffect(() => {
    if (insertedCards.length === 0 || cardSvgMap.size > 0) return;
    let m = true;
    const uniqueFns = [...new Set(insertedCards.map(c => c.cardFileName))];
    Promise.all(uniqueFns.map(async fn => { const raw = await loadCardSvgRaw(fn); return [fn, raw] as const; }))
      .then(results => { if (!m) return; const map = new Map<string, string>(); for (const [fn, raw] of results) { if (raw) map.set(fn, raw); } setCardSvgMap(map); });
    return () => { m = false; };
  }, [insertedCards.length === 0 ? '' : cardsKey]);

  // SVG 합성
  useEffect(() => {
    if (!modelName) return;
    // 모듈이 없고 캐시 히트이면 스킵
    if (_previewCache.has(cacheKey) && insertedModules.length === 0) {
      if (composedHtml !== _previewCache.get(cacheKey)) setComposedHtml(_previewCache.get(cacheKey)!);
      return;
    }
    let isMounted = true;
    const compose = async () => {
      if (insertedCards.length > 0 && cardSvgMap.size === 0) return;
      try {
        const isModularDevice = insertedCards.length > 0;
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
        if (maxWidth) {
          baseSvgEl.style.maxWidth = maxWidth;
        }
        baseSvgEl.style.display = "block";

        // 카드 합성
        for (const card of insertedCards) {
          const raw = cardSvgMap.get(card.cardFileName);
          if (!raw || !equipModel) continue;
          const cardDoc = parser.parseFromString(raw, "image/svg+xml");
          const cardSvgEl = cardDoc.querySelector("svg");
          if (!cardSvgEl) continue;

          let x: number, y: number, cardW: number, cardH: number;
          if (equipModel.slots && card.slotId) {
            const slotDef = equipModel.slots.find(s => s.slotId === card.slotId);
            if (!slotDef || !equipModel.cardArea) continue;
            x = equipModel.cardArea.x + slotDef.x; y = equipModel.cardArea.y + slotDef.y;
            cardW = slotDef.width; cardH = slotDef.height;
          } else if (equipModel.rows && card.rowId && card.slotId) {
            const rowDef = equipModel.rows.find(r => r.rowId === card.rowId);
            if (!rowDef) continue;
            const subDef = rowDef.subSlots.find(s => s.slotId === card.slotId);
            if (!subDef) continue;
            x = rowDef.x + subDef.x; y = rowDef.y + subDef.y; cardW = subDef.width; cardH = subDef.height;
          } else if (equipModel.cardArea) {
            const row = Math.floor(card.positionIndex / equipModel.cardArea.columns);
            const col = card.positionIndex % equipModel.cardArea.columns;
            x = equipModel.cardArea.x + col * equipModel.cardArea.columnWidth;
            y = equipModel.cardArea.y + row * CARD_ROW_HEIGHT;
            cardW = card.widthType === "full" ? equipModel.cardArea.columnWidth * 2 : equipModel.cardArea.columnWidth;
            cardH = CARD_ROW_HEIGHT;
          } else continue;

          const vb = cardSvgEl.getAttribute("viewBox");
          const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 20];
          const origW = parts[2] || 100; const origH = parts[3] || 20;
          const instancePrefix = card.instanceId || `card-${card.positionIndex}`;
          prefixSvgIds(cardSvgEl, instancePrefix);

          const cardGroup = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
          cardGroup.setAttribute("transform", `translate(${x}, ${y}) scale(${cardW / origW}, ${cardH / origH})`);
          cardGroup.setAttribute("data-card-instance", instancePrefix);

          // 포트 히트박스 + 모듈
          cardSvgEl.querySelectorAll(".port-hitbox").forEach(hb => {
            const localPort = hb.getAttribute("data-local-port");
            if (!localPort) return;
            const realPortNumber = `${card.shelfNo}/${card.slotNo}/${localPort}`;
            hb.setAttribute("data-port-number", realPortNumber);
            hb.setAttribute("data-card-instance", instancePrefix);

            const mod = insertedModules.find(m => m.portId === realPortNumber);
            if (mod) {
              const moduleDef = moduleDefinitions.find(m => m.svgFileName === mod.moduleSvgFileName);
              if (moduleDef) {
                const bbox = getElementBBox(hb);
                const sf = 1.2;
                const fw = bbox.w * sf, fh = bbox.h * sf;
                const fx = bbox.x - (fw - bbox.w) / 2, fy = bbox.y - (fh - bbox.h) / 2;
                const img = baseDoc.createElementNS("http://www.w3.org/2000/svg", "image");
                img.setAttribute("href", moduleDef.svgUrl);
                img.setAttribute("x", fx.toString()); img.setAttribute("y", fy.toString());
                img.setAttribute("width", fw.toString()); img.setAttribute("height", fh.toString());
                img.setAttribute("preserveAspectRatio", "none");
                img.setAttribute("class", "inserted-module");
                img.style.pointerEvents = "none";
                hb.parentNode?.insertBefore(img, hb.nextSibling);
              }
            }
          });

          while (cardSvgEl.firstChild) cardGroup.appendChild(cardSvgEl.firstChild);
          baseSvgEl.appendChild(cardGroup);
        }

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);
        if (insertedModules.length === 0) _previewCache.set(cacheKey, finalHtml);
        if (isMounted) setComposedHtml(finalHtml);
      } catch (e) { console.error("DeviceSvgPreview compose error:", e); }
    };
    compose();
    return () => { isMounted = false; };
  }, [modelName, cardsKey, modulesKey, equipModel, cardSvgMap, cacheKey]);

  // 모듈 팝오버 상태
  const [popover, setPopover] = useState<{ portId: string; portType: string; x: number; y: number } | null>(null);

  // SVG 스타일 + 포트 인터랙션
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !composedHtml) return;

    const svgEl = container.querySelector("svg");
    if (svgEl) {
      if (!svgEl.getAttribute('viewBox')) {
        const w = svgEl.getAttribute('width') || '984';
        const h = svgEl.getAttribute('height') || '200';
        svgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
      }
      container.style.transform = "none";
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.maxWidth = maxWidth;
      svgEl.style.display = "block";
    }
    container.querySelectorAll("title").forEach(t => t.textContent = "");

    // 포트 요소 수집
    const allPortEls = Array.from(container.querySelectorAll("[id^='port-'], [id^='p'], .port-hitbox")).filter(el => {
      const id = (el as HTMLElement).id;
      if (el.classList.contains("port-hitbox")) return true;
      if (!id || id === "ports-layer" || id === "port-layer") return false;
      return id.startsWith("port-") || /^p\d+$/.test(id);
    }) as SVGElement[];

    allPortEls.forEach(el => {
      el.style.fill = "transparent";
      el.style.stroke = "none";
      el.style.pointerEvents = "all";
      el.style.cursor = editable ? "pointer" : "default";
      el.querySelectorAll("path, rect, circle, polyline, polygon").forEach(p => ((p as unknown) as SVGElement).style.pointerEvents = "none");
    });

    if (!editable) return;

    // hover 처리
    let hoveredEl: SVGElement | null = null;
    let origFill = "", origStroke = "", origStrokeWidth = "";

    const resetHover = () => {
      if (hoveredEl) {
        hoveredEl.style.fill = origFill; hoveredEl.style.stroke = origStroke; hoveredEl.style.strokeWidth = origStrokeWidth;
        hoveredEl = null;
      }
    };

    const findPortEl = (e: MouseEvent): SVGElement | null => {
      let target = e.target as unknown as SVGElement;
      if (target.classList.contains("port-hitbox")) return target;
      if (target.parentElement?.classList.contains("port-hitbox")) return target.parentElement as unknown as SVGElement;
      const isPort = (id: string) => (id.startsWith("port-") && id !== "ports-layer") || /^p\d+$/.test(id);
      if (target.id && isPort(target.id)) return target;
      if (target.parentElement?.id && isPort(target.parentElement.id)) return target.parentElement as unknown as SVGElement;
      return null;
    };

    const handleMouseOver = (e: MouseEvent) => {
      const portEl = findPortEl(e);
      if (!portEl) { resetHover(); return; }
      if (hoveredEl && hoveredEl !== portEl) resetHover();
      if (hoveredEl !== portEl) {
        hoveredEl = portEl;
        origFill = portEl.style.fill; origStroke = portEl.style.stroke; origStrokeWidth = portEl.style.strokeWidth;
        portEl.style.fill = "rgba(0, 229, 255, 0.25)";
        portEl.style.stroke = "rgba(0, 229, 255, 0.7)";
        portEl.style.strokeWidth = "1.5px";
      }
    };
    const handleMouseOut = () => resetHover();

    const handleClick = (e: MouseEvent) => {
      const portEl = findPortEl(e);
      if (!portEl) return;
      const portId = portEl.getAttribute("data-port-number") || portEl.id || "";
      if (!portId) return;
      const portType = portEl.getAttribute("data-port-type") || "port";
      const rect = portEl.getBoundingClientRect();
      setPopover({ portId, portType, x: rect.left + rect.width / 2, y: rect.top });
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [composedHtml, editable, maxWidth]);

  // 팝오버 외부 클릭 닫기
  useEffect(() => {
    if (!popover) return;
    const handle = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".module-popover")) return;
      setPopover(null);
    };
    const timer = setTimeout(() => window.addEventListener("click", handle, { capture: true }), 50);
    return () => { clearTimeout(timer); window.removeEventListener("click", handle, { capture: true }); };
  }, [popover]);

  const handleInsertModule = useCallback((portId: string, moduleType: InsertedModule["moduleType"]) => {
    const moduleDef = moduleDefinitions.find(m => m.moduleType === moduleType);
    if (!moduleDef) return;
    const newModule: InsertedModule = { portId, moduleType, moduleSvgFileName: moduleDef.svgFileName };
    const updated = [...insertedModules.filter(m => m.portId !== portId), newModule];
    onModuleChange?.(updated);
    setPopover(null);
  }, [insertedModules, onModuleChange]);

  const handleRemoveModule = useCallback((portId: string) => {
    onModuleChange?.(insertedModules.filter(m => m.portId !== portId));
    setPopover(null);
  }, [insertedModules, onModuleChange]);

  const existingModule = popover ? insertedModules.find(m => m.portId === popover.portId) : null;

  if (!modelName) return null;

  return (
    <>
      <div ref={containerRef} style={{ position: "relative", width: "100%", minWidth: 0 }} dangerouslySetInnerHTML={composedHtml ? { __html: composedHtml } : undefined} />

      {/* 모듈 팝오버 */}
      {popover && editable && (
        <div
          className="module-popover"
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", left: popover.x, top: popover.y - 8,
            transform: "translate(-50%, -100%)",
            backgroundColor: "rgba(10, 20, 40, 0.95)",
            border: "1px solid rgba(0, 229, 255, 0.4)",
            borderRadius: "12px", padding: "12px", zIndex: 10002,
            display: "flex", flexDirection: "column", gap: "8px",
            minWidth: "180px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 229, 255, 0.15)",
            backdropFilter: "blur(12px)", animation: "eam-fi .15s ease-out",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#80deea", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
            {popover.portType.toUpperCase()} — 모듈 선택
          </div>
          {existingModule && (
            <div style={{ fontSize: "11px", color: "#a5d6a7", padding: "4px 8px", borderRadius: "6px",
              backgroundColor: "rgba(76, 175, 80, 0.12)", border: "1px solid rgba(76, 175, 80, 0.25)", marginBottom: "2px" }}>
              현재: {existingModule.moduleType === "ethernet" ? "Ethernet" : "SFP"}
            </div>
          )}
          <div style={{ display: "flex", gap: "6px" }}>
            {moduleDefinitions.map(md => (
              <button key={md.moduleType} onClick={() => handleInsertModule(popover.portId, md.moduleType)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                  padding: "8px 6px", borderRadius: "8px",
                  border: existingModule?.moduleType === md.moduleType ? "1px solid #00e5ff" : "1px solid rgba(255,255,255,0.1)",
                  background: existingModule?.moduleType === md.moduleType ? "rgba(0, 229, 255, 0.1)" : "rgba(255,255,255,0.04)",
                  cursor: "pointer", color: "#e0f7fa", fontSize: "11px", fontWeight: "600", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0, 229, 255, 0.12)"; e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.5)"; }}
                onMouseLeave={e => {
                  if (existingModule?.moduleType !== md.moduleType) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }
                }}
              >
                <img src={md.svgUrl} alt={md.displayName} style={{ width: 28, height: 22, objectFit: "contain" }} />
                {md.displayName}
              </button>
            ))}
          </div>
          {existingModule && (
            <button onClick={() => handleRemoveModule(popover.portId)}
              style={{
                padding: "6px 12px", borderRadius: "6px",
                border: "1px solid rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.08)",
                color: "#ef4444", cursor: "pointer", fontSize: "11px", fontWeight: "600", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)"; }}
            >
              모듈 제거
            </button>
          )}
        </div>
      )}
    </>
  );
});
