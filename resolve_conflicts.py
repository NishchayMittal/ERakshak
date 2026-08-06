import os
import re

files_to_resolve = [
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

for filepath in files_to_resolve:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()

    # We will just replace the conflict markers.
    # For requirements.txt, we union.
    # For python/tsx code, let's keep both sides for now and we will fix syntax if needed, or just keep HEAD for logic and union for imports.
    # Actually, keeping HEAD is safest for logic. Let's just keep HEAD for cases.py, narrative.py, auth.py, README.
    
    if filepath in ["backend/requirements.txt", "requirements.txt", "backend/app/config.py", "backend/app/worker.py", "frontend/src/components/layout/Sidebar.tsx"]:
        # Keep both sides
        content = re.sub(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [a-f0-9]+', r'\1\n\2', content, flags=re.DOTALL)
    else:
        # Keep HEAD
        content = re.sub(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [a-f0-9]+', r'\1', content, flags=re.DOTALL)

    with open(filepath, 'w') as f:
        f.write(content)

os.system("git add README.md backend/app/auth.py backend/app/config.py backend/app/connectors/face_matcher.py backend/app/narrative.py backend/app/routers/cases.py backend/app/worker.py backend/requirements.txt frontend/src/components/layout/Sidebar.tsx requirements.txt")
