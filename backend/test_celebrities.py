#!/usr/bin/env python3
"""
Test script to verify OSINT connectors work with celebrity examples.
This tests the improved connectors to ensure they eliminate hallucinations
and provide accurate results for well-known public figures.
"""

import asyncio
import sys
import os

# Add the app directory to the path so we can import connectors
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from connectors.social_profiler import SocialProfilerConnector
from connectors.username_enum import UsernameEnumConnector
from connectors.breach_lookup import BreachLookupConnector
from connectors.base import BaseConnector


async def test_social_profiler():
    """Test social profiler connector with celebrity usernames/names."""
    print("=" * 60)
    print("Testing Social Profiler Connector")
    print("=" * 60)

    connector = SocialProfilerConnector()

    # Test cases: (input, expected_platforms, description)
    test_cases = [
        # Instagram tests
        ("instagram", ["instagram"], "Instagram's own account"),
        ("natgeo", ["instagram"], "National Geographic"),
        ("cristiano", ["instagram"], "Cristiano Ronaldo"),
        ("taylorswift13", ["instagram"], "Taylor Swift"),
        ("virat.kohli", ["instagram"], "Virat Kohli"),

        # LinkedIn tests
        ("satya nadella", ["linkedin"], "Satya Nadella - Microsoft CEO"),
        ("sundar pichai", ["linkedin"], "Sundar Pichai - Google CEO"),
        ("tim cook", ["linkedin"], "Tim Cook - Apple CEO"),
        ("bill gates", ["linkedin"], "Bill Gates - Microsoft co-founder"),
        ("elon musk", ["linkedin"], "Elon Musk - Tesla/SpaceX CEO"),

        # Edge cases that should NOT return demo data
        ("suspect", [], "Should NOT return demo data (removed)"),
        ("test_user", [], "Should NOT return demo data (removed)"),
        ("agent", [], "Should NOT return demo data (removed)"),
    ]

    for username, expected_platforms, description in test_cases:
        print(f"\nTesting: {username} ({description})")
        try:
            findings = await connector.run(username)
            if findings:
                print(f"  Found {len(findings)} result(s):")
                for finding in findings:
                    print(f"    - {finding.result_type}: {finding.result_value}")
                    print(f"      Confidence: {finding.confidence}")
                    if finding.raw_payload:
                        print(f"      Payload keys: {list(finding.raw_payload.keys())}")
            else:
                print("  No results found")

            # Check if we got unexpected demo data
            demo_indicators = ["suspect", "test_user", "agent"]
            for finding in findings:
                for indicator in demo_indicators:
                    if indicator in finding.result_value.lower():
                        print(f"    !! WARNING: Found demo data indicator '{indicator}' in result!")

        except Exception as e:
            print(f"  ERROR: {e}")


async def test_username_enum():
    """Test username enum connector with celebrity usernames."""
    print("\n" + "=" * 60)
    print("Testing Username Enumeration Connector")
    print("=" * 60)

    connector = UsernameEnumConnector()

    # Test cases: (username, expected_platforms, description)
    test_cases = [
        # GitHub tests (using known usernames)
        ("defunkt", ["GitHub"], "GitHub co-founder Chris Wanstrath"),
        ("mojombo", ["GitHub"], "GitHub co-founder Tom Preston-Werner"),
        ("linus", ["GitHub"], "Linus Torvalds (if exists)"),

        # Instagram tests (should now use flexible matching)
        ("instagram", ["Instagram"], "Instagram's own account"),
        ("natgeo", ["Instagram"], "National Geographic"),

        # Reddit tests
        ("spez", ["Reddit"], "Reddit co-founder spez"),
        ("kn0thing", ["Reddit"], "Reddit co-founder Alexis Ohanian"),
    ]

    for username, expected_platforms, description in test_cases:
        print(f"\nTesting username: {username} ({description})")
        try:
            findings = await connector.run(username)
            if findings:
                print(f"  Found {len(findings)} result(s):")
                for finding in findings:
                    site_name = finding.raw_payload.get("site_name", "Unknown") if finding.raw_payload else "Unknown"
                    print(f"    - {site_name} Profile: {finding.result_value}")
                    print(f"      Confidence: {finding.confidence}")
                    if finding.raw_payload and "profile_url" in finding.raw_payload:
                        print(f"      URL: {finding.raw_payload['profile_url']}")
            else:
                print("  No results found")

        except Exception as e:
            print(f"  ERROR: {e}")


async def test_breach_lookup():
    """Test breach lookup connector with example emails."""
    print("\n" + "=" * 60)
    print("Testing Breach Lookup Connector")
    print("=" * 60)

    connector = BreachLookupConnector()

    # Test cases: (email, description)
    # Note: Using hypothetical/test emails since we don't want to use real celebrity emails
    test_cases = [
        ("test@example.com", "Test email with valid MX"),
        ("nonexistent@fakedomain12345.com", "Email with no MX records (should have lower confidence)"),
        ("user@gmail.com", "Gmail address (should get Gmail confidence boost)"),
        ("user@yahoo.com", "Yahoo address"),
    ]

    for email, description in test_cases:
        print(f"\nTesting email: {email} ({description})")
        try:
            findings = await connector.run(email)
            if findings:
                print(f"  Found {len(findings)} result(s):")
                for finding in findings:
                    print(f"    - Breach lookup: {finding.result_value}")
                    print(f"      Confidence: {finding.confidence}")
                    if finding.raw_payload:
                        print(f"      Payload keys: {list(finding.raw_payload.keys())}")
            else:
                print("  No results found")

        except Exception as e:
            print(f"  ERROR: {e}")


async def main():
    """Run all tests."""
    print("Starting OSINT Connector Tests with Celebrity Examples")
    print("This tests the improved connectors to verify they eliminate hallucinations")
    print("and provide accurate results.\n")

    await test_social_profiler()
    await test_username_enum()
    await test_breach_lookup()

    print("\n" + "=" * 60)
    print("Testing Complete")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())