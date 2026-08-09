import os
import re

FRONTEND_SRC = r"c:\Education\SVNIT\Coding\Projects\ERakshak\frontend\src"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern 1: fontSize: 10 or fontSize: 12
    # Avoid matching if it's already a calc or string
    pattern_num = r'fontSize:\s*(\d+)(?!px)(?!\s*[\'"])'
    # Pattern 2: fontSize: '10px' or fontSize: "10px"
    pattern_str = r'fontSize:\s*[\'"](\d+)px[\'"]'

    new_content = content
    
    # Replace numeric font sizes
    new_content = re.sub(pattern_num, r'fontSize: "calc(\1px * var(--font-scale))"', new_content)
    
    # Replace string font sizes
    new_content = re.sub(pattern_str, r'fontSize: "calc(\1px * var(--font-scale))"', new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

def main():
    for root, dirs, files in os.walk(FRONTEND_SRC):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.css')):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
