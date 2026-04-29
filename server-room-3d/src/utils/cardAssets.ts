/**
 * Card Asset Resolver
 *
 * Vite import.meta.glob으로 카드 SVG를 동적 로드.
 * 지원 카드 패턴:
 *   - "R-series-{n}-{half|full}.svg"  → R4/R6 전용 카드
 *   - "CPIOM-{widthType}.svg"         → CPIOM 전용 카드 (R6d/R6dl)
 *   - "MDAs-{n}-{half|full}.svg"      → MDAs 카드 (R6d/R6dl)
 */

import type {
  CardDefinition,
  CardWidthType,
  EquipmentModel,
} from "../types/equipment";

// ── 카드 SVG: img 태그용 URL 가져오기 (라이브러리 미리보기) ────────────────
const cardUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/R-series-*.svg",
  { eager: true },
);
const cpiomUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/CPIOM-*.svg",
  { eager: true },
);
const mdasUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/MDAs-*.svg",
  { eager: true },
);

// ── 카드 SVG: raw text (인라인 SVG 렌더링용) ────────────────────────────
const cardRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/R-series-*.svg",
  { query: "?raw" },
);
const cpiomRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/CPIOM-*.svg",
  { query: "?raw" },
);
const mdasRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/MDAs-*.svg",
  { query: "?raw" },
);

// ── Base 장비 SVG: raw text ─────────────────────────────────────────────
const baseEquipRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/*.svg",
  { query: "?raw" },
);

const baseEquipUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/*.svg",
  { eager: true },
);

/** 파일명에서 widthType 추출 */
function parseWidthType(filename: string): CardWidthType {
  if (filename.includes("-full")) return "full";
  return "half";
}

/** 파일명에서 cardType 추출 (e.g. "R-series-1-half.svg" → "R-series-1") */
function parseCardType(filename: string): string {
  return filename
    .replace(/\.svg$/i, "")
    .replace(/-(half|full)$/, "");
}

/** SVG URL에서 width/height 추출 (SVG 컨텐츠에서) */
function parseSvgDimensionsFromUrl(url: string): { width: number; height: number } {
  // 기본값: half=430x46, full=860x46
  const isFullWidth = url.includes("-full");
  return {
    width: isFullWidth ? 860 : 430,
    height: 46,
  };
}

// ── 카드 정의 빌드 ─────────────────────────────────────────────────────
const _cardDefinitions: CardDefinition[] = [];

// --- R-series 카드 ---
for (const [path, mod] of Object.entries(cardUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("R-series-")) continue;

  const widthType = parseWidthType(filename);
  const cardType = parseCardType(filename);
  const dims = parseSvgDimensionsFromUrl(filename);

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    svgWidth: dims.width,
    svgHeight: dims.height,
  });
}

// --- CPIOM 카드 ---
for (const [path, mod] of Object.entries(cpiomUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("CPIOM-")) continue;

  const widthType: CardWidthType = "full";
  const cardType = filename.replace(/\.svg$/i, ""); // e.g. "CPIOM-full"

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "cpiom",
    cardSizeType: "cpiom-828x72",
    svgWidth: 828,
    svgHeight: 72,
  });
}

// --- MDAs 카드 ---
for (const [path, mod] of Object.entries(mdasUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("MDAs-")) continue;

  const widthType = parseWidthType(filename);
  const cardType = parseCardType(filename); // e.g. "MDAs-1"

  const isHalf = widthType === "half";
  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "standard",
    cardSizeType: isHalf ? "half-414x77" : "full-828x80",
    svgWidth: isHalf ? 414 : 828,
    svgHeight: 77,
  });
}

// 정렬: half → full, 이름순
_cardDefinitions.sort((a, b) => {
  if (a.widthType !== b.widthType) {
    return a.widthType === "half" ? -1 : 1;
  }
  return a.cardFileName.localeCompare(b.cardFileName, undefined, { numeric: true });
});

export const cardDefinitions: CardDefinition[] = _cardDefinitions;

/**
 * R6 전용 카드 파일명 목록 (R4 등 다른 모델에서는 사용 불가)
 * R-series-9-full.svg는 860×46이지만 R6 full slot (860×71) 전용.
 */
const R6_ONLY_CARD_FILENAMES = new Set([
  "R-series-9-full.svg",
]);

