var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../lib/game.ts
var emptyCounts = { stayLoss: 0, stayWin: 0, switchLoss: 0, switchWin: 0 };
function randomIndex(n) {
  const a = new Uint32Array(1);
  const limit = Math.floor(4294967296 / n) * n;
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= limit);
  return a[0] % n;
}
__name(randomIndex, "randomIndex");
function newRound() {
  return { prize: randomIndex(3), picked: null, opened: null, phase: "pick" };
}
__name(newRound, "newRound");
function applyAction(game, action, door) {
  const g = structuredClone(game), s = g.session, r = g.round;
  if (s.status !== "active") throw new Error("This session has ended.");
  if (action === "choose") {
    if (r.phase !== "pick" || !Number.isInteger(door) || door < 0 || door > 2) throw new Error("Choose one of the three closed doors.");
    r.picked = door;
    const eligible = [0, 1, 2].filter((d) => d !== r.prize && d !== door);
    r.opened = eligible[randomIndex(eligible.length)];
    r.phase = "decide";
  } else if (action === "stay" || action === "switch") {
    if (r.phase !== "decide") throw new Error("Choose a door first.");
    r.decision = action;
    r.finalDoor = action === "stay" ? r.picked : [0, 1, 2].find((d) => d !== r.picked && d !== r.opened);
    r.won = r.finalDoor === r.prize;
    r.phase = "reveal";
    const key = action + (r.won ? "Win" : "Loss");
    s[key]++;
    s.finalPoints = s.startingPoints + (s.stayWin + s.switchWin) * s.pointsForWin - (s.stayLoss + s.switchLoss) * s.pointsForLoss;
  } else if (action === "next") {
    if (r.phase !== "reveal") throw new Error("Finish this round first.");
    g.round = newRound();
  } else if (action === "end") {
    s.status = "ended";
    s.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  } else throw new Error("Unknown game action.");
  g.version++;
  return g;
}
__name(applyAction, "applyAction");
function publicGame(g) {
  const { prize, ...round } = g.round;
  return { ...g, lastMutationId: void 0, round: { ...round, ...g.round.phase === "reveal" ? { prize } : {} } };
}
__name(publicGame, "publicGame");

