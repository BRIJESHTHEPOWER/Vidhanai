from pymongo import MongoClient

def main():
    client = MongoClient('mongodb://127.0.0.1:27017/')
    db = client['ai_legal_system']
    print("Dropping existing indexes on laws collection...")
    db.laws.drop_indexes()
    
    print("Creating new text index...")
    db.laws.create_index([
        ('title', 'text'), 
        ('content', 'text'), 
        ('description', 'text'), 
        ('keywords', 'text'),
        ('ai_summary', 'text')
    ])
    
    print("Indexes recreated successfully!")

if __name__ == "__main__":
    main()