/**
 * 모델에 맞는 카드 목록 필터링.
 * - slots 모델: 슬롯 accepts/allowedCardGroups에 매칭되는 카드만 반환
 * - uniform grid 모델: R6 전용 카드 제외
 */
export function getCardsForModel(model: EquipmentModel): CardDefinition[] {
  if (model.slots) {
    // 모든 슬롯의 accepts와 allowedCardGroups 합산
    const allAccepts = new Set<string>();
    const allGroups = new Set<string>();
    model.slots.forEach(s => {
      s.accepts.forEach(a => allAccepts.add(a));
      s.allowedCardGroups?.forEach(g => allGroups.add(g));
    });

    return cardDefinitions.filter(cd => {
      // cardSizeType이 있으면 그걸로, 없으면 widthType으로 매칭
      const sizeKey = cd.cardSizeType || cd.widthType;
      const sizeOk = allAccepts.has(sizeKey);
      // cardGroup이 있으면 그걸로, 없으면 그룹 필터 스킵
      const groupOk = !allGroups.size || !cd.cardGroup || allGroups.has(cd.cardGroup);
      return sizeOk && groupOk;
    });
  }
  // uniform grid 모델: R6 전용 카드 제외, CPIOM/MDAs도 제외
  return cardDefinitions.filter(cd =>
    !R6_ONLY_CARD_FILENAMES.has(cd.cardFileName) &&
    !cd.cardGroup // R-series 카드만 (cardGroup 미지정)
  );
}

/**
 * 카드 SVG raw text 로드 (인라인 렌더링용)
 * R-series, CPIOM, MDAs 모든 카드 타입 지원
 */
