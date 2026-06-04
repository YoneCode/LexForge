"""Seed 4 more REAL covenants on LexForge (Bradbury). No mocks.

  python deploy/seed.py openall
  python deploy/seed.py crank <id>
  python deploy/seed.py finalize <id>
  python deploy/seed.py list
"""
import os, sys, time
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
ADDR = "0x6a028b7BF87F32583eC5f79F12756b6b4ab338eA"

# 4 real covenants over small, stable public sources (example.* reserved domains).
COVENANTS = [
    ("covenant-002", "The cited source must permit reuse of the domain in written material without prior coordination.",
     "example.org allows use in literature without prior coordination or permission.", "https://example.org"),
    ("covenant-003", "The cited page must advertise paid enterprise pricing tiers.",
     "example.com lists paid enterprise pricing tiers for customers.", "https://example.com"),
    ("covenant-004", "The cited page must reference an authoritative registry for example domains.",
     "example.net points readers to IANA for more information about example domains.", "https://example.net"),
    ("covenant-005", "The cited page must publish a customer support email address.",
     "example.com publishes a customer support email address.", "https://example.com"),
]


def read(fn, args=None):
    data = [calldata.encode(make_calldata_object(method=fn, args=args or [], kwargs=None)), b"\x00"]
    req = {"type": "read", "to": ADDR, "from": ACCT.address, "data": serialize(data), "transaction_hash_variant": "latest-final"}
    r = C.provider.make_request(method="gen_call", params=[req])["result"]
    if isinstance(r, dict):
        if r.get("status", {}).get("code") != 0:
            return {"_err": r.get("status"), "stderr": r.get("stderr")}
        return calldata.decode(eth_utils.hexadecimal.decode_hex("0x" + r["data"]))
    return calldata.decode(eth_utils.hexadecimal.decode_hex("0x" + r))


def wait(txh, timeout=900):
    t0 = time.time()
    while time.time() - t0 < timeout:
        s = C.provider.make_request(method="gen_getTransactionStatus", params=[{"txId": txh}])["result"]
        code = s.get("statusCode")
        print(f"  {txh[:12]}.. {s.get('status')}({code})")
        if code in (5, 7):
            return
        if code in (11, 12, 13):
            raise SystemExit(f"TERMINAL-BAD {s}")
        time.sleep(12)
    raise SystemExit("timeout")


def write(fn, args):
    txh = C.write_contract(address=ADDR, function_name=fn, account=ACCT, args=args)
    txh = txh if isinstance(txh, str) else eth_utils.hexadecimal.encode_hex(txh)
    print(" tx:", txh)
    wait(txh)
    return txh


cmd = sys.argv[1]
if cmd == "openall":
    for cov in COVENANTS:
        print("open_case", cov[0])
        write("open_case", list(cov))
    print("count =", read("case_count"))
elif cmd == "crank":
    write("crank", [int(sys.argv[2])])
    print(read("get_case", [int(sys.argv[2])]))
elif cmd == "finalize":
    write("finalize", [int(sys.argv[2])])
    print(read("get_settlement", [int(sys.argv[2])]))
elif cmd == "list":
    n = int(read("case_count"))
    for i in range(1, n + 1):
        c = read("get_case", [i])
        print(f"#{i} [{c['status']}] {c['verdict']} {c['payout_bps']}bps :: {c['clause_text'][:60]}")
