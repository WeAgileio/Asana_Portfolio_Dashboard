import { computed, type ComputedRef, type Ref } from "vue";

export const BYTIME_MONTH_COL_MIN = 154;

/** 11px tabular-nums 平均字寬估算 */
const BILLING_CHAR_PX = 6.8;
const BILLING_ROW_PADDING_PX = 16;
const BILLING_WIDTH_BUFFER_PX = 12;

export type MonthBillingAmounts = Record<
  string,
  { collected: number; total: number }
>;

/** 與表頭 `.th-month-billing-row` 顯示格式一致 */
export function formatBytimeBillingHeaderLine(
  collected: number,
  total: number
): string {
  return `💰 ${collected.toLocaleString("zh-TW")} / ${total.toLocaleString("zh-TW")}`;
}

function estimateBillingRowWidthPx(collected: number, total: number): number {
  const line = formatBytimeBillingHeaderLine(collected, total);
  return (
    line.length * BILLING_CHAR_PX +
    BILLING_ROW_PADDING_PX +
    BILLING_WIDTH_BUFFER_PX
  );
}

export function computeBytimeMonthColWidthPx(
  amounts: MonthBillingAmounts
): number {
  let maxW = BYTIME_MONTH_COL_MIN;
  for (const entry of Object.values(amounts)) {
    if (!entry) continue;
    const w = estimateBillingRowWidthPx(entry.collected, entry.total);
    if (w > maxW) maxW = w;
  }
  return Math.ceil(maxW);
}

export function useBytimeMonthColWidth(
  billingAmounts: ComputedRef<MonthBillingAmounts> | Ref<MonthBillingAmounts>
) {
  const monthColWidthPx = computed(() =>
    computeBytimeMonthColWidthPx(billingAmounts.value)
  );

  const monthColWidthStyle = computed(() => ({
    "--bytime-month-col-w": `${monthColWidthPx.value}px`,
  }));

  return { monthColWidthPx, monthColWidthStyle };
}
