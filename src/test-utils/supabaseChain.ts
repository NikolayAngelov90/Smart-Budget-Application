/**
 * Shared Supabase query-chain mock.
 *
 * Carried as an action item through Epics 14, 15 and 16. Epic 16 measured the
 * cost: three separate test failures caused by hand-rolled chain stubs, each
 * with the same shape — production code started calling a method the stub did
 * not define (`.upsert`, `.in`, `.gte`), the stub returned `undefined`, the call
 * threw into a `catch`, and the route silently degraded. The test then reported
 * a *behaviour* failure that was really a mock gap, which is the expensive part:
 * it sends you looking in the wrong place.
 *
 * Two design decisions follow from that:
 *
 * 1. **Any method is chainable.** A Proxy answers every property with a
 *    recording function that returns the chain. Adding a `.not()` or a
 *    `.range()` to a route can no longer break a test that does not care about
 *    it. This is deliberately more permissive than a hand-rolled stub: the
 *    failure it prevents (silent degradation, misleading diagnosis) is worse
 *    than the one it allows (a typo'd method going unnoticed, which the arg
 *    assertions below still catch).
 *
 * 2. **Every call is recorded with its arguments.** The repo's documented
 *    3x-recurring bug is arg-blind stubs letting user-scoping or a date column
 *    vanish while every test stays green. `callsTo()` makes asserting the
 *    filters as easy as asserting the result, so there is no reason not to.
 *
 * The chain is thenable, so it works as the terminal of any shape:
 * `.select().eq().single()`, `.select().eq().range()`, `.upsert().select()`.
 */

export interface QueryResult {
  data: unknown;
  error: unknown;
  /**
   * For `select('*', { count: 'exact' })`.
   *
   * Without this the type rejected `count` as an excess property, so routes
   * that read it got `undefined` — pagination emitted `totalPages: NaN` and the
   * "category still has transactions" delete guard never fired, both silently.
   */
  count?: number | null;
}

/** A recorded call: the method name and the arguments it received. */
export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface QueryChain {
  /** Every method call made on this chain, in order. */
  readonly calls: RecordedCall[];
  /** Arguments of each call to `method`, in order. */
  callsTo(method: string): unknown[][];
  /** Convenience: was `method` called with exactly these args? */
  calledWith(method: string, ...args: unknown[]): boolean;
  // Indexed so any Supabase builder method type-checks at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [method: string]: any;
}

/**
 * Properties that must NOT be answered with a chainable function.
 *
 * Jest, `expect` and React internals probe objects for these; handing back a
 * function makes an ordinary value look like a promise, a React element or an
 * iterable, and the resulting failures are baffling.
 */
const PASS_THROUGH = new Set([
  'constructor',
  'nodeType',
  'tagName',
  '$$typeof',
  'asymmetricMatch',
  'toJSON',
  'inspect',
  '_isMockFunction',
  'mock',
]);

/**
 * A chainable, awaitable query builder that resolves to `result`.
 *
 * ```ts
 * const chain = createQueryChain({ data: rows, error: null });
 * await chain.select('*').eq('user_id', 'u-1').single();
 * expect(chain.calledWith('eq', 'user_id', 'u-1')).toBe(true);
 * ```
 */
/**
 * Deep structural equality that keeps `undefined`, `null` and `NaN` distinct.
 *
 * `Object.is` gives us NaN === NaN and separates null from undefined; the
 * recursion handles the object/array arguments PostgREST filters carry.
 */
function sameArgs(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => sameValue(value, b[i]));
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b as object, k) &&
      sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

/** Terminals that return a single row, so `data: []` would be the wrong shape. */
const SINGLE_ROW_TERMINALS = new Set(['single', 'maybeSingle']);

