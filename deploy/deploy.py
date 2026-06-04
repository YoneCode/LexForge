"""Deploy LexForge to GenLayer Testnet Bradbury (chain 4221).

Reads ACCOUNT_PRIVATE_KEY from .env (never printed). The account must be funded
via the faucet first: https://testnet-faucet.genlayer.foundation/

    .venv/bin/python deploy/deploy.py
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from genlayer_py import create_account, create_client
from genlayer_py.chains import testnet_bradbury
from genlayer_py.types.transactions import TransactionStatus

load_dotenv()

key = os.environ.get("ACCOUNT_PRIVATE_KEY", "")
if not key or set(key.replace("0x", "")) <= {"0"}:
    raise SystemExit("ACCOUNT_PRIVATE_KEY missing/placeholder in .env. Run: nano .env")

account = create_account(key)
client = create_client(chain=testnet_bradbury, account=account)
code = Path("contracts/lexforge.py").read_text()

print(f"Deploying LexForge to {testnet_bradbury.name} (chain {testnet_bradbury.id}) as {account.address}")
tx_hash = client.deploy_contract(code=code, account=account)
print("deploy tx:", tx_hash)

receipt = client.wait_for_transaction_receipt(
    transaction_hash=tx_hash, status=TransactionStatus.FINALIZED, interval=5000, retries=60
)
status = getattr(receipt, "status", receipt)
address = getattr(receipt, "contract_address", None) or getattr(
    getattr(receipt, "data", None), "contract_address", None
)
print("status:", status)
print("contract address:", address)
print(f"explorer: https://explorer-bradbury.genlayer.com/contracts/{address}")
