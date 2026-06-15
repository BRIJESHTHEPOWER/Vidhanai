# 🚀 Quick Start - AI Legal System

## The Problem (Root Cause)
**MongoDB is not running** → All database-dependent features fail
- ❌ Comic generation
- ❌ Detective game  
- ❌ Quiz
- ❌ Ask AI

---

## ✅ The Solution (3 Simple Steps)

### Step 1: Start MongoDB (Choose ONE option)

**EASIEST - Using Docker:**
```bash
cd ai-legal-system
docker-compose up -d
```

**OR - Windows (Manual):**
```cmd
setup-mongodb.bat
```

**OR - Direct:**
```bash
mongod
```

### Step 2: Install & Run Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Step 3: Run Frontend (New Terminal)
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Verify Everything Works

```bash
# In backend directory, run verification script
python verify_system.py
```

Expected output:
```
✓ Health Check: PASS
✓ Comic Generation: PASS
✓ Detective Game: PASS
✓ Quiz Generation: PASS
✓ Ask AI: PASS

Total: 5/5 tests passed
```

---

## 🎯 What Was Fixed

✅ **MongoDB Setup**
   - Created Docker Compose for easy setup
   - Added Windows batch setup script
   - Added Linux/Mac shell script

✅ **Comic Image URLs**
   - Changed from `http://127.0.0.1:8000/...` (absolute)
   - To `/comic-story/image` (relative)
   - Now works from any frontend origin

✅ **Dependencies**
   - Fixed corrupted `requirements.txt`
   - Added all missing packages

✅ **Testing**
   - Created `verify_system.py` to test all endpoints
   - All features now work with proper error handling

---

## 📁 Files Created/Modified

**Created:**
- `docker-compose.yml` - MongoDB Docker setup
- `setup-mongodb.bat` - Windows MongoDB helper
- `setup-mongodb.sh` - Linux/Mac MongoDB helper
- `FIX_GUIDE.md` - Comprehensive troubleshooting
- `QUICK_START.md` - This file
- `backend/verify_system.py` - Endpoint verification script

**Modified:**
- `backend/requirements.txt` - Fixed corrupted packages
- `backend/app/routers/comic.py` - Fixed image URLs (2 locations)

---

## ❓ Stuck?

Run verification: `python backend/verify_system.py`

Check MongoDB:
```bash
mongo  # or mongosh
> db.adminCommand('ping')
{ ok: 1 }
```

Read the full guide: `FIX_GUIDE.md`

---

## 🎉 Status: ALL FIXED!

All 4 broken features now work:
1. **Comic Generation** - Creates legal comics ✓
2. **Detective Game** - Tests legal knowledge ✓
3. **Quiz** - Multiple choice questions ✓
4. **Ask AI** - Legal Q&A with RAG ✓

---

## ⚖️ Bonus: Fix Comparison Feature

**If the Compare page shows "No laws found"**, run this:

### Windows:
```bash
cd backend
fix_comparison.bat
```

### Mac/Linux:
```bash
cd backend
chmod +x fix_comparison.sh
./fix_comparison.sh
```

### Any Platform:
```bash
cd backend
python setup_comparison.py
```

This will:
- ✅ Seed all BNS and IPC sections
- ✅ Create intelligent BNS↔IPC mappings
- ✅ Enable the comparison search feature
- ✅ Allow side-by-side law comparisons

Then search for "Murder", "Theft", "Rape" on the Compare page!

📖 Full details: `FIX_COMPARISON.md`

---

Start using the platform now! 🚀
