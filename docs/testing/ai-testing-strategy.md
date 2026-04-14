# AI / LLM Testing Strategy

## Problem

AI features (Claude API calls, LLM-generated content, anomaly explanations) are non-deterministic: the same input may produce different outputs across runs. Standard Jest assertions (`expect(result).toEqual(...)`) break because output varies.

This guide defines how we test AI features without flaky tests.

---

## Core Principle: Mock at the API Boundary

Never let a real LLM call reach the network in unit or integration tests. Mock at the lowest stable interface — the HTTP fetch or the SDK client — so tests are:

- Fast (no network latency)
- Free (no API costs)
- Deterministic (controlled output)

```
[Service under test] → [Claude SDK / fetch] ← mock here
```

Do **not** mock higher up (e.g., mocking the entire service function that calls Claude) — you would skip testing the prompt construction and response parsing that is most likely to break.

---

## Layers to Test Separately

### 1. Prompt Construction

Test that the function that builds a prompt includes the correct data.

```ts
// insightService.test.ts
it('includes category name and amounts in the anomaly prompt', () => {
  const prompt = buildAnomalyPrompt({
    category: 'Dining',
    currentSpend: 450,
    historicalAverage: 180,
    transactions: [{ date: '2026-04-10', amount: 250 }],
  });

  expect(prompt).toContain('Dining');
  expect(prompt).toContain('450');
  expect(prompt).toContain('180');
});
```

**Why**: If the prompt template changes and drops a required field, this test catches it before a production regression.

### 2. Response Parsing

Test that the function that parses the LLM response handles all expected formats — including malformed output.

```ts
it('extracts explanation from Claude response', () => {
  const raw = { content: [{ type: 'text', text: 'Your dining spend is unusually high.' }] };
  expect(parseAnomalyExplanation(raw)).toBe('Your dining spend is unusually high.');
});

it('falls back to template when response is empty', () => {
  const raw = { content: [] };
  expect(parseAnomalyExplanation(raw, { category: 'Dining', current: 450, avg: 180 }))
    .toBe('Your Dining spending (£450) is significantly above your average (£180).');
});
```

**Why**: LLMs occasionally return empty content blocks, tool_use responses when text was expected, or truncated output. Fallback paths must be tested.

### 3. Service Integration (with mocked Claude)

Mock the Claude SDK at the module level and verify that the service calls it with correct parameters and handles the response.

```ts
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mocked explanation.' }],
      }),
    },
  })),
}));

it('stores anomaly insight after detecting spike', async () => {
  // Arrange: seed transactions that trigger anomaly detection
  // Act: call detectAndExplainAnomalies(userId)
  // Assert: insight record created with type 'anomaly' and explanation field populated
});
```

### 4. Snapshot Tests for Prompt Templates

For prompts that are iterated frequently, snapshot tests catch unintended changes:

```ts
it('anomaly prompt matches snapshot', () => {
  const prompt = buildAnomalyPrompt({ category: 'Dining', currentSpend: 450, historicalAverage: 180 });
  expect(prompt).toMatchSnapshot();
});
```

When the prompt is intentionally updated, run `jest --updateSnapshot` and review the diff before committing.

**Warning**: Only snapshot the *template skeleton*, not variable data. If the prompt includes the current date, strip it before snapshotting.

---

## What NOT to Test

| Skipped | Reason |
|---|---|
| Quality of LLM output | Not deterministic; not our code |
| Whether Claude "understands" the prompt | Integration concern, not unit concern |
| LLM latency | Performance testing requires real network |
| Token count | Varies with model version; test prompt length in characters instead |

---

## End-to-End / Manual Verification Checklist

Because unit tests cannot verify output quality, each AI feature release requires a manual QA pass:

- [ ] Run the feature with a realistic dataset and review generated explanations
- [ ] Verify fallback output renders correctly when API is mocked to return `{content: []}`
- [ ] Confirm rate limiting prevents > N LLM calls per user per week (check `rateLimitService` logs)
- [ ] Verify no PII (merchant names, exact amounts without context) leaks into prompts by logging request body in dev mode

---

## Test Doubles Reference

| Scenario | Mock approach |
|---|---|
| Claude returns valid text | `create.mockResolvedValue({ content: [{ type: 'text', text: '...' }] })` |
| Claude returns empty content | `create.mockResolvedValue({ content: [] })` |
| Claude API error (5xx) | `create.mockRejectedValue(new Error('API error'))` |
| Rate limit hit | `create.mockRejectedValue(Object.assign(new Error(), { status: 429 }))` |
| Timeout | `create.mockImplementation(() => new Promise((_, r) => setTimeout(r, 30000)))` |

---

## Related

- [ADR-023: Anomaly Detection Algorithm](../../_bmad-output/planning-artifacts/adr-023-anomaly-detection-algorithm.md)
- [Integration Test Guide](./integration-test-guide.md)
- [Framer Motion Mocking Guide](./framer-motion-mocks.md)
