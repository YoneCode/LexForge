# LexForge — Precedent-Compiled Semantic Bonds

LexForge is a dispute-resolution layer for **collateralized commitments whose terms are
written in plain language**. Parties bond a covenant such as *“the deliverable provides a
usable integration”* or *“the claims are not materially misleading.”* When a dispute is
filed, GenLayer validators independently fetch the cited evidence, interpret it with an
LLM, and reach **consensus on the verdict** — then the contract settles deterministically.
Each resolved holding is folded into an on-chain **doctrine** memory, so recurring clauses
become more predictable over time.

It is a single GenLayer Intelligent Contract, live on **Testnet Bradbury (chain 4221)**:

```
Contract: 0x6a028b7BF87F32583eC5f79F12756b6b4ab338eA
Explorer: https://explorer-bradbury.genlayer.com
```

## Why this needs GenLayer

A covenant like *“reasonable latency”* or *“a usable integration”* has no canonical byte
representation. To enforce it, a deterministic chain would have to bolt on the very trust
assumptions a smart contract is meant to remove:

- an **oracle committee** to fetch and render the web evidence,
- an **off-chain judge set** to run the language model and decide whether the evidence
  supports the claim,
- a **governance process** to update the rubric as new cases arrive.

GenLayer collapses all three into the protocol. Its validators can execute
non-deterministic work — web rendering and LLM inference — and still **agree by
*equivalence* rather than byte-equality**. LexForge’s state transitions intentionally
depend on:

- **Non-deterministic retrieval** — `gl.nondet.web.render(url)` returns content that varies
  across time, geography and caching.
- **LLM interpretation** — `gl.nondet.exec_prompt(...)` produces outputs that are never
  identical across nodes.
- **Semantic consensus** — validators run the same step and vote on whether the leader’s
  result is *equivalent*, via a custom validator function inside
  `gl.vm.run_nondet_unsafe(...)`.

That is the part a deterministic VM cannot reproduce without reintroducing trusted
intermediaries, and it is the only part LexForge puts on GenLayer.

## How a dispute resolves

```
open_case ──▶ crank ──▶ (web render + LLM verdict + validator consensus) ──▶ RESOLVED
                                                                                │
                                                              finalize ──▶ FINAL + settlement payload
```

1. **`open_case(covenant_ref, clause_text, claim, evidence_url)`** records the dispute as
   `OPEN`. Inputs are sanitized (control characters stripped, length-capped) and treated as
   untrusted.
2. **`crank(case_id)`** runs one bounded, idempotent step. Inside the non-deterministic
   block the leader renders the evidence (capped to keep the consensus body small), prompts
   the model for a verdict, and returns it. Validators re-run the step and agree only on the
   **verdict enum** (`PASS` / `FAIL` / `UNDETERMINED`). Crank is idempotent: once a case is
   resolved it returns current state without re-running consensus, so duplicate calls never
   corrupt state or congest the per-contract execution queue.
3. **`finalize(case_id)`** (owner-gated, stands in for an appeal window closing) assigns a
   monotonic, replay-protected settlement nonce and exposes the payload an off-chain relayer
   would deliver to a settlement vault.

Reads (`get_case`, `get_settlement`, `get_doctrine`, `case_count`) are plain views.

### Consensus design

The only consensus-critical output is the **verdict enum**. Heterogeneous validator models
diverge on free-form numbers, so a money figure produced by the LLM would routinely strand a
case in `Undetermined`. Instead, **payout is deterministic contract policy** — `PASS` pays
the claimant in full (basis points), `FAIL` pays zero — and validators only have to agree on
the categorical judgment. This is both more robust and less code.

### Storage model

Typed persistent fields only: `u256`, `Address`, `bool`, `str`, `DynArray`, `TreeMap`, and
`@allow_storage @dataclass` records. No Python `dict`/`list`, **no floats anywhere** in
storage or calldata (GenLayer calldata cannot encode them), and enum values are stored as
strings. The doctrine graph is kept as a `TreeMap[str, str]` of JSON, keyed by a normalized
clause.

