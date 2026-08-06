import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "erakshak.db"))
print("DB Path:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get cases
cursor.execute("SELECT id, title, status FROM cases")
cases = cursor.fetchall()
print("\n--- CASES ---")
for c in cases:
    print(c)

# Get identifiers
cursor.execute("SELECT id, type, raw_value, normalized_value, source, case_id FROM identifiers")
identifiers = cursor.fetchall()
print("\n--- IDENTIFIERS ---")
for i in identifiers:
    print(i)

# Get findings
cursor.execute("SELECT id, identifier_id, connector_name, result_type, result_value FROM findings")
findings = cursor.fetchall()
print("\n--- FINDINGS ---")
for f in findings:
    print(f)

# Get audit logs
cursor.execute("SELECT id, action, detail FROM audit_logs ORDER BY timestamp DESC LIMIT 10")
logs = cursor.fetchall()
print("\n--- LATEST AUDIT LOGS ---")
for l in logs:
    print(l)

conn.close()