export function createQueryChain(result: QueryResult = { data: [], error: null }): QueryChain {
  const calls: RecordedCall[] = [];
  const methodFns: Record<string, jest.Mock> = {};

  /**
   * The result, reshaped for the terminal the caller actually used.
   *
   * An unconfigured table resolved to `data: []` whatever the chain shape — and
   * `[]` is TRUTHY, so a route doing `if (!data) return 404` sailed past its
   * own guard and then read `data.id` as undefined. The test reported a
   * wrong-path behaviour failure that was really a mock gap: precisely the
   * diagnosis cost this helper exists to remove.
   *
   * `.single()` / `.maybeSingle()` therefore get `null` for an empty list, and
   * the first row when one was configured as an array.
   */
  const resolveResult = (): QueryResult => {
    const usedSingle = calls.some((c) => SINGLE_ROW_TERMINALS.has(c.method));
    if (!usedSingle || !Array.isArray(result.data)) return result;
    return { ...result, data: result.data.length > 0 ? result.data[0] : null };
  };

  const target = {
    calls,
    callsTo(method: string): unknown[][] {
      return calls.filter((c) => c.method === method).map((c) => c.args);
    },
    calledWith(method: string, ...args: unknown[]): boolean {
      // Structural, NOT JSON.stringify.
      //
      // `JSON.stringify([undefined])` and `JSON.stringify([null])` are both
      // "[null]", and NaN stringifies to null too — so a filter that sent
      // `undefined` (which PostgREST serialises as the literal string
      // "undefined" and silently returns the wrong rows) matched an assertion
      // written for `null`. This is the project's primary primitive for
      // asserting money, date and scoping filters; it cannot be blind to the
      // one confusion most likely to break them.
      return calls.some((c) => c.method === method && sameArgs(c.args, args));
    },
  } as unknown as QueryChain;

  const proxy: QueryChain = new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === 'symbol' || PASS_THROUGH.has(prop as string)) {
        return Reflect.get(obj, prop, receiver);
      }
      if (prop in obj) return Reflect.get(obj, prop, receiver);

      // Awaiting the chain resolves the configured result. Supabase's own
      // builders are thenables too, so this matches the real shape.
      if (prop === 'then') {
        return (
          resolve: (v: QueryResult) => unknown,
          reject?: (reason?: unknown) => unknown
        ) => {
          try {
            // A real `then` returns a PROMISE of the callback's value.
            // Returning the raw value broke `.then(fn).catch(g)` — `.catch`
            // was called on whatever fn returned — and made `.finally()`
            // silently never run.
            return Promise.resolve(resolve(resolveResult()));
          } catch (err) {
            return reject ? Promise.resolve(reject(err)) : Promise.reject(err);
          }
        };
      }
      if (prop === 'catch') {
        // Nothing here ever rejects, so `catch` is a pass-through that keeps
        // the promise chain intact rather than handing back the builder.
        return () => Promise.resolve(resolveResult());
      }
      if (prop === 'finally') {
        return (fn?: () => void) => {
          fn?.();
          return Promise.resolve(resolveResult());
        };
      }

      // Anything else: a memoised jest.fn that records and returns the chain.
      //
      // jest.fn rather than a plain closure so existing suites keep working —
      // `expect(chain.eq).toHaveBeenCalledWith('user_id', id)` is the idiom
      // already used everywhere, and a migration that forced every assertion
      // to be rewritten would not get adopted.
      const name = prop as string;
      if (!methodFns[name]) {
        methodFns[name] = jest.fn((...args: unknown[]) => {
          calls.push({ method: name, args });
          return proxy;
        });
      }
      return methodFns[name];
    },
  }) as QueryChain;

  return proxy;
}

export interface SupabaseMockOptions {
  /**
   * Result per table. An ARRAY is a queue consumed in `from()` order — which is
   * how a paginated loop or a route querying the same table twice behaves.
   * Tables not listed resolve to an empty, error-free result, so a test only
   * configures what it actually asserts on.
   */
  tables?: Record<string, QueryResult | QueryResult[]>;
  /** `null` produces an unauthenticated client. */
  user?: { id: string } | null;
}

export interface SupabaseMock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  from: jest.Mock;
  /** Every chain handed out, per table, in `from()` order. */
  chains: Record<string, QueryChain[]>;
  /** The nth chain for a table (default: the first). */
  chainFor(table: string, index?: number): QueryChain;
  /** Arguments of each call to `method` on the nth chain for `table`. */
  callsTo(table: string, method: string, index?: number): unknown[][];
  /**
   * Arguments of every call to `method` across ALL chains for a table.
   *
   * A paginated loop calls `from()` once per page, so its `range()` calls are
   * spread across chains — asserting on chain 0 alone silently checks only the
   * first page.
   */
  allCallsTo(table: string, method: string): unknown[][];
}

