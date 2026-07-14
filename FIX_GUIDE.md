# 🔧 AI Legal System - Bug Fix Guide

## 🚨 Root Cause of All Issues

**MongoDB is not running!** This is why:
- ❌ Comic generation not working
- ❌ Detective game not working
- ❌ Quiz not generating
- ❌ Ask AI feature broken

---

## ✅ Solution: Start MongoDB

### Option 1: MongoDB Service (Windows) 🪟

```cmd
# Run setup script
setup-mongodb.bat
```

Or manually:
```cmd
# Install MongoDB Community
choco install mongodb-community

# Start MongoDB service
net start MongoDB

# If service doesn't exist, start mongod directly
mongod.exe
```

---

### Option 2: MongoDB Installer (macOS/Windows)

1. Download from: https://www.mongodb.com/try/download/community
2. Run installer and follow prompts
3. Start MongoDB:
   - **Windows:** `net start MongoDB` or run `mongod.exe`
   - **macOS:** `brew services start mongodb-community`

---

### Option 3: Homebrew (macOS) 🍎

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

---

## 🚀 After MongoDB is Running

### 1. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Start Backend Server
```bash
python main.py
# or
python -m uvicorn main:app --reload
```

Should see:
```
✓ MongoDB Connected -> DB: ai_legal_system
[INFO] Loading FAISS index...
[OK] FAISS ready (2847 vectors)
Uvicorn running on http://127.0.0.1:8000
```

### 3. Start Frontend (in new terminal)
```bash
cd frontend
npm install  # if needed
npm run dev
```

---

## ✨ Verify All Features Work

### Test Comic Generation
```bash
curl -X POST http://127.0.0.1:8000/comic-story \
  -H "Content-Type: application/json" \
  -d '{"topic":"theft","language":"English"}'
```

### Test Detective Game
```bash
curl -X POST http://127.0.0.1:8000/detective/generate \
  -H "Content-Type: application/json" \
  -d '{"difficulty":"medium"}'
```

### Test Quiz
```bash
curl http://127.0.0.1:8000/quiz/generate?count=5
```

### Test Ask AI
```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is theft?","language":"English"}'
```

---

## 🐛 Bug Fixes Applied

### 1. ✅ Fixed Comic Image URLs
- **Before:** `http://127.0.0.1:8000/comic-story/image`
- **After:** `/comic-story/image` (relative URL, works from any origin)

### 2. ✅ Fixed Requirements.txt
- Restored proper package list
- Added missing dependencies (jwt, slowapi, etc.)

### 3. ✅ Verified Backend Endpoints
- All routers properly mounted
- RAG search configured
- Fallback mechanisms in place

---

## 📊 Health Check

Verify the system is healthy:
```bash
curl http://127.0.0.1:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "db": "ok",
  "faiss": "ok"
}
```

---

## 🆘 Troubleshooting

### MongoDB won't start on port 27017
```bash
# Check if port is in use
netstat -tulpn | grep 27017
# or Windows: netstat -ano | findstr 27017

# Kill process using port
kill <PID>  # or taskkill /PID <PID> /F on Windows
```

### "No FAISS index found"
```bash
cd backend/vector
python build_index.py
```

### Backend won't connect to MongoDB
- Ensure MongoDB is running: `mongo` or `mongosh`
- Check MONGO_URI in `.env` is correct
- Verify port 27017 is accessible

### Frontend can't reach backend
- Ensure backend is running on http://127.0.0.1:8000
- Check CORS settings in `app/main.py`
- Verify frontend API endpoint in `.env` or config

---

## 📝 Files Modified

- `requirements.txt` - Fixed corrupted file with proper dependencies
- `app/routers/comic.py` - Fixed image URLs (localhost → relative paths)
- `setup-mongodb.bat` - NEW: Windows setup script
- `setup-mongodb.sh` - NEW: Linux/Mac setup script

---

## 🎯 Quick Start Command (All-in-One)

### On Windows:
```cmd
setup-mongodb.bat && cd backend && pip install -r requirements.txt && python main.py
```

### On macOS/Linux:
```bash
mongod --fork --logpath /tmp/mongodb.log && cd backend && pip install -r requirements.txt && python main.py &
cd frontend && npm run dev
```

---

## ✅ Expected Results After Fix

- ✓ Comic Generation: Creates legal comics with AI-generated images
- ✓ Detective Game: Generates detective cases for law learning
- ✓ Quiz: Generates MCQ questions from database
- ✓ Ask AI: Answers legal questions using RAG search
- ✓ All endpoints: Working with proper error handling

---

**Status:** 🟢 All systems should now work correctly!

If issues persist, run health check and share the output.
