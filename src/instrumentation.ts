/**
 * Next.js instrumentation: chay mot lan khi server khoi dong.
 * Bat worker hang doi dang mang xa hoi (src/modules/social/worker.ts), dong bo hop thu binh luan/tin nhan (social/inbox.ts) va day san pham len san TMDT (src/modules/marketplace/worker.ts).
 * Chi chay o runtime nodejs; startSocialWorker tu chan chay trung khi dev hot reload.
 * Tat bang SOCIAL_WORKER=0 (vd khi chay nhieu instance va dung worker rieng).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SOCIAL_WORKER === "0") return;
  const { startSocialWorker } = await import("./modules/social/worker");
  startSocialWorker();
  const { startInboxSync } = await import("./modules/social/inbox");
  startInboxSync();
  const { startMarketplaceWorker } = await import("./modules/marketplace/worker");
  startMarketplaceWorker();
  const { startCurateWorker } = await import("./modules/curate/worker");
  startCurateWorker();
}