/**
 * A Supabase client mock with per-table results and full call recording.
 *
 * ```ts
 * const db = createSupabaseMock({
 *   tables: { transactions: { data: rows, error: null } },
 * });
 * mockCreateClient.mockResolvedValue(db.client);
 *
 * await GET(request);
 *
 * // Assert the FILTERS, not just the result — an arg-blind stub is how a
 * // dropped user scope stays green.
 * expect(db.callsTo('transactions', 'eq')).toContainEqual(['user_id', 'u-1']);
 * ```
 */
export function createSupabaseMock(options: SupabaseMockOptions = {}): SupabaseMock {
  const { tables = {}, user = { id: 'user-1' } } = options;

  const queues: Record<string, QueryResult[]> = {};
  for (const [table, value] of Object.entries(tables)) {
    queues[table] = Array.isArray(value) ? [...value] : [value];
  }

  const chains: Record<string, QueryChain[]> = {};

  const from = jest.fn((table: string) => {
    const queue = queues[table];
    // A queue that runs dry keeps returning its last entry rather than
    // switching to empty — a pagination loop asking one more time should not
    // silently change shape.
    const result: QueryResult =
      queue && queue.length > 0
        ? queue.length === 1
          ? queue[0]!
          : queue.shift()!
        : { data: [], error: null };

    const chain = createQueryChain(result);
    (chains[table] ??= []).push(chain);
    return chain;
  });

  const session = user ? { user, access_token: 'test-token' } : null;

  // The permissiveness has to reach the CLIENT, not stop at the chain.
  //
  // This was a 3-key literal, so `supabase.auth.getSession()`,
  // `supabase.schema('private')`, `.storage` and `.channel()` were all
  // undefined -> TypeError -> the route's catch -> a 500 that reads as a
  // behaviour bug. Every argument for making the chain answer any method
  // applies one level up, and `schema('private')` is realistic now that
  // migration 038 moved helpers there.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    from,
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
      getSession: jest.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
      getClaims: jest.fn().mockResolvedValue({ data: null, error: null }),
      admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user }, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.test/x' } })),
      })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn().mockResolvedValue('ok'),
    })),
    removeChannel: jest.fn(),
    // Present so a route calling an RPC does not explode; override per test.
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

  // Assigned after construction so it can return the client itself — migration
  // 038 moved the policy helpers into a `private` schema, so `schema('private')`
  // is a realistic caller.
  client.schema = jest.fn(() => client);

  return {
    client,
    from,
    chains,
    chainFor(table: string, index = 0): QueryChain {
      const list = chains[table];
      if (!list || !list[index]) {
        throw new Error(
          `No chain recorded for table "${table}" at index ${index}. ` +
            `Tables queried: ${Object.keys(chains).join(', ') || '(none)'}`
        );
      }
      return list[index]!;
    },
    callsTo(table: string, method: string, index = 0): unknown[][] {
      return this.chainFor(table, index).callsTo(method);
    },
    allCallsTo(table: string, method: string): unknown[][] {
      return (chains[table] ?? []).flatMap((c) => c.callsTo(method));
    },
  };
}

/**
 * Asserts EVERY query against a table was scoped to a user.
 *
 * Exists because "did we filter by user_id" is the single check whose absence
 * turns a passing test into a cross-user data leak, and it should cost one line.
 *
 * Takes the MOCK and a table name, not a single chain. The first version took
 * one chain and defaulted to index 0, so on any route querying a table twice —
 * current vs previous window, which is the norm here — it passed on query 1
 * while query 2 went unscoped. That is the documented 3x-recurring "scoping
 * silently vanishes" bug, reintroduced through a default argument.
 */
export function expectUserScoped(db: SupabaseMock, table: string, userId: string): void {
  const chains = db.chains[table] ?? [];
  expect(chains.length).toBeGreaterThan(0);

  chains.forEach((chain, index) => {
    const scoped = chain.callsTo('eq').some((args) => sameArgs(args, ['user_id', userId]));
    if (!scoped) {
      throw new Error(
        `Query ${index + 1} of ${chains.length} against "${table}" was not scoped to ` +
          `user_id=${userId}. Filters seen: ${JSON.stringify(chain.calls)}`
      );
    }
  });
}

/** Single-chain form, for the rare case where only one query is expected. */
export function expectChainUserScoped(chain: QueryChain, userId: string): void {
  expect(chain.callsTo('eq')).toContainEqual(['user_id', userId]);
}
