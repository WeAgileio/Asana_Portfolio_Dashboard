import { computed } from "vue";

/** 表頭 billing 參考金額（💰 1,218,945 / 1,218,945），本版月欄寬度鎖死基準 */
export const BYTIME_MONTH_COL_REFERENCE = {
  collected: 1_218_945,
  total: 1_218_945,
} as const;

/** 11px tabular-nums 平均字寬估算 */
const BILLING_CHAR_PX = 6.8;
/** th 內 billing 列左右餘量（含 .th-month padding 6px×2 與視覺留白） */
const BILLING_ROW_PADDING_PX = 16;
const BILLING_WIDTH_BUFFER_PX = 12;
/** .th-month-billing-row inline-flex gap 4px × 2（三分隔線） */
const BILLING_ROW_FLEX_GAP_PX = 8;
/** 💰 實際渲染寬於字元估算的補正 */
const BILLING_EMOJI_EXTRA_PX = 8;

/** 與表頭 `.th-month-billing-row` 顯示格式一致 */
export function formatBytimeBillingHeaderLine(
  collected: number,
  total: number
): string {
  return `💰 ${collected.toLocaleString("zh-TW")} / ${total.toLocaleString("zh-TW")}`;
}

function estimateReferenceBillingThWidthPx(): number {
  const { collected, total } = BYTIME_MONTH_COL_REFERENCE;
  const line = formatBytimeBillingHeaderLine(collected, total);
  return Math.ceil(
    line.length * BILLING_CHAR_PX +
      BILLING_ROW_PADDING_PX +
      BILLING_WIDTH_BUFFER_PX +
      BILLING_ROW_FLEX_GAP_PX +
      BILLING_EMOJI_EXTRA_PX
  );
}

/** 月欄固定寬度（px）；較大金額靠整表橫向捲動，不自動拉寬 */
export const BYTIME_MONTH_COL_W = estimateReferenceBillingThWidthPx();

export function useBytimeMonthColWidth() {
  const monthColWidthPx = computed(() => BYTIME_MONTH_COL_W);

  const monthColWidthStyle = computed(() => ({
    "--bytime-month-col-w": `${monthColWidthPx.value}px`,
  }));

  return { monthColWidthPx, monthColWidthStyle };
}
