"""Direct-mode tests for the LexForge intelligent contract.

Single `direct_deploy` call per module (the direct runner double-registers
otherwise). All phases run against one deployed instance. These are unit tests:
the framework mocks web/LLM. Real web+LLM+consensus is exercised on-chain.
"""
import json

CONTRACT = "contracts/lexforge.py"
WEB = r".*example\.com.*"
LLM = r".*adjudication module.*"
URL = "https://example.com/evidence"


def _mock(direct_vm, verdict):
    direct_vm.clear_mocks()
    direct_vm.mock_web(WEB, {"status": 200, "body": "Evidence: integration shipped and works."})
    direct_vm.mock_llm(LLM, json.dumps({"verdict": verdict, "rationale": "r"}))


def test_full_lifecycle(direct_vm, direct_deploy, direct_owner, direct_bob):
    direct_vm.sender = direct_owner
    c = direct_deploy(CONTRACT)

    # open a case -> OPEN / PENDING
    cid = int(c.open_case("vault-1", "delivered a usable integration", "claimant shipped it", URL))
    assert cid == 1 and c.case_count() == 1
    case = c.get_case(cid)
    assert case["status"] == "OPEN" and case["verdict"] == "PENDING" and case["payout_bps"] == 0

    # crank with PASS evidence -> RESOLVED, full payout (policy)
    _mock(direct_vm, "PASS")
    res = c.crank(cid)
    assert res["status"] == "RESOLVED" and res["verdict"] == "PASS"
    assert res["payout_bps"] == 10000 and res["step"] == 1

    # doctrine memory recorded for this clause
    doc = c.get_doctrine("Delivered A Usable Integration")  # key is normalized (lowercased)
    assert doc["verdict"] == "PASS" and doc["payout_bps"] == 10000 and doc["count"] == 1

    # crank is idempotent once RESOLVED — no extra step
    assert c.crank(cid)["step"] == 1

    # validator consensus is on the verdict enum: same verdict agrees, different disagrees
    assert direct_vm.run_validator() is True
    _mock(direct_vm, "FAIL")
    assert direct_vm.run_validator() is False

    # a FAIL case yields zero payout
    cid2 = int(c.open_case("vault-2", "materially misleading claims", "claim is false", URL))
    _mock(direct_vm, "FAIL")
    res3 = c.crank(cid2)
    assert res3["verdict"] == "FAIL" and res3["payout_bps"] == 0 and res3["status"] == "RESOLVED"

    # finalize (owner only) assigns a settlement nonce and is replay-safe
    pay = c.finalize(cid)
    assert pay["final"] is True and pay["verdict"] == "PASS" and pay["payout_bps"] == 10000 and pay["nonce"] == 1
    assert c.finalize(cid)["nonce"] == 1  # replay -> same nonce

    # reverts
    with direct_vm.expect_revert("only owner"):
        with direct_vm.prank(direct_bob):
            c.finalize(cid2)
    with direct_vm.expect_revert("unknown case"):
        c.crank(999)
    with direct_vm.expect_revert("missing required field"):
        c.open_case("", "clause", "claim", URL)
