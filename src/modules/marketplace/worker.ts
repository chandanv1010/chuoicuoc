import "server-only";
import { SocialError } from "@/modules/social/http";
import { getAccount, markNeedsReconnect } from "./accounts";
import { isDryRun } from "./config";
import { claim, dueIds, getListing, markFailed, markRetry, markSynced, releaseStale, saveProgress } from "./listings";
import { validAccessToken } from "./oauth";
import { adapterOf } from "./platforms";
import { loadProduct } from "./product-source";

/**
 * Worker hang doi marketplace_listings (chay nen trong process Next.js, bat o src/instrumentation.ts).
 *  - Moi TICK_MS lay vai viec den han, nhan nguyen tu, goi adapter.sync.
 *  - Adapter luu tien do tung buoc (id listing tren san, anh da tai) -> loi giua chung thi lan sau chay tiep, khong tao trung.
 *  - Loi tam thoi (mang, 5xx, 429): thu lai toi da MAX_ATTEMPTS, backoff 1 / 5 / 15 phut. Loi xac thuc: tai khoan -> can ket noi lai.
 *  - Dry run (thieu ma app, MARKETPLACE_DRY_RUN=1, tai khoan thu): chi kiem tra du lieu roi gia lap thanh cong.
 */

export const MAX_ATTEMPTS = 3;
const BACKOFF_SEC = [60, 300, 900];
const TICK_MS = 20_000;

type WorkerState = { timer?: NodeJS.Timeout; running: boolean; started: boolean; lastTick?: number };
const g = globalThis as unknown as { __marketplaceWorker?: WorkerState };
const state: WorkerState = (g.__marketplaceWorker ??= { running: false, started: false });

export function startMarketplaceWorker() {
  if (state.started) return;
  state.started = true;
  state.timer = setInterval(() => void tick(), TICK_MS);
  state.timer.unref?.();
  setTimeout(() => void tick(), 4_000).unref?.();
  console.log("[marketplace] worker started");
}

export function workerStatus() {
  return { started: state.started, running: state.running, lastTick: state.lastTick ?? null };
}

export async function tick(limit = 3): Promise<number> {
  if (state.running) return 0;
  state.running = true;
  state.lastTick = Date.now();
  let done = 0;
  try {
    await releaseStale();
    for (const id of await dueIds(limit)) {
      if (!(await claim(id))) continue;
      await processListing(id);
      done++;
    }
  } catch (e) {
    console.error("[marketplace] tick error", e);
  } finally {
    state.running = false;
  }
  return done;
}

async function processListing(id: bigint) {
  const listing = await getListing(id);
  if (!listing) return;
  try {
    const account = await getAccount(listing.account_id);
    if (!account) throw new SocialError("Tài khoản sàn đã bị ngắt kết nối.");
    const adapter = adapterOf(listing.platform);
    if (!adapter) throw new SocialError(`Chưa hỗ trợ sàn ${listing.platform}.`);
    const product = await loadProduct(listing.product_id);
    if (!product) throw new SocialError("Sản phẩm không còn tồn tại trên website.");

    const errs = adapter.validate(product, listing.settings, account);
    if (errs.length) throw new SocialError(errs.join(" "));

    const dry = Boolean(listing.dry_run) || Boolean(account.meta?.dry_run) || isDryRun(listing.platform);
    if (dry) {
      const rid = listing.remote_id ?? `dry-${listing.id}`;
      await markSynced(id, { remote_id: rid, remote_url: adapter.fakeUrl(rid), remote_state: listing.settings.publish === "active" ? "active" : "draft", progress: { ...listing.progress, notice: "Dry run: chỉ kiểm tra dữ liệu, chưa gửi lên sàn." } });
      return;
    }

    const result = await adapter.sync({
      listing,
      product,
      settings: listing.settings,
      account,
      token: () => validAccessToken(account.id),
      save: (f) => saveProgress(id, f),
    });
    await markSynced(id, result);
  } catch (e) {
    const err = e instanceof SocialError ? e : new SocialError((e as Error)?.message ?? String(e), { retryable: true });
    if (!(e instanceof SocialError)) console.error("[marketplace] listing", id.toString(), e);
    if (err.auth) {
      await markNeedsReconnect(listing.account_id, err.message);
      await markFailed(id, `Cần kết nối lại tài khoản sàn: ${err.message}`);
      return;
    }
    if (err.retryable && listing.attempts < MAX_ATTEMPTS) {
      await markRetry(id, `Lần ${listing.attempts}/${MAX_ATTEMPTS}: ${err.message}`, BACKOFF_SEC[listing.attempts - 1] ?? 900);
      return;
    }
    await markFailed(id, err.message);
  }
}
