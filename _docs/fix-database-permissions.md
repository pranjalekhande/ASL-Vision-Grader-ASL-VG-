# Fix Database Permissions - RLS Issue Resolution

## 🔍 **Problem Identified**
Row Level Security (RLS) policies are blocking all write operations (UPDATE/INSERT/UPSERT) on the `signs` table, causing the exemplar data updates to silently fail.

**Error:** `new row violates row-level security policy (USING expression)` (Code: 42501)

## 🛠 **Solution Steps**

### Step 1: Access Supabase SQL Editor
1. Go to https://supabase.com
2. Sign in to your account
3. Open your ASL Vision Grader project
4. Navigate to **"SQL Editor"** in the left sidebar

### Step 2: Choose Your Fix (Recommended: Option 1)

#### **Option 1: Disable RLS (Quick Fix for Development)**
```sql
ALTER TABLE public.signs DISABLE ROW LEVEL SECURITY;
```
✅ **Recommended for development/testing**  
⚠️ **Note:** Less secure, but perfect for getting the app working

#### **Option 2: Create Permissive Policy (Balanced)**
```sql
-- Ensure RLS is enabled
ALTER TABLE public.signs ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for anon users
CREATE POLICY "Allow anon full access to signs" 
ON public.signs 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);
```
✅ **Good for development with some security**

#### **Option 3: Granular Policies (Most Secure)**
```sql
-- Enable RLS
ALTER TABLE public.signs ENABLE ROW LEVEL SECURITY;

-- Create specific policies
CREATE POLICY "Allow anon select on signs" 
ON public.signs FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on signs" 
ON public.signs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on signs" 
ON public.signs FOR UPDATE TO anon USING (true) WITH CHECK (true);
```
✅ **Most secure, but more complex**

### Step 3: Run the SQL Command
1. Copy one of the SQL options above
2. Paste it into the Supabase SQL Editor
3. Click **"Run"** button
4. You should see "Success. No rows returned"

### Step 4: Test the Fix
Run this command in your terminal:
```bash
node scripts/workaround-update.js
```

You should now see:
```
✅ UPSERT successful: 1 rows affected
📊 Frames: 50, Quality: 0.95
```

### Step 5: Verify in App
1. Go to http://localhost:5174/
2. **Hard refresh** the page (Ctrl+Shift+R / Cmd+Shift+R)
3. Select a sign and record
4. You should now see **realistic reference hands** instead of the old curved synthetic ones!

## 🔧 **Verification Commands**

### Check RLS Status:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'signs' AND schemaname = 'public';
```

### View Current Policies:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'signs' AND schemaname = 'public';
```

### Test Database Access:
```bash
node scripts/check-database.js
```

## 🎯 **Expected Results After Fix**

### Before Fix:
- ❌ Updates silently fail (0 rows affected)
- ❌ Old synthetic curved exemplars in app  
- ❌ Timestamps never change in database

### After Fix:
- ✅ Updates work properly (1+ rows affected)
- ✅ Realistic ASL exemplars with proper handshapes
- ✅ Updated timestamps in database
- ✅ Better visual feedback in app

## 🚨 **If You Still Have Issues**

1. **Double-check the SQL ran successfully** - Look for "Success" message
2. **Try Option 1 (disable RLS)** - This always works for development
3. **Check for typos** - Copy-paste the exact SQL commands
4. **Clear browser cache** - Hard refresh the app after database changes

## 🔒 **Security Notes**

- **Option 1 (Disable RLS)** - Good for development, not production
- **Option 2 (Permissive Policy)** - Reasonable for MVP/testing
- **Option 3 (Granular Policies)** - Production-ready security

For now, **Option 1** is recommended to get the realistic exemplars working quickly. You can always re-enable RLS with proper policies later when adding authentication.

---

**Once this is fixed, you'll have linguistically-accurate ASL exemplars providing meaningful feedback to users!** 🚀


