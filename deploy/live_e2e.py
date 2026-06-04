"""Real on-chain interaction with LexForge on Bradbury (no mocks).

Steps (run individually; consensus rounds take time):
  python deploy/live_e2e.py deploy
  python deploy/live_e2e.py open   <addr>
  python deploy/live_e2e.py crank  <addr> <cid>
  python deploy/live_e2e.py show   <addr> <cid>
  python deploy/live_e2e.py finalize <addr> <cid>
"""
import os
import sys
import time
from pathlib import Path

import eth_utils
from dotenv import load_dotenv
from genlayer_py import create_account, create_client
from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.chains import testnet_bradbury
from genlayer_py.contracts.utils import make_calldata_object

load_dotenv(dotenv_path=str(Path(__file__).resolve().parent.parent / ".env"), override=True)
ACCT = create_account(os.environ["ACCOUNT_PRIVATE_KEY"])
C = create_client(chain=testnet_bradbury, account=ACCT)

# A real, tiny, stable public source whose text supports the demo claim.
EVIDENCE_URL = "https://example.com"
COVENANT = "covenant-001"
CLAUSE = "The cited web source must be a domain reserved for use in illustrative examples in documents."
CLAIM = "example.com states it is for use in illustrative examples in documents and may be used without permission."


def read(addr, fn, args=None):
    data = [calldata.encode(make_calldata_object(method=fn, args=args or [], kwargs=None)), b"\x00"]
    req = {"type": "read", "to": addr, "from": ACCT.address,
           "data": serialize(data), "transaction_hash_variant": "latest-final"}
    r = C.provider.make_request(method="gen_call", params=[req])["result"]
    if isinstance(r, dict):
        st = r.get("status", {})
        if st.get("code") != 0:
            return {"_error": st, "stderr": r.get("stderr")}
        return calldata.decode(eth_utils.hexadecimal.decode_hex("0x" + r["data"]))
    return calldata.decode(eth_utils.hexadecimal.decode_hex("0x" + r))


def status(txh):
    return C.provider.make_request(method="gen_getTransactionStatus",
                                   params=[{"txId": txh}])["result"]


def wait(txh, want=(5, 7), timeout=900):
    t0 = time.time()
    while time.time() - t0 < timeout:
        s = status(txh)
        code = s.get("statusCode")
        print(f"  {txh[:12]}.. status={s.get('status')}({code})")
        if code in want:
            return s
        if code in (11, 12, 13):  # UNDETERMINED / LEADER_TIMEOUT / VALIDATORS_TIMEOUT
            raise SystemExit(f"TERMINAL-BAD: {s}")
        time.sleep(12)
    raise SystemExit("timeout waiting for tx")


def write(addr, fn, args):
    txh = C.write_contract(address=addr, function_name=fn, account=ACCT, args=args)
    txh = txh if isinstance(txh, str) else eth_utils.hexadecimal.encode_hex(txh)
    print("  tx:", txh)
    wait(txh)
    return txh


cmd = sys.argv[1]

if cmd == "deploy":
    code = (Path(__file__).resolve().parent.parent / "contracts/lexforge.py").read_text()
    txh = C.deploy_contract(code=code, account=ACCT)
    txh = txh if isinstance(txh, str) else eth_utils.hexadecimal.encode_hex(txh)
    print("deploy tx:", txh)
    wait(txh)
    addr = C.get_transaction(transaction_hash=txh).get("recipient")
    print("ADDRESS:", addr)
    print("case_count:", read(addr, "case_count"))

elif cmd == "open":
    addr = sys.argv[2]
    print("open_case (real data)...")
    write(addr, "open_case", [COVENANT, CLAUSE, CLAIM, EVIDENCE_URL])
    print("case_count:", read(addr, "case_count"))
    print("case 1:", read(addr, "get_case", [1]))

elif cmd == "crank":
    addr, cid = sys.argv[2], int(sys.argv[3])
    print(f"crank case {cid} (real web render + real LLM + validator consensus)...")
    write(addr, "crank", [cid])
    print("case:", read(addr, "get_case", [cid]))

elif cmd == "show":
    addr, cid = sys.argv[2], int(sys.argv[3])
    print("case:", read(addr, "get_case", [cid]))
    print("doctrine:", read(addr, "get_doctrine", [CLAUSE]))
    print("settlement:", read(addr, "get_settlement", [cid]))

elif cmd == "finalize":
    addr, cid = sys.argv[2], int(sys.argv[3])
    write(addr, "finalize", [cid])
    print("settlement:", read(addr, "get_settlement", [cid]))
