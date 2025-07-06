# Nomation - Test Automation Platform

A comprehensive test automation platform that enables teams to create, manage, and execute automated tests for web applications with a visual interface.

## Features

- 🎯 **Visual Test Builder** - Create tests using drag-and-drop interface
- 🚀 **Real Browser Testing** - Execute tests with Playwright automation
- 📊 **Test Results Dashboard** - View detailed execution history and results
- 👥 **User Management** - Authentication and project organization
- 🏗️ **Project-Based Organization** - Manage tests by projects and applications

## Tech Stack

### Backend (Port 3002)
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Playwright for browser automation
- **Authentication**: JWT tokens

### Frontend (Port 3001)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (running on localhost:5432)
3. **Database**: Create a database named `nomation`

## Quick Start

1. **Clone and Navigate**
   ```bash
   cd D:\SaaS_Nomation
   ```

2. **Setup Database**
   - Ensure PostgreSQL is running
   - Create database: `CREATE DATABASE nomation;`
   - Default connection: `postgresql://postgres:asdasd123+@localhost:5432/nomation`

3. **Start the Platform**
   ```bash
   # Double-click or run:
   start-nomation.bat
   ```

4. **Access the Application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3002

## Manual Setup (Alternative)

### Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend Setup
```bash
cd frontend  
npm install
npm run dev
```

## Project Structure

```
nomation/
├── backend/                 # NestJS API server
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── projects/       # Project management
│   │   ├── tests/          # Test management
│   │   └── execution/      # Test execution engine
│   ├── prisma/             # Database schema
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Application pages
│   │   ├── contexts/       # React contexts
│   │   └── lib/            # API and utilities
│   └── package.json
├── start-nomation.bat      # Main startup script
└── README.md
```

## Configuration

### Backend Configuration
Update `backend/.env`:
```env
PORT=3002
DB_NAME=nomation
DB_USER=postgres
DB_PASSWORD=asdasd123+
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=nomation-secret-key
```

### Frontend Configuration
Update `frontend/.env`:
```env
VITE_API_URL=http://localhost:3002
```

## Usage

1. **Register/Login** - Create an account or sign in
2. **Create Project** - Add a new project with target URL
3. **Build Tests** - Use visual builder to create test steps
4. **Execute Tests** - Run tests and view results
5. **Monitor Results** - Check execution history and performance

## Development

### Backend Development
```bash
cd backend
npm run dev          # Start in development mode
npm run build        # Build for production
npm run start        # Start production build
```

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

## Testing

The platform supports creating tests with these step types:
- **Click** - Click on elements
- **Type** - Input text into fields
- **Wait** - Wait for specified time
- **Assert** - Verify text content

## Troubleshooting

### Common Issues

1. **PostgreSQL Connection Error**
   - Ensure PostgreSQL is running on port 5432
   - Verify database `nomation` exists
   - Check credentials in backend/.env

2. **Frontend Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version (requires v18+)

3. **Port Conflicts**
   - Backend uses port 3002
   - Frontend uses port 3001
   - Ensure these ports are available

### Getting Help

Check the terminal windows for detailed error messages when running the startup script.

## License

Private Project - All Rights Reserved