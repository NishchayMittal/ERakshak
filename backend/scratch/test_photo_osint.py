import os
import sys
import asyncio

# Adjust Python path to resolve imports from root app folder
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.connectors.exif_extractor import ExifExtractorConnector
from app.connectors.reverse_image import ReverseImageConnector
from app.connectors.canonicalizer import canonicalize_findings, extract_identifier_from_finding
from app.models import IdentifierType, Finding

async def main():
    print("=== Testing Photo OSINT Connectors ===\n")
    
    test_photo = "ronaldo.jpg"
    print(f"Target Image: {test_photo}\n")

    # 1. Test EXIF Extractor
    print("--- Running ExifExtractorConnector ---")
    exif_conn = ExifExtractorConnector()
    exif_raw_findings = await exif_conn.run(test_photo)
    exif_findings = canonicalize_findings(exif_raw_findings)
    for f in exif_findings:
        print(f"[{f.result_type}] -> {f.result_value} (Confidence: {f.confidence})")
        print(f"  Payload: {f.raw_payload}")
    print()

    # 2. Test Reverse Image search
    print("--- Running ReverseImageConnector ---")
    rev_conn = ReverseImageConnector()
    rev_raw_findings = await rev_conn.run(test_photo)
    rev_findings = canonicalize_findings(rev_raw_findings)
    for f in rev_findings:
        print(f"[{f.result_type}] -> {f.result_value} (Confidence: {f.confidence})")
        print(f"  Payload: {f.raw_payload}")
    print()

    # 3. Test Canonicalizer pivoting
    print("--- Testing Pivot Extraction ---")
    all_findings = exif_findings + rev_findings
    for f in all_findings:
        # Mock database model instance mapping for extract_identifier_from_finding
        db_finding = Finding(
            connector_name=f.connector_name,
            result_type=f.result_type,
            result_value=f.result_value,
            confidence=f.confidence,
            raw_payload=f.raw_payload
        )
        
        pivot = extract_identifier_from_finding(db_finding)
        if pivot:
            p_type, p_val = pivot
            print(f"Pivot Found: {f.result_type} -> Extracted {p_type.value}: {p_val}")

if __name__ == "__main__":
    asyncio.run(main())
