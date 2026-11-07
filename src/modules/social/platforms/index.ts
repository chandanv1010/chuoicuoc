import "server-only";
import type { Platform } from "../types";
import type { Adapter } from "./base";
import { facebook } from "./facebook";
import { instagram } from "./instagram";
import { pinterest } from "./pinterest";
import { tiktok } from "./tiktok";
import { x } from "./x";
import { youtube } from "./youtube";

/** Bang adapter theo nen tang. Them nen tang moi: viet adapter + them vao day. */
export const adapters: Record<Platform, Adapter> = { facebook, instagram, tiktok, youtube, pinterest, x };

export type { Adapter, PublishJob, PublishResult } from "./base";
