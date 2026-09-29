export function saturdayWindowStart(now?: Date): Date;
export function isEditedSinceSaturday(iso: string | null | undefined, now?: Date): boolean;
export function formatTaipeiEditedAt(iso: string | null | undefined): string;
export function progressUpdateHintLabel(iso: string | null | undefined, now?: Date): string | null;
export function statusUpdatedAtFromBody(body: { status_updated_at?: unknown } | null | undefined): string | null;
