import os
import re

files = [
    'app/routers/__init__.py', 'app/routers/search.py', 'app/routers/learn.py', 
    'app/routers/history.py', 'app/routers/detective.py', 'app/routers/explore.py', 
    'app/routers/comic.py', 'app/routers/admin.py', 'app/routers/awareness.py', 
    'app/services/rag.py', 'vector/search.py'
]

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file_in:
            content = file_in.read()
            
        content = content.replace('laws_collection', 'bns_collection')
        content = re.sub(r'bns_collection,\s*bns_collection', 'bns_collection', content)
        
        with open(f, 'w', encoding='utf-8') as file_out:
            file_out.write(content)

print("Refactoring complete.")
