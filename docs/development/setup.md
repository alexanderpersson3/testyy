# Development Setup Guide

## Prerequisites

- Node.js (v18 or later)
- MongoDB (v6 or later)
- Git
- VS Code (recommended)

## Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/rezepta.git
   cd rezepta
   ```

2. **Install Dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cd backend
   cp .env.example .env
   # Edit .env with your local settings

   # Frontend environment
   cd ../frontend
   cp .env.example .env
   # Edit .env with your local settings
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB
   mongod --dbpath /path/to/data/directory

   # Optional: Seed database with test data
   cd backend
   npm run seed
   ```

## Running the Application

1. **Backend Development**
   ```bash
   cd backend
   npm run dev
   ```
   The server will start at http://localhost:3000

2. **Frontend Development**
   ```bash
   cd frontend
   npm run dev
   ```
   The application will be available at http://localhost:5173

## Development Workflow

1. **Code Style**
   - ESLint and Prettier are configured
   - Run `npm run lint` to check code style
   - Run `npm run format` to format code

2. **Testing**
   ```bash
   # Run backend tests
   cd backend
   npm test

   # Run frontend tests
   cd frontend
   npm test
   ```

3. **Database Operations**
   ```bash
   # Create database backup
   npm run db:backup

   # Restore database
   npm run db:restore
   ```

4. **API Documentation**
   - Swagger UI available at http://localhost:3000/api-docs
   - Update API docs in `src/swagger.ts`

## VS Code Setup

1. **Recommended Extensions**
   - ESLint
   - Prettier
   - TypeScript and JavaScript Language Features
   - MongoDB for VS Code
   - Thunder Client

2. **Workspace Settings**
   ```json
   {
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

## Common Issues

1. **MongoDB Connection**
   - Ensure MongoDB is running
   - Check connection string in .env
   - Verify network access

2. **Node.js Version**
   - Use nvm to manage Node.js versions
   - Run `nvm use` to use project version

3. **TypeScript Errors**
   - Run `npm run clean` to clear build cache
   - Check tsconfig.json settings
   - Update type definitions 