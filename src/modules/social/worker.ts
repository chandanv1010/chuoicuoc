import "server-only";
import { getAccount, markNeedsReconnect } from "./accounts";
import { isDryRun, tiktokAudited } from "./config";
import { SELF_ONLY_NOTICE } from "./platforms/tiktok";
import { SocialError } from "./http";
import { validAccessToken } from "./oauth";
import { adapters } from "./platforms";
import { fakeId, type PublishJob, type PublishResult } from "./platforms/base";
import { claim, dueIds, getPost, markFailed, markPolling, markPublished, markRetry, releaseStale, type SocialPostRow } from "./posts";

/**
 * Worker hang doi social_posts (chay nen trong process Next.js, khoi dong o src/instrumentation.ts).
 *  - Moi TICK_MS lay toi da vai viec den han, nhan nguyen tu (UPDATE ... WHERE status='queued'),
 *    goi adapter, ghi ket qua.
 *  - Loi tam thoi: thu lai toi da MAX_ATTEMPTS lan, backoff 1 / 5 / 15 phut.
 *  - Loi xac thuc: tai khoan -> "Can ket noi lai", bai -> loi (khong thu lai).
 *  - Nen tang xu ly bat dong bo (IG container, TikTok, reel FB, video Pinterest): bai quay lai hang doi
 *    voi stage='poll' va duoc poll lai (khong tinh vao so lan thu).
 *  - Dry run (SOCIAL_DRY_RUN=1 hoac thieu ma app, hoac tai khoan demo): chi validate roi gia lap thanh cong.
 *    Caption co "#dryrunfail" -> lan dau that bai (de thu nut "Thu lai").
 */

export const MAX_ATTEMPTS = 3;
const BACKOFF_SEC = [60, 300, 900];
const MAX_POLLS = 60;
const TICK_MS = 15_000;

type WorkerState = { timer?: NodeJS.Timeout; running: boolean; started: boolean; lastTick?: number };
const g = globalThis as unknown as { __socialWorker?: WorkerState };
const state: WorkerState = (g.__socialWorker ??= { running: false, started: false });

/** Bat vong lap nen (goi nhieu lan van chi chay mot vong — HMR dev). */
export function startSocialWorker() {
  if (state.started) return;
  state.started = true;
  state.timer = setInterval(() => void tick(), TICK_MS);
  state.timer.unref?.();
  setTimeout(() => void tick(), 3_000).unref?.();
  console.log("[social] worker started");
}

export function workerStatus() {
  return { started: state.started, running: state.running, lastTick: state.lastTick ?? null };
}

/** Mot luot xu ly (cung dung cho nut "Chay ngay"). Khong chay chong len nhau. */
export async function tick(limit = 5): Promise<number> {
  if (state.running) return 0;
  state.running = true;
  state.lastTick = Date.now();
  let done = 0;
  try {
    await releaseStale();
    for (const id of await dueIds(limit)) {
      if (!(await claim(id))) continue; // worker khac da nhan
      await processPost(id);
      done++;
    }
  } catch (e) {
    console.error("[social] tick error", e);
  } finally {
    state.running = false;
  }
  return done;
}

async function processPost(id: bigint) {
  const post = await getPost(id);
  if (!post) return;
  const meta = { ...post.meta };
  try {
    const account = await getAccount(post.account_id);
    if (!account) throw new SocialError("Tài khoản mạng xã hội đã bị xóa.");
    const adapter = adapters[post.platform];
    const job: PublishJob = { post, account, meta, token: () => validAccessToken(account.id) };
    const dry = Boolean(post.dry_run) || Boolean(account.meta?.dry_run) || isDryRun(post.platform);

    let result: PublishResult;
    if (post.stage === "poll") {
      meta.polls = (meta.polls ?? 0) + 1;
      if (meta.polls > MAX_POLLS) throw new SocialError("Nền tảng xử lý quá lâu, đã dừng chờ. Kiểm tra trên nền tảng rồi bấm Thử lại nếu cần.");
      result = dry ? fakeDone(post, adapter.fakeUrl.bind(adapter), job) : await adapter.poll!(job, meta.remote_state ?? {});
    } else {
      await adapter.validate(job);
      if (dry) {
        meta.dry = true;
        if (post.platform === "tiktok" && (meta.tiktok as { privacy_level?: string } | undefined)?.privacy_level === "SELF_ONLY" && !tiktokAudited()) meta.notice = SELF_ONLY_NOTICE;
        if ((post.caption ?? "").includes("#dryrunfail") && !meta.forced_failed) {
          meta.forced_failed = true;
          throw new SocialError("Lỗi giả lập (dry run, #dryrunfail) — bấm Thử lại để đăng lại.");
        }
        // gia lap nen tang xu ly bat dong bo de thu ca luong poll
        result = adapters[post.platform].poll ? { done: false, remoteId: fakeId(post.platform, post.id), state: { dry: true }, retryAfterSec: 5 } : fakeDone(post, adapter.fakeUrl.bind(adapter), job);
      } else {
        result = await adapter.publish(job);
      }
    }

    if (result.notice) meta.notice = result.notice;
    if (result.done) {
      delete meta.remote_state;
      await markPublished(post.id, result.remoteId, result.remoteUrl, meta);
    } else {
      meta.remote_state = result.state;
      await markPolling(post.id, result.remoteId ?? null, meta, result.retryAfterSec);
    }
  } catch (e) {
    const err = e instanceof SocialError ? e : new SocialError((e as Error)?.message ?? String(e), { retryable: true });
    if (!(e instanceof SocialError)) console.error("[social] post", id.toString(), e);
    if (err.auth) {
      await markNeedsReconnect(post.account_id, err.message);
      await markFailed(post.id, `Cần kết nối lại tài khoản: ${err.message}`, meta);
      return;
    }
    // Dang poll: loi tam thoi -> poll lai; loi han -> that bai
    if (post.stage === "poll" && err.retryable) {
      await markPolling(post.id, null, meta, 60);
      return;
    }
    if (err.retryable && post.attempts < MAX_ATTEMPTS) {
      await markRetry(post.id, `Lần ${post.attempts}/${MAX_ATTEMPTS}: ${err.message}`, BACKOFF_SEC[post.attempts - 1] ?? 900, meta);
      return;
    }
    await markFailed(post.id, err.message, meta);
  }
}

function fakeDone(post: SocialPostRow, fakeUrl: (job: PublishJob, id: string) => string, job: PublishJob): PublishResult {
  const id = post.remote_id ?? fakeId(post.platform, post.id);
  return { done: true, remoteId: id, remoteUrl: fakeUrl(job, id), notice: post.meta.notice };
}
