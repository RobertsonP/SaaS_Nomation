# 🐳 Nomation Platform - Docker Setup

This Docker setup provides a complete development environment for the Nomation test automation platform with **zero configuration required**.

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Start the Platform
**Windows:**
```cmd
docker-start.bat
```

**Linux/Mac:**
```bash
docker-compose up --build -d
```

### Access the Platform
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3002  
- **Database**: localhost:5432
- **Prisma Studio** (optional): http://localhost:5555

## 📦 What's Included

### Services
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: NestJS + TypeScript + Prisma
- **Database**: PostgreSQL 15
- **Browser Automation**: Playwright with Chromium

### Features Preserved
- ✅ **Drag-and-Drop Test Builder** - All @dnd-kit functionality
- ✅ **Visual Element Picker** - Click elements on live websites
- ✅ **Enhanced Element Detection** - Improved rule-based AI
- ✅ **Real-time Validation** - Selector quality scoring
- ✅ **Element Library** - Smart element suggestions
- ✅ **Database Schema** - Complete Prisma setup

## 🔧 Development Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Database Management
```bash
# Start Prisma Studio
docker-compose --profile tools up prisma-studio -d

# Run migrations
docker-compose exec backend npx prisma migrate dev

# Reset database
docker-compose exec backend npx prisma migrate reset
```

### Stop Platform
**Windows:**
```cmd
docker-stop.bat
```

**Linux/Mac:**
```bash
docker-compose down
```

## 🛠️ Development Features

### Hot Reload
- **Frontend**: Automatic reload on file changes
- **Backend**: Automatic restart on file changes  
- **Database**: Persistent data across restarts

### Volume Mounts
- Source code is mounted for live editing
- Node modules are preserved in named volumes
- Database data persists across container restarts

### Environment Variables
Copy `env.example` to `.env` and customize as needed:
```bash
cp env.example .env
```

## 🐛 Troubleshooting

### Port Conflicts
If ports are in use, modify `docker-compose.yml`:
```yaml
ports:
  - "3001:3001"  # Change to "3003:3001" for frontend
  - "3002:3002"  # Change to "3004:3002" for backend
```

### Rebuild Services
```bash
# Rebuild all services
docker-compose build --no-cache

# Rebuild specific service
docker-compose build --no-cache backend
```

### Clean Reset
```bash
# Stop and remove everything
docker-compose down -v --remove-orphans

# Remove all images
docker-compose build --no-cache
```

### View Service Status
```bash
docker-compose ps
```

## 🔒 Production Deployment

For production, use the production targets:
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## ✨ Benefits of Docker Setup

### ✅ **Solved Issues**
- No more WSL/Windows path conflicts
- No Playwright browser installation issues  
- No dependency version mismatches
- No environment setup complexity

### 🚀 **Development Benefits**
- One command setup (`docker-start.bat`)
- Consistent environment across all systems
- Easy sharing with team members
- Hot reload for rapid development

### 🔧 **Production Ready**
- Same environment for dev and production
- Easy scaling and deployment
- Health checks and monitoring
- Nginx for frontend optimization

## 📋 Next Steps

1. **Start the platform**: Run `docker-start.bat`
2. **Create a project**: Visit http://localhost:3001 and register
3. **Build tests**: Use the drag-and-drop test builder
4. **Pick elements**: Use the visual element picker (🎯 button)
5. **Analyze pages**: The enhanced element detection will find interactive elements

Your Nomation platform is now running in Docker with all features preserved! 🎉