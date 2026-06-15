import re

with open('app/routers/quiz.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix bns_pool definition
content = re.sub(
    r'bns_pool\s*=\s*\[b for b in bns_sections if b\.get\("title"\)\]',
    'bns_pool      = [b for b in bns_sections if b.get("title") or b.get("section_title") or b.get("Offense")]',
    content
)

# Fix _build_question_from_bns title/section access
content = re.sub(
    r'title\s*=\s*\(bns_law\.get\("title"\) or ""\)\.strip\(\)\n\s*section\s*=\s*\(bns_law\.get\("section_number"\) or ""\)\.strip\(\)',
    'title   = (bns_law.get("title") or bns_law.get("section_title") or bns_law.get("Offense") or "").strip()\n    section = str(bns_law.get("section_number") or bns_law.get("Section") or "").strip()',
    content
)

# Relax ipc_section_id
content = re.sub(
    r'if len\(all_ipc_sections\) >= 3:\n\s*q_types\.append\("ipc_section_id"\)',
    'q_types.append("ipc_section_id")',
    content
)

# Relax category
content = re.sub(
    r'if category and category in _CATEGORIES:\n\s*q_types\.append\("category"\)',
    'if category:\n        q_types.append("category")',
    content
)

# Change _build_ipc_question category implementation to safely sample
content = re.sub(
    r'dist_cats = \[c for c in _CATEGORIES if c != category\]\n\s*random\.shuffle\(dist_cats\)\n\s*options, correct_label = _make_labeled\(category, dist_cats\[:3\]\)',
    'all_cats = list({l.get("category") for l in all_laws if l.get("category") and l.get("category") != category})\n        dist_cats = all_cats if len(all_cats) >= 3 else [c for c in _CATEGORIES if c != category]\n        random.shuffle(dist_cats)\n        options, correct_label = _make_labeled(category, dist_cats[:3])',
    content
)

# Relax bns_section_id
content = re.sub(
    r'if desc and len\(desc\) > 40:\n\s*q_types\.append\("bns_section_id"\)',
    'q_types.append("bns_section_id")',
    content
)

# Relax bns_chapter
content = re.sub(
    r'if chapter and chapter in _BNS_CHAPTERS:\n\s*q_types\.append\("bns_chapter"\)',
    'if chapter:\n        q_types.append("bns_chapter")',
    content
)

# Change _build_question_from_bns chapter implementation to safely sample
content = re.sub(
    r'dist_chapters = \[c for c in _BNS_CHAPTERS if c != chapter\]\n\s*random\.shuffle\(dist_chapters\)\n\s*options, correct_label = _make_labeled\(chapter, dist_chapters\[:3\]\)',
    'all_chapters = list({b.get("chapter") for b in all_bns if b.get("chapter") and b.get("chapter") != chapter})\n        dist_chapters = all_chapters if len(all_chapters) >= 3 else [c for c in _BNS_CHAPTERS if c != chapter]\n        random.shuffle(dist_chapters)\n        options, correct_label = _make_labeled(chapter, dist_chapters[:3])',
    content
)

with open('app/routers/quiz.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched successfully.")
