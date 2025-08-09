# Quick Setup Guide

## ✅ Implementation Status

**Phase 1 Complete:** Authentication + Sign Browsing
- Login/signup with role selection
- Role-based dashboards
- Sign browsing with search/filters
- Database connectivity

## 🚀 Quick Setup (5 minutes)

### 1. Environment Setup
Create a `.env` file in the `frontend/` directory:
```bash
# frontend/.env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Database Setup
1. Create a new Supabase project
2. Run SQL scripts in this order:
   ```sql
   -- In Supabase SQL Editor:
   -- 1. Run: frontend/src/config/database-setup.sql
   -- 2. Run: frontend/src/config/migrations/002_update_signs_table.sql
   ```

### 3. Seed Test Data
```bash
cd frontend
node scripts/seedBasicSigns.js
```

### 4. Start Development Server
```bash
npm run dev
```

## 🧪 Testing the Current Implementation

### What Works Now:
1. **Authentication Flow**
   - Sign up as teacher or student
   - Login/logout
   - Role-based routing

2. **Sign Browsing**
   - View available signs
   - Search by name
   - Filter by difficulty
   - Different views for teachers vs students

3. **Basic Data Flow**
   - Database connectivity
   - Sign retrieval from Supabase
   - Error handling and loading states

### Test Scenarios:

#### As a Student:
1. Sign up with role "Student"
2. Browse available signs
3. See practice-focused interface
4. Click on signs to select them

#### As a Teacher:
1. Sign up with role "Teacher"  
2. View signs with management controls
3. See edit/delete options
4. Teacher-focused interface

## 🔄 Next Implementation Steps

### Ready to Implement:
1. **Student Attempt Saving** (45 min)
   - Connect VideoRecorder to save attempts
   - Store scores in attempts table
   - View attempt history

2. **ReferenceRecorder Integration** (45 min)
   - Save teacher recordings to database
   - Upload videos to Supabase storage
   - Create complete teacher workflow

## 🐛 Troubleshooting

### Common Issues:

**"No signs found"**
- Run the seeder script: `node scripts/seedBasicSigns.js`
- Check database connection
- Verify environment variables

**Database connection errors**
- Check `.env` file exists with correct values
- Verify Supabase project is active
- Ensure SQL scripts were run

**Login not working**
- Check Supabase project authentication settings
- Verify environment variables
- Check browser console for errors

### Debug Commands:
```bash
# Check if signs exist in database
# (Run in Supabase SQL Editor)
SELECT name, difficulty FROM signs;

# Check environment variables
node -e "console.log('URL:', process.env.VITE_SUPABASE_URL); console.log('KEY:', process.env.VITE_SUPABASE_ANON_KEY?.slice(0,10) + '...');"
```

## 📋 Current Database Schema

```sql
-- Core tables in use:
profiles (id, role, full_name)           -- User profiles
signs (id, name, description, difficulty) -- Reference signs  
attempts (student_id, sign_id, scores)   -- Practice attempts (ready for use)
```

## 🎯 Current Features

### ✅ Working Features:
- User authentication with roles
- Sign browsing and search
- Database connectivity
- Error handling
- Loading states
- Responsive design

### 🚧 In Progress:
- Student practice workflow
- Teacher recording workflow
- Progress tracking

### 📋 Planned:
- Teacher analytics
- Advanced filtering
- Real-time feedback