export async function loadCardSvgRaw(cardFileName: string): Promise<string | undefined> {
  // 모든 카드 raw 모듈 소스를 순차 검색
  const allRawSources = [cardRawModules, cpiomRawModules, mdasRawModules];

  for (const rawModules of allRawSources) {
    for (const [path, importFn] of Object.entries(rawModules)) {
      const fn = path.split("/").pop() ?? "";
      if (fn === cardFileName) {
        try {
          const mod = await importFn();
          return mod.default;
        } catch (err) {
          console.error("Failed to load card SVG:", cardFileName, err);
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/**
 * Base 장비 SVG raw text 로드
 */
export async function loadBaseEquipmentSvgRaw(baseSvgUrl: string): Promise<string | undefined> {
  // baseSvgUrl 예: "[2U] 7250 IXR-R4-CARD.svg"
  for (const [path, importFn] of Object.entries(baseEquipRawModules)) {
    const fn = path.split("/").pop() ?? "";
    if (fn === baseSvgUrl) {
      try {
        const mod = await importFn();
        return mod.default;
      } catch (err) {
        console.error("Failed to load base equipment SVG:", baseSvgUrl, err);
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * Base 장비 SVG URL (img 태그용)
 */
export function getBaseEquipmentSvgUrl(baseSvgUrl: string): string | undefined {
  for (const [path, mod] of Object.entries(baseEquipUrlModules)) {
    const fn = path.split("/").pop() ?? "";
    if (fn === baseSvgUrl) {
      return mod.default;
    }
  }
  return undefined;
}

// ── 장비 모델 목록 ─────────────────────────────────────────────────────
export const equipmentModels: EquipmentModel[] = [
  {
    modelId: "7250-ixr-r4",
    modelName: "7250 IXR-R4",
    baseSvgUrl: "[2U] 7250 IXR-R4-CARD.svg",
    cardArea: {
      x: 104,
      y: 4,
      width: 860,
      height: 184,
      columns: 2,
      columnWidth: 430,
    },
  },
  {
    modelId: "7250-ixr-r6",
    modelName: "7250 IXR-R6",
    baseSvgUrl: "[3U] 7250 IXR-R6-CARD.svg",
    cardArea: {
      x: 104,
      y: 4,
      width: 860,
      height: 280,
      columns: 2,
      columnWidth: 430,
    },
    slots: [
      // Row 1-2: full-width 860×71
      { slotId: "row-1-full", row: 1, col: 1, x: 0, y: 0, width: 860, height: 71, slotType: "full-860x71", accepts: ["full"] },
      { slotId: "row-2-full", row: 2, col: 1, x: 0, y: 71, width: 860, height: 71, slotType: "full-860x71", accepts: ["full"] },
      // Row 3-5: half-width 430×46
      { slotId: "row-3-left",  row: 3, col: 1, x: 0,   y: 142, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
      { slotId: "row-3-right", row: 3, col: 2, x: 430, y: 142, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
      { slotId: "row-4-left",  row: 4, col: 1, x: 0,   y: 188, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
      { slotId: "row-4-right", row: 4, col: 2, x: 430, y: 188, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
      { slotId: "row-5-left",  row: 5, col: 1, x: 0,   y: 234, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
      { slotId: "row-5-right", row: 5, col: 2, x: 430, y: 234, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
    ],
  },
  // ── 7250 IXR-R6d (4U) ──────────────────────────────────────────────────
  {
    modelId: "7250-ixr-r6d",
    modelName: "7250 IXR-R6d",
    rackUnit: "4U",
    baseSvgUrl: "[4U] 7250 IXR-R6d-CARD.svg",
    cardArea: {
      x: 136,
      y: 2,
      width: 828,
      height: 375,
      columns: 2,
      columnWidth: 414,
    },
    slots: [
      // Row 1-2: CPIOM only (828×72)
      { slotId: "r6d-row-1", row: 1, x: 0, y: 0, width: 828, height: 72, slotType: "full-828x72", allowedCardGroups: ["cpiom"], accepts: ["cpiom-828x72"] },
      { slotId: "r6d-row-2", row: 2, x: 0, y: 72, width: 828, height: 72, slotType: "full-828x72", allowedCardGroups: ["cpiom"], accepts: ["cpiom-828x72"] },
      // Row 3-5: Standard — half(414×77) OR full(828×77) 선택 가능 (상호 배제)
      { slotId: "r6d-row-3-full",  row: 3, x: 0, y: 144, width: 828, height: 77, slotType: "full-828x77", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      { slotId: "r6d-row-3-left",  row: 3, col: 1, x: 0,   y: 144, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
      { slotId: "r6d-row-3-right", row: 3, col: 2, x: 414, y: 144, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
      { slotId: "r6d-row-4-full",  row: 4, x: 0, y: 221, width: 828, height: 77, slotType: "full-828x77", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      { slotId: "r6d-row-4-left",  row: 4, col: 1, x: 0,   y: 221, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
      { slotId: "r6d-row-4-right", row: 4, col: 2, x: 414, y: 221, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
      { slotId: "r6d-row-5-full",  row: 5, x: 0, y: 298, width: 828, height: 77, slotType: "full-828x77", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      { slotId: "r6d-row-5-left",  row: 5, col: 1, x: 0,   y: 298, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
      { slotId: "r6d-row-5-right", row: 5, col: 2, x: 414, y: 298, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
    ],
  },
  // ── 7250 IXR-R6dl (7U) ─────────────────────────────────────────────────
  {
    modelId: "7250-ixr-r6dl",
    modelName: "7250 IXR-R6dl",
    rackUnit: "7U",
    baseSvgUrl: "[7U] 7250 IXR-R6dl-CARD.svg",
    cardArea: {
      x: 136,
      y: 22,
      width: 828,
      height: 624,
      columns: 1,
      columnWidth: 828,
    },
    slots: [
      // Row 1-3: Standard full-width (828×80)
      { slotId: "r6dl-row-1", row: 1, x: 0, y: 0,   width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      { slotId: "r6dl-row-2", row: 2, x: 0, y: 80,  width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      { slotId: "r6dl-row-3", row: 3, x: 0, y: 160, width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      // Row 4-5: CPIOM only (828×72)
      { slotId: "r6dl-row-4", row: 4, x: 0, y: 240, width: 828, height: 72, slotType: "full-828x72", allowedCardGroups: ["cpiom"], accepts: ["cpiom-828x72"] },
      { slotId: "r6dl-row-5", row: 5, x: 0, y: 312, width: 828, height: 72, slotType: "full-828x72", allowedCardGroups: ["cpiom"], accepts: ["cpiom-828x72"] },
      // Row 6-8: Standard full-width (828×80)
      { slotId: "r6dl-row-6", row: 6, x: 0, y: 384, width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      { slotId: "r6dl-row-7", row: 7, x: 0, y: 464, width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
      { slotId: "r6dl-row-8", row: 8, x: 0, y: 544, width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] },
    ],
  },
];
