# Home Service Marketplace Platform

A comprehensive platform connecting service providers with customers for home services including beauty, wellness, fitness, and more.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd home-service-marketplace
```

2. Run the automated setup
```bash
npm run setup
```

3. Configure environment variables
- Update `backend/.env` with your MongoDB URI and API keys
- Update `frontend/.env` with API endpoints

4. Start development servers
```bash
npm run dev
```

### Access Points
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api-docs
- **Health Check**: http://localhost:5000/health

## 📁 Project Structure

```
├── backend/          # Express.js + TypeScript API
├── frontend/         # React + Vite + TypeScript
├── docs/             # Documentation
├── scripts/          # Automation scripts
└── package.json      # Root package configuration
```

## 🛠 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + Shadcn/ui
- Zustand (State Management)
- TanStack Query
- React Router v6

### Backend  
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT Authentication
- Stripe Payments
- Cloudinary (File Upload)

## 📊 Status Dashboard

The application includes a comprehensive status dashboard that shows:
- Frontend build status
- Backend API connectivity
- Database connection status
- External services health
- Real-time monitoring

Access the dashboard at http://localhost:5173 after starting the development server.

## 🧪 Verification Endpoints

Test the system health with these endpoints:

- `GET /health` - Overall system health
- `GET /api/test` - API connectivity test
- `GET /api/verify/database` - MongoDB connection status
- `GET /api/verify/services` - External services status

## 📝 Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run install:all` - Install all dependencies
- `npm run setup` - Run initial setup script
- `npm run build` - Build both frontend and backend
- `npm run test:integration` - Run integration tests
- `npm run verify` - Verify setup completeness

### Backend
- `npm run dev` - Start backend development server
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run test` - Run backend tests

### Frontend
- `npm run dev` - Start frontend development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run frontend tests

## 🔧 Configuration

### Environment Variables

Create `.env` files based on `.env.example`:

**Backend (.env)**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/marketplace
JWT_SECRET=your-secret-key
# Add other API keys as needed
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Home Service Marketplace
```

## 📚 Documentation

- [Requirements](./docs/requirements/Home-Service-Platform-Requirements.md)
- [Tech Stack](./docs/setup/tech-stack-final.md)
- [Setup Guide](./docs/setup/project-setup-guide.md)
- [Development Guide](./docs/development/getting-started.md)

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and development process.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

For issues and questions:
- Check the [documentation](./docs)
- Run `npm run verify` to check setup
- Open an issue on GitHub

## ✅ Development Checklist

- [ ] Environment setup complete
- [ ] MongoDB connected
- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] Status dashboard shows all green
- [ ] Test endpoints responding

---

Built with ❤️ using modern web technologies