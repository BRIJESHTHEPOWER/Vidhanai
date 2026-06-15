import sys
import random
from app.routers.quiz import _build_full_bank

all_laws_mock = [
    {"ipc_section": "302", "title": "Murder", "bns_section": "103", "category": "Crimes Against Body", "description": "Punishment for murder.", "punishment": "Death or Life"},
    {"ipc_section": "379", "title": "Theft", "bns_section": "303", "category": "Property", "description": "Whoever commits theft.", "punishment": "3 years"},
    {"ipc_section": "376", "title": "Rape", "bns_section": "64", "category": "Women", "description": "Punishment for rape.", "punishment": "10 years to Life"},
    {"ipc_section": "420", "title": "Cheating", "bns_section": "318", "category": "Property", "description": "Cheating and dishonestly.", "punishment": "7 years"}
]
all_bns_mock = [
    {"section_number": "103", "title": "Murder", "chapter": "Offences Affecting Human Body", "description": "Punishment for murder.", "punishment": "Death or Life"},
    {"section_number": "303", "title": "Theft", "chapter": "Offences Against Property", "description": "Whoever commits theft.", "punishment": "3 years"},
    {"section_number": "64", "title": "Rape", "chapter": "Offences Against Women", "description": "Punishment for rape.", "punishment": "10 years to Life"},
    {"section_number": "318", "title": "Cheating", "chapter": "Offences Against Property", "description": "Cheating and dishonestly.", "punishment": "7 years"}
]

print("Testing ipc_only...")
try:
    bank_ipc = _build_full_bank("ipc_only", all_laws_mock, all_bns_mock, all_laws_mock, all_bns_mock, ["3 years", "7 years"])
    print(f"Generated {len(bank_ipc)} IPC questions.")
except Exception as e:
    import traceback
    traceback.print_exc()

print("Testing bns_only...")
try:
    bank_bns = _build_full_bank("bns_only", all_laws_mock, all_bns_mock, all_laws_mock, all_bns_mock, ["3 years", "7 years"])
    print(f"Generated {len(bank_bns)} BNS questions.")
except Exception as e:
    import traceback
    traceback.print_exc()
