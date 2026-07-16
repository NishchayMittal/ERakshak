"""Full validation: phone, domain (wayback fix), wallet, photo."""
import asyncio, sys
sys.path.insert(0, '.')

from app.connectors.phone_lookup import PhoneLookupConnector
from app.connectors.wallet_lookup import WalletLookupConnector
from app.connectors.wayback import WaybackConnector
from app.connectors.whois import WhoisConnector

SEP = "-" * 60

async def run(connector, value, label=""):
    results = await connector.run(value, metadata={})
    tag = label or connector.name
    print(f"\n  [{tag}] ({len(results)} findings)")
    for r in results:
        print(f"    {r.result_type:22s}  {str(r.result_value)[:72]}")
    if not results:
        print("    (none)")

async def main():
    phone  = PhoneLookupConnector()
    wallet = WalletLookupConnector()
    wb     = WaybackConnector()
    whois  = WhoisConnector()

    # ── PHONE ──────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("TEST: phone = +919876543210 (Indian mobile)")
    await run(phone, "+919876543210")

    print(f"\n{'='*60}")
    print("TEST: phone = +14155552671 (US number)")
    await run(phone, "+14155552671")

    print(f"\n{'='*60}")
    print("TEST: phone = 9825012345 (bare Indian number, no country code)")
    await run(phone, "9825012345")

    # ── DOMAIN (wayback fix) ────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("TEST: domain = google.com (Wayback CDX wildcard)")
    await run(wb, "google.com")

    print(f"\n{'='*60}")
    print("TEST: domain = google.com (WHOIS - no abuse email)")
    await run(whois, "google.com")

    # ── CRYPTO WALLET ───────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("TEST: wallet = Bitcoin Satoshi genesis block address")
    await run(wallet, "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf Na")  # famous addr

    print(f"\n{'='*60}")
    print("TEST: wallet = real Bitcoin address (Satoshi genesis)")
    await run(wallet, "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")

    print(f"\n{'='*60}")
    print("TEST: wallet = Ethereum Vitalik's donation addr")
    await run(wallet, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")

    print(f"\n{'='*60}")
    print("TEST: wallet = fake random string (should detect unknown)")
    await run(wallet, "XXNOTAWALLET12345678900")

asyncio.run(main())
