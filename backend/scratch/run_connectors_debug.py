import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

from app.database import SessionLocal
from app.models import Identifier, IdentifierType
from app.connectors import register_all
from app.connectors.runner import run_connectors_and_pivot

async def main():
    register_all()
    db = SessionLocal()
    try:
        # Find the latest photo identifier
        ident = db.query(Identifier).filter(Identifier.type == IdentifierType.photo).order_by(Identifier.timestamp.desc()).first()
        if not ident:
            print("No photo identifier found in DB!")
            return
        
        print(f"Running connectors for identifier: {ident.id} ({ident.normalized_value})")
        
        # We need a dummy investigator ID
        findings = await run_connectors_and_pivot(db, ident, ident.investigator_id, 0)
        print(f"Run completed. Discovered {len(findings)} findings.")
        for f in findings:
            print(f"- {f.connector_name}: {f.result_type} = {f.result_value} (conf: {f.confidence})")
    except Exception as e:
        print("Error during execution:")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
