/** Build-time flag：獨立 demo 映像建置時設 VITE_DEMO_MODE=true */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}
