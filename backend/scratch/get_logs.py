import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "erakshak.db"))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, action, detail, timestamp FROM audit_logs WHERE action IN ('connector.run', 'identifier.create') ORDER BY timestamp DESC LIMIT 20")
logs = cursor.fetchall()
print("\n--- CONNECTOR RUNS & CREATIONS ---")
for l in logs:
    print(l)

conn.close()
