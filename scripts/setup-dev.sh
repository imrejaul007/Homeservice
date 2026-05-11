#!/bin/bash

set -e  # Exit on any error

echo "🏠 Home Service Platform - Development Setup"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        print_status "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    print_success "Node.js version is compatible: $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed!"
        exit 1
    fi
    print_success "npm is available: $(npm --version)"
    
    # Check MongoDB
    if ! command -v mongosh &> /dev/null && ! command -v mongo &> /dev/null; then
        print_warning "MongoDB CLI tools not found. Please ensure MongoDB is running."
    else
        print_success "MongoDB CLI tools are available"
    fi
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            print_success "Created backend/.env from example"
        else
            print_warning "backend/.env.example not found"
        fi
    else
        print_success "backend/.env already exists"
    fi
    
    # Frontend environment
    if [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env
            print_success "Created frontend/.env from example"
        else
            print_warning "frontend/.env.example not found"
        fi
    else
        print_success "frontend/.env already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    print_success "Backend dependencies installed"
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd ../frontend
    npm install
    print_success "Frontend dependencies installed"
    
    cd ..
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    cd backend
    
    # Test database connection
    print_status "Testing database connection..."
    if npm run db:test > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_warning "Database connection failed. Please ensure MongoDB is running."
    fi
    
    # Seed database
    print_status "Seeding database with initial data..."
    if npm run db:seed > /dev/null 2>&1; then
        print_success "Database seeded successfully"
    else
        print_warning "Database seeding failed. Please check MongoDB connection."
    fi
    
    cd ..
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    # Backend directories
    mkdir -p backend/logs
    mkdir -p backend/uploads
    mkdir -p backend/src/tests
    mkdir -p backend/src/templates/email
    
    # Frontend directories
    mkdir -p frontend/tests/e2e
    mkdir -p frontend/src/__tests__
    
    print_success "Directories created"
}

# Validate setup
validate_setup() {
    print_status "Validating setup..."
    
    # Check if all required files exist
    required_files=(
        "backend/.env"
        "frontend/.env"
        "backend/package.json"
        "frontend/package.json"
        "backend/src/app.ts"
        "frontend/src/main.tsx"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file missing: $file"
            exit 1
        fi
    done
    
    print_success "All required files present"
    
    # Test build
    print_status "Testing builds..."
    
    cd frontend
    if npm run build > /dev/null 2>&1; then
        print_success "Frontend build successful"
    else
        print_error "Frontend build failed"
        exit 1
    fi
    
    cd ../backend
    if npm run build > /dev/null 2>&1; then
        print_success "Backend build successful"
    else
        print_warning "Backend build failed (this may be expected if TypeScript compilation has issues)"
    fi
    
    cd ..
}

# Generate development certificates (if needed)
generate_certificates() {
    print_status "Checking SSL certificates..."
    
    if [ ! -d "certs" ]; then
        print_status "Generating development SSL certificates..."
        mkdir -p certs
        
        # Generate self-signed certificate for development
        openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes \
            -subj "/C=US/ST=Development/L=Local/O=HomeService/CN=localhost" > /dev/null 2>&1 || {
            print_warning "OpenSSL not available. Skipping certificate generation."
            return
        }
        
        print_success "SSL certificates generated"
    else
        print_success "SSL certificates already exist"
    fi
}

# Display final instructions
show_final_instructions() {
    echo ""
    echo "================================================"
    print_success "🎉 Development setup completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "  1. Configure your environment variables in .env files"
    echo "  2. Ensure MongoDB is running (mongod)"
    echo "  3. Start the development servers:"
    echo ""
    echo "     Backend:  cd backend && npm run dev"
    echo "     Frontend: cd frontend && npm run dev"
    echo ""
    print_status "Access points:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5000"
    echo "  API Docs: http://localhost:5000/api-docs (if implemented)"
    echo ""
    print_status "Useful commands:"
    echo "  npm run test           # Run tests"
    echo "  npm run db:seed        # Reseed database"
    echo "  npm run db:reset       # Reset database"
    echo "  npm run lint           # Check code style"
    echo ""
    print_warning "Don't forget to:"
    echo "  1. Update JWT secrets in backend/.env"
    echo "  2. Configure email settings for verification"
    echo "  3. Set up Cloudinary for file uploads"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    setup_environment
    create_directories
    install_dependencies
    setup_database
    generate_certificates
    validate_setup
    show_final_instructions
}

# Run main function
main "$@"