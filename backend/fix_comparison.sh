#!/bin/bash
# fix_comparison.sh - Fix the comparison feature on Mac/Linux

echo ""
echo "============================================================"
echo "FIXING COMPARISON FEATURE - Running Database Setup"
echo "============================================================"
echo ""

cd "$(dirname "$0")"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 not found. Please install Python 3 first."
    exit 1
fi

# Run the setup script
echo "[INFO] Starting database setup - this may take a minute..."
echo ""

python3 setup_comparison.py

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Setup failed. Please check the errors above."
    exit 1
fi

echo ""
echo "============================================================"
echo "NEXT STEPS:"
echo "============================================================"
echo ""
echo "1. Make sure MongoDB is running:"
echo "   - macOS/Linux: run 'mongod' or 'brew services start mongodb-community'"
echo ""
echo "2. Start the backend:"
echo "   python3 main.py"
echo ""
echo "3. In a new terminal, start the frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "4. Go to http://localhost:3000/compare"
echo "   Search for \"Murder\", \"Theft\", \"Rape\" etc."
echo "   The comparison results should now appear!"
echo ""
echo "============================================================"
echo ""
