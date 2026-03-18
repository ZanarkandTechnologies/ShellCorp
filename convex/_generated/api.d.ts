/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _utils from "../_utils.js";
import type * as board from "../board.js";
import type * as board_contract from "../board_contract.js";
import type * as board_http_contract from "../board_http_contract.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as status from "../status.js";
import type * as status_contract from "../status_contract.js";
import type * as status_http_contract from "../status_http_contract.js";
import type * as team_memory from "../team_memory.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _utils: typeof _utils;
  board: typeof board;
  board_contract: typeof board_contract;
  board_http_contract: typeof board_http_contract;
  crons: typeof crons;
  events: typeof events;
  http: typeof http;
  status: typeof status;
  status_contract: typeof status_contract;
  status_http_contract: typeof status_http_contract;
  team_memory: typeof team_memory;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
