import os

files = [
    "README.md",
    "backend/app/auth.py",
    "backend/app/config.py",
    "backend/app/narrative.py",
    "backend/app/routers/cases.py",
    "backend/app/worker.py",
    "backend/requirements.txt",
    "frontend/src/components/layout/Sidebar.tsx",
    "requirements.txt"
]

for f in files:
    with open(f, "r") as file:
        content = file.read()
    if "<<<<<<< HEAD" in content:
        print(f"\n--- Conflicts in {f} ---")
        lines = content.splitlines()
        in_conflict = False
        for i, line in enumerate(lines):
            if line.startswith("<<<<<<< HEAD"):
                in_conflict = True
                print(f"Start at line {i+1}")
            if in_conflict:
                print(line)
            if line.startswith(">>>>>>>"):
                in_conflict = False
                print(f"End at line {i+1}\n")
