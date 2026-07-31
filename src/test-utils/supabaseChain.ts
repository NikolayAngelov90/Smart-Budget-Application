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
export function createQueryChain(result: QueryResult = { data: [], error: null }): QueryChain {
  const calls: RecordedCall[] = [];
  const methodFns: Record<string, jest.Mock> = {};

  const target = {
    calls,
    callsTo(method: string): unknown[][] {
      return calls.filter((c) => c.method === method).map((c) => c.args);
    },
    calledWith(method: string, ...args: unknown[]): boolean {
      return calls.some(
        (c) => c.method === method && JSON.stringify(c.args) === JSON.stringify(args)
      );
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
        return (resolve: (v: QueryResult) => unknown) => resolve(result);
      }
      if (prop === 'catch' || prop === 'finally') {
        return () => proxy;
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

  const client = {
    from,
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
    },
    // Present so a route calling an RPC does not explode; override per test.
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

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
 * Asserts a query was scoped to a user.
 *
 * Exists because "did we filter by user_id" is the single check whose absence
 * turns a passing test into a cross-user data leak, and it should cost one line.
 */
export function expectUserScoped(chain: QueryChain, userId: string): void {
  expect(chain.callsTo('eq')).toContainEqual(['user_id', userId]);
}
