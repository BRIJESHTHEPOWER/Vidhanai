from dotenv import load_dotenv
load_dotenv()   # must run before app.main imports os.getenv()

from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
