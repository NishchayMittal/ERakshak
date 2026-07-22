"""
Quick‑and‑dirty sanity‑check for the hardened E_Rakshak connectors.

Run:
    python test_connectors.py

You should see a short table of results.  No external services are
required besides network access and (optionally) a running Redis server
for the caching layer – the code will gracefully fall back to an in‑memory
cache if Redis is not available.
"""

import asyncio
import os
import sys
from typing import List

# ----------------------------------------------------------------------
# Make sure the project root is on the import path so we can do:
#   from app.connectors.xxx import XxxConnector
# ----------------------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.connectors.base import registry, Finding
# Import the concrete connectors we want to test
from app.connectors.breach_lookup import BreachLookupConnector
from app.connectors.gravatar_email import GravatarEmailConnector
from app.connectors.social_profiler import SocialProfilerConnector
from app.connectors.username_enum import UsernameEnumConnector

# ----------------------------------------------------------------------
# Helper to run a coroutine from regular Python code
# ----------------------------------------------------------------------
def run_async(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError:          # already inside a running loop (e.g. notebook)
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(coro)

# ----------------------------------------------------------------------
# Test data – feel free to replace any of these with your own values.
# ----------------------------------------------------------------------
TEST_CASES = [
    # (connector class, label, input value, description)
    (BreachLookupConnector, "Breach‑Lookup (email)", "testbreach123@gmail.com",
     "An address that *might* appear in HIBP/XposedOrNot – if you have never been in a breach you’ll get 0 findings."),
    (GravatarEmailConnector, "Gravatar (email)", "martinfowler@gmail.com",
     "Martin Fowler’s public Gmail – he has a Gravatar, so we expect a profile."),
    (SocialProfilerConnector, "Social‑Profiler (username)", "github",
     "The GitHub organization/user ‘github’ definitely exists on Instagram & LinkedIn (as a brand)."),
    (UsernameEnumConnector, "Username‑Enum (username)", "torvalds",
     "Linus Torvalds’ GitHub handle – should succeed on GitHub, maybe also on other sites."),
]

# ----------------------------------------------------------------------
# Async worker that actually calls a connector and returns a nice summary
# ----------------------------------------------------------------------
async def test_one_connector(cls, label: str, value: str, description: str) -> str:
    # Make sure the connector is registered (idempotent)
    if not any(isinstance(c, cls) for c in registry.all()):
        registry.register(cls())

    connector = next(c for c in registry.all() if isinstance(c, cls))
    # Optional: give the caller a hint about health
    healthy = await connector.check_health()
    health_str = "✅ Healthy" if healthy else "⚠️ Unhealthy"

    # Run the connector
    findings: List[Finding] = await connector.run(value)

    if not findings:
        return (f"{label:<20} | {health_str} | "
                f"❌ No findings for '{value}' ({description})")

    # Take the first (usually highest‑confidence) finding
    f = findings[0]
    return (f"{label:<20} | {health_str} | "
            f"✅ {len(findings)} finding(s) – "
            f"[{f.connector_name}] {f.result_value} "
            f"(confidence: {f.confidence:.2f})")

# ----------------------------------------------------------------------
# Main driver
# ----------------------------------------------------------------------
async def main():
    print("\n=== E_Rakshak Connector Smoke Test ===\n")
    header = f"{'Connector':<20} | Health | Result"
    print(header)
    print("-" * len(header))
    for cls, label, value, desc in TEST_CASES:
        line = await test_one_connector(cls, label, value, desc)
        print(line)
    print("\n✅ Test completed.\n")

if __name__ == "__main__":
    # If you want to see tracebacks on error, leave this as is.
    # For quieter output you can wrap asyncio.run in a try/except.
    asyncio.run(main())

