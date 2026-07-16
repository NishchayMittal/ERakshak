import re
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


def detect_chain(address: str) -> str:
    """Detect blockchain from address format."""
    addr = address.strip()
    if re.match(r'^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$', addr):
        return "bitcoin"
    if re.match(r'^bc1[a-z0-9]{6,87}$', addr, re.IGNORECASE):
        return "bitcoin"
    if re.match(r'^0x[0-9a-fA-F]{40}$', addr):
        return "ethereum"
    if re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', addr):
        return "solana"  # rough check
    return "unknown"


class WalletLookupConnector(BaseConnector):
    name = "wallet_lookup"
    applies_to = (IdentifierType.wallet,)
    timeout_seconds = 8.0
    max_retries = 0

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        address = identifier_value.strip()
        chain = detect_chain(address)
        findings: list[Finding] = []

        # Always emit the chain detection finding
        findings.append(Finding(
            connector_name=self.name,
            result_type="wallet_chain",
            result_value=f"{chain.title()} address: {address}",
            confidence=0.95 if chain != "unknown" else 0.5,
            raw_payload={"chain": chain, "address": address}
        ))

        if chain == "bitcoin":
            findings.extend(await self._query_bitcoin(address))
        elif chain == "ethereum":
            findings.extend(await self._query_ethereum(address))
        else:
            # For unknown/Solana — try Blockchair generic lookup
            findings.extend(await self._query_blockchair_generic(address, chain))

        return findings

    async def _query_bitcoin(self, address: str) -> list[Finding]:
        """Use blockchain.info rawaddr API — free, no key needed."""
        findings = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                follow_redirects=True,
                headers={"User-Agent": "e-Rakshak-OSINT/1.0"}
            ) as c:
                r = await c.get(
                    f"https://blockchain.info/rawaddr/{address}",
                    params={"limit": "5"}
                )
                if r.status_code == 200:
                    d = r.json()
                    balance_sat   = d.get("final_balance", 0)
                    balance_btc   = balance_sat / 1e8
                    n_tx          = d.get("n_tx", 0)
                    received_sat  = d.get("total_received", 0)
                    received_btc  = received_sat / 1e8
                    sent_sat      = d.get("total_sent", 0)
                    sent_btc      = sent_sat / 1e8

                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="wallet_balance",
                        result_value=f"{balance_btc:.8f} BTC (current balance)",
                        confidence=1.0,
                        raw_payload={"chain": "bitcoin", "balance_satoshi": balance_sat, "balance_btc": balance_btc}
                    ))
                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="wallet_transactions",
                        result_value=f"{n_tx} total transactions | Received: {received_btc:.8f} BTC | Sent: {sent_btc:.8f} BTC",
                        confidence=1.0,
                        raw_payload={"n_tx": n_tx, "total_received_btc": received_btc, "total_sent_btc": sent_btc}
                    ))
                    # Recent transactions
                    for tx in d.get("txs", [])[:3]:
                        tx_hash = tx.get("hash", "")
                        tx_time = tx.get("time", 0)
                        from datetime import datetime
                        tx_date = datetime.utcfromtimestamp(tx_time).strftime("%Y-%m-%d") if tx_time else "unknown"
                        if tx_hash:
                            findings.append(Finding(
                                connector_name=self.name,
                                result_type="wallet_tx",
                                result_value=f"TX {tx_hash[:16]}... ({tx_date})",
                                confidence=1.0,
                                raw_payload={"txid": tx_hash, "date": tx_date}
                            ))
        except Exception:
            pass
        return findings

    async def _query_ethereum(self, address: str) -> list[Finding]:
        """Use Blockcypher API — free, no key needed for basic balance."""
        findings = []
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                follow_redirects=True,
                headers={"User-Agent": "e-Rakshak-OSINT/1.0"}
            ) as c:
                r = await c.get(
                    f"https://api.blockcypher.com/v1/eth/main/addrs/{address}/balance"
                )
                if r.status_code == 200:
                    d = r.json()
                    balance_wei   = d.get("balance", 0)
                    balance_eth   = balance_wei / 1e18
                    n_tx          = d.get("n_tx", 0)
                    received_wei  = d.get("total_received", 0)
                    received_eth  = received_wei / 1e18
                    sent_wei      = d.get("total_sent", 0)
                    sent_eth      = sent_wei / 1e18

                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="wallet_balance",
                        result_value=f"{balance_eth:.6f} ETH (current balance)",
                        confidence=1.0,
                        raw_payload={"chain": "ethereum", "balance_wei": balance_wei, "balance_eth": balance_eth}
                    ))
                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="wallet_transactions",
                        result_value=f"{n_tx} total transactions | Received: {received_eth:.6f} ETH | Sent: {sent_eth:.6f} ETH",
                        confidence=1.0,
                        raw_payload={"n_tx": n_tx, "total_received_eth": received_eth, "total_sent_eth": sent_eth}
                    ))
        except Exception:
            pass
        return findings

    async def _query_blockchair_generic(self, address: str, chain: str) -> list[Finding]:
        """Fallback for unknown chain type."""
        return [Finding(
            connector_name=self.name,
            result_type="wallet_note",
            result_value=f"Address format not recognized as Bitcoin or Ethereum. Chain detection: {chain}",
            confidence=0.4,
            raw_payload={"address": address, "chain": chain}
        )]