## Project layout

```
contracts/lexforge.py     # the Intelligent Contract
tests/direct/             # fast in-memory unit tests (mocked web/LLM)
deploy/                   # genlayer-py deploy + interaction scripts
web/                      # frontend (Vite + React + genlayer-js + Privy)
requirements.txt          # git-pinned GenLayer toolchain
gltest.config.yaml        # integration test / network config
```

## Build, test, deploy

The linter and test runner require **Python ≥ 3.12**.

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt

# Lint (AST safety + SDK semantics)
.venv/bin/genvm-lint check contracts/lexforge.py

# Fast direct-mode tests (no server; web + LLM mocked at the boundary)
ACCOUNT_PRIVATE_KEY=0x<32-byte-hex> .venv/bin/python -m pytest tests/direct/ -q

# Deploy to Bradbury (key read from .env, never printed)
.venv/bin/python deploy/deploy.py
```

Deploys are funded from a Bradbury account via the public faucet; the key lives only in a
git-ignored `.env`.

## Frontend

`web/` is a static React app (Vite + `genlayer-js`). Reads run **wallet-free directly
against the chain** — the Bradbury RPC is CORS-open, so no backend or indexer is required.
Writes (open / crank / finalize) are signed through a Privy-managed wallet on chain 4221.
Because the contract does not store originating transaction hashes, the UI captures each
write’s hash client-side to render per-case explorer links.

```bash
cd web && npm install && npm run build
```

## Engineering notes (verified on Bradbury)

Hard-won specifics that are easy to get wrong:

- **Pin a concrete GenVM runner hash.** Networks reject `py-genlayer:test`, `:latest`, and
  unversioned runners.
- **The on-chain header needs the version marker first** (`# v0.1.0`, then the `Depends`
  runner line). The CLI prepends it; a raw SDK upload does not — omit it and a deploy can be
  *Accepted/Finalized* yet invalid (`absent_runner_comment`). The linter and direct tests do
  not catch this; only an on-chain deploy plus a `gen_call` read does.
- **Storage is not readable inside a non-deterministic block.** Copy what the block needs
  into locals beforehand and write results back only after consensus returns.
- **Agree on a coarse, categorical signal**, never an exact LLM number, or consensus stalls.
- **Classify errors** (`[EXPECTED]` / `[EXTERNAL]` / `[TRANSIENT]` / `[LLM_ERROR]`) so
  validators agree on deterministic failures and disagree on model misbehavior to force
  leader rotation.
- **Keep evidence small.** Each validator re-fetches every citation; a large body can overrun
  the commit window and wedge the contract’s serial queue, while a few-KB source finalizes in
  minutes.
- **Treat all evidence as untrusted** — normalize, cap length, and instruct the model to
  ignore instructions embedded in the data.
- **Verify testnet deploys with `gen_call`**, not `gen_getContractSchema` (which is a
  local-network helper). Lifecycle status alone (`Accepted`/`Finalized`) is not proof of
  successful execution.

## Roadmap

LexForge today ships the part that can only exist on GenLayer — semantic adjudication and
deterministic settlement state. Planned protocol depth:

- **Claim bonds & crank fees** — require a bond to open a dispute and pay scribes per crank,
  with the fee reduced or burned on validator disagreement to deter spam.
- **Appeal window & rotation** — an on-chain appeal path that re-runs consensus and escalates
  evidence (e.g. screenshot mode) for high-value or contested clauses.
- **Cross-chain settlement** — emit the finalized payload as an external message to an EVM
  bridge adapter so a Base-side vault releases or slashes real collateral on `FINAL`.
- **Doctrine compilation** — consolidate recurring holdings into deterministic “rulelets” so
  stable clauses settle without an LLM call, reserving model inference for genuinely novel
  disputes.
- **Evidence tiering** — route ambiguous clauses to vision-capable validator models with
  screenshot evidence, while keeping the common path text-only and cheap.

## Links

- GitHub: https://github.com/YoneCode/LexForge
- X: https://x.com/YoneCode
