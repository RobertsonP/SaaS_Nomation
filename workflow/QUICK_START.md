# 🚀 NOMATION - QUICK START GUIDE

## 📁 Project Management Commands

Use these 3 simple batch files to manage your Nomation project:

### ▶️ `start.bat` - Start Project
```
Double-click or run: start.bat
```
**What it does:**
- Starts all services (Database, Backend, Frontend, AI)
- Sets up Ollama AI with required models
- Shows service status and access URLs
- **Use this for normal project startup**

### 🔄 `restart.bat` - Complete Restart
```
Double-click or run: restart.bat
```
**What it does:**
- Stops all services completely
- Rebuilds Docker images from scratch
- Starts fresh containers
- Reapplies database migrations
- **Use this when you have issues or after code changes**

### ⏹️ `stop.bat` - Stop Project
```
Double-click or run: stop.bat
```
**What it does:**
- Gracefully stops all services
- Preserves database data
- Cleans up Docker networks
- **Use this to shut down the project**

## 🌐 Access URLs (After Start)

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3001 | Main application interface |
| **Backend API** | http://localhost:3002 | REST API endpoints |
| **Database Admin** | http://localhost:5555 | Prisma Studio (optional) |

## 🔐 Default Login
- **Email:** `test@test.com`
- **Password:** `test`

## 🆘 Troubleshooting

### If services fail to start:
1. Run `restart.bat` for a fresh start
2. Check Docker Desktop is running
3. Ensure ports 3001, 3002, 5432, 11434 are available

### If AI features don't work:
1. Wait for Ollama model download to complete
2. Check logs: `docker-compose logs -f ollama`

### View detailed logs:
```bash
docker-compose logs -f [service-name]
# Examples:
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ollama
```

## 🎯 Next Steps

1. **Start the project:** Double-click `start.bat`
2. **Open browser:** Navigate to http://localhost:3001
3. **Login or register** a new account
4. **Create your first project** with multiple URLs
5. **Test AI element analysis** on your web pages
6. **Build automated tests** with the visual test builder

---

🎉 **You're ready to use Nomation's no-code test automation platform!**