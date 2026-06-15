import os

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return # Skip binary files or unreadable files

    new_content = content
    # Order matters: replace longer specific strings first
    new_content = new_content.replace('NyayaAI', 'Vidhan.ai')
    new_content = new_content.replace('nyayaai', 'vidhan.ai')
    new_content = new_content.replace('NayayaAI', 'Vidhan.ai')
    new_content = new_content.replace('Nyaya', 'Vidhan')
    new_content = new_content.replace('nyaya', 'vidhan')

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

def main():
    root_dir = r"d:\ai-legal-system"
    exclude_dirs = {'.git', 'node_modules', '__pycache__', 'dist', 'build', '.venv', 'venv'}
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Exclude directories
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        
        for filename in filenames:
            if filename == "rename_script.py":
                continue
            filepath = os.path.join(dirpath, filename)
            # Only process likely text files based on extension
            if filename.endswith(('.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.txt', '.env')):
                replace_in_file(filepath)

if __name__ == '__main__':
    main()
