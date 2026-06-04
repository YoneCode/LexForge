"""Build a real caseId -> tx-hash map from chain (crank tx per case)."""
import json, os
from pathlib import Path
from dotenv import load_dotenv
from genlayer_py import create_account, create_client
from genlayer_py.chains import testnet_bradbury

load_dotenv(dotenv_path=str(Path(__file__).resolve().parent.parent / ".env"), override=True)
C = create_client(chain=testnet_bradbury, account=create_account(os.environ["ACCOUNT_PRIVATE_KEY"]))
ADDR = "0x6a028b7BF87F32583eC5f79F12756b6b4ab338eA"

cd = testnet_bradbury.consensus_data_contract
k = C.w3.eth.contract(address=C.w3.to_checksum_address(cd["address"]), abi=cd["abi"])
rec = C.w3.to_checksum_address(ADDR)
ids = []
for fn in ("getLatestFinalizedTransactions", "getLatestAcceptedTransactions"):
    try:
        rows = getattr(k.functions, fn)(rec, 0, 100).call()
        for r in rows:
            tid = r[18] if len(r) > 18 else None  # txId field
            if isinstance(tid, (bytes, bytearray)):
                ids.append("0x" + tid.hex())
    except Exception as e:
        print(fn, "err", e)

seen, full = set(), []
for tid in ids:
    if tid not in seen:
        seen.add(tid); full.append(tid)

# crank tx prefixes observed during seeding (resolved to full hashes from chain)
CRANK = {"1": "0xabdb3b96f9", "2": "0xa95c312f3d", "3": "0xbfa890d8df", "4": "0x6993249f1e", "5": "0x431a5fa541"}
mp = {}
for cid, pref in CRANK.items():
    m = [t for t in full if t.startswith(pref)]
    if m:
        mp[cid] = m[0]

print("MAP", json.dumps(mp, indent=2))
out = Path(__file__).resolve().parent.parent / "web/src/lib/seededTx.json"
out.write_text(json.dumps(mp, indent=2))
print("wrote", out, "·", len(mp), "entries")