// storage.ts
var sessionColumns = { id: "id", name: "name", pointsForWin: "points_for_win", pointsForLoss: "points_for_loss", startingPoints: "starting_points", finalPoints: "final_points", stayLoss: "stay_loss", stayWin: "stay_win", switchLoss: "switch_loss", switchWin: "switch_win", status: "status", source: "source", startingPointsSource: "starting_points_source", createdAt: "created_at", endedAt: "ended_at" };
function sessionFromRow(row) {
  const s = {};
  for (const [key, column] of Object.entries(sessionColumns)) {
    if (row[column] !== null) s[key] = row[column];
  }
  return s;
}
__name(sessionFromRow, "sessionFromRow");
function gameFromRow(row) {
  return { session: sessionFromRow(row), version: Number(row.version), lastMutationId: String(row.last_mutation_id || ""), round: { prize: Number(row.round_prize), picked: row.round_picked === null ? null : Number(row.round_picked), opened: row.round_opened === null ? null : Number(row.round_opened), phase: row.round_phase, ...row.round_decision ? { decision: row.round_decision } : {}, ...row.round_final_door !== null ? { finalDoor: Number(row.round_final_door) } : {}, ...row.round_won !== null ? { won: row.round_won === 1 } : {} } };
}
__name(gameFromRow, "gameFromRow");
function rowFromGame(game, tokenHash) {
  const s = game.session, r = game.round, row = {};
  for (const [key, column] of Object.entries(sessionColumns)) row[column] = s[key] ?? null;
  return { ...row, token_hash: tokenHash, version: game.version, last_mutation_id: game.lastMutationId, round_prize: r.prize, round_picked: r.picked, round_opened: r.opened, round_phase: r.phase, round_decision: r.decision ?? null, round_final_door: r.finalDoor ?? null, round_won: r.won === void 0 ? null : Number(r.won) };
}
__name(rowFromGame, "rowFromGame");
async function insertGame(db, game, tokenHash) {
  const row = rowFromGame(game, tokenHash), columns = Object.keys(row);
  return db.prepare(`INSERT OR IGNORE INTO sessions (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).bind(...Object.values(row)).run();
}
__name(insertGame, "insertGame");
async function updateGame(db, game, tokenHash, expectedVersion) {
  const row = rowFromGame(game, tokenHash);
  delete row.id;
  return db.prepare(`UPDATE sessions SET ${Object.keys(row).map((column) => column + " = ?").join(", ")} WHERE id = ? AND version = ?`).bind(...Object.values(row), game.session.id, expectedVersion).run();
}
__name(updateGame, "updateGame");
async function findSession(db, id) {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first();
}
__name(findSession, "findSession");
async function listSessions(db) {
  const rows = await db.prepare("SELECT id, name, points_for_win, points_for_loss, starting_points, final_points, stay_loss, stay_win, switch_loss, switch_win, status, source, starting_points_source, created_at, ended_at FROM sessions ORDER BY name COLLATE NOCASE DESC, id DESC").all();
  return rows.results.map(sessionFromRow);
}
__name(listSessions, "listSessions");

// index.ts
var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Cache-Control": "no-store" };
function json(data, status = 200) {
  return Response.json(data, { status, headers });
}
__name(json, "json");
async function hash(token2) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token2))), (x) => x.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
function token(req) {
  const t = req.headers.get("authorization")?.replace(/^Bearer /, "");
  return t && /^[a-f0-9-]{36}$/.test(t) ? t : null;
}
__name(token, "token");
async function own(db, req, id) {
  const t = token(req);
  if (!t) return null;
  const row = await findSession(db, id);
  return row && row.token_hash === await hash(t) ? row : null;
}
__name(own, "own");
async function handleRequest(req, env) {
  if (new URL(req.url).pathname !== "/api/sessions") return json({ error: "Not found." }, 404);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (req.method === "GET") {
      const id = new URL(req.url).searchParams.get("id");
      if (id) {
        const row2 = await own(env.DB, req, id);
        return row2 ? json(publicGame(gameFromRow(row2))) : json({ error: "Session not found or session key is incorrect." }, 404);
      }
      return json({ schemaVersion: 2, storage: "Cloudflare D1", exportedAt: (/* @__PURE__ */ new Date()).toISOString(), notes: "All sessions are read from the database. Historical starting points were inferred from the supplied final bank. Positive loss points are deducted. Active sessions include completed rounds only.", sessions: await listSessions(env.DB) });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const t = token(req);
    if (!t) return json({ error: "A valid session key is required." }, 401);
    if (Number(req.headers.get("content-length") || 0) > 8192) return json({ error: "Request is too large." }, 413);
    const text = await req.text();
    if (text.length > 8192) return json({ error: "Request is too large." }, 413);
    let b;
    try {
      b = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }
    if (!b || typeof b !== "object" || typeof b.id !== "string" || !/^[a-f0-9-]{36}$/.test(b.id) || typeof b.mutationId !== "string" || !b.mutationId || b.mutationId.length > 80) return json({ error: "Invalid session request." }, 400);
    if (b.action === "create") {
      if (typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 100) return json({ error: "Enter a session name of 1\u2013100 characters." }, 400);
      for (const k of ["startingPoints", "pointsForWin", "pointsForLoss"]) if (!Number.isSafeInteger(b[k]) || b[k] < 0 || b[k] > 1e9) return json({ error: "Points must be whole numbers from 0 to 1,000,000,000." }, 400);
      const game2 = { session: { ...emptyCounts, id: b.id, name: b.name.trim(), startingPoints: b.startingPoints, pointsForWin: b.pointsForWin, pointsForLoss: b.pointsForLoss, finalPoints: b.startingPoints, status: "active", source: "live", createdAt: (/* @__PURE__ */ new Date()).toISOString() }, round: newRound(), version: 0, lastMutationId: b.mutationId };
      await insertGame(env.DB, game2, await hash(t));
      const row2 = await own(env.DB, req, b.id);
      return row2 ? json(publicGame(gameFromRow(row2))) : json({ error: "Session ID is already in use." }, 409);
    }
    const row = await own(env.DB, req, b.id);
    if (!row) return json({ error: "Session not found or session key is incorrect." }, 404);
    const game = gameFromRow(row);
    if (game.lastMutationId === b.mutationId) return json(publicGame(game));
    if (b.version !== game.version) return json({ error: "This session changed in another tab. Refresh to continue." }, 409);
    let next;
    try {
      next = applyAction(game, b.action, b.door);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
    next.lastMutationId = b.mutationId;
    const result = await updateGame(env.DB, next, String(row.token_hash), game.version);
    if (!result.meta.changes) return json({ error: "Another action completed first. Refresh to continue." }, 409);
    return json(publicGame(next));
  } catch (error) {
    console.error("Database request failed", error);
    return json({ error: req.method === "GET" ? "Unable to load shared results. Please retry." : "Unable to save this action. Retry to continue without counting it twice." }, 503);
  }
}
__name(handleRequest, "handleRequest");
var index_default = { fetch: handleRequest };

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-rf2gcc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-rf2gcc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  handleRequest
};
//# sourceMappingURL=index.js.map
