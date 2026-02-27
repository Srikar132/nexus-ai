# 1. Run Redis docker 
Firstly ensure docker desktop is running
cd server
docker-compose up -d redis

# 2. Setup server dependencies (In new terminal)
cd server
python -m venv venv (for first time)
.\venv\Scripts\Activate
pip install -r requirements.txt

# 3. Start celery service (In same redis terminal after pulling image)
./start_celery.ps1

# 4. Run server
python -m app.main

# 5. Setup client dependencies (first time only)
cd ../client
npm install
npm run dev


