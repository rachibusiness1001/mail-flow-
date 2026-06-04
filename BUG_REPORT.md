# MailFlow - Critical Issues Report

## Issue 1: Google Auth Redirects Back to Login Instead of Dashboard ❌

**Problem:** User logs in via Google, but gets redirected back to login page instead of dashboard.

**Root Cause:**
- Google OAuth callback redirects to `/login?token=...` but token not in localStorage
- Frontend login page has async issues with router.push() vs window.location.href
- Most importantly: **NO WORKSPACE is created for the user during Google OAuth**
- When API tries to fetch data, `get_active_workspace_id()` should create one, but timing issues cause problems

**Current Flow:**
1. User clicks Google → `/auth/google`
2. Redirects to Google → Google OAuth consent
3. Google redirects back to `/auth/google/callback` with code
4. Backend exchanges code for tokens
5. Backend creates/updates User record
6. Backend redirects to frontend with token in URL params
7. Frontend processes and stores token
8. But NO WORKSPACE is created at step 5! ❌

---

## Issue 2: Login Fails with "Invalid" After Some Time ❌

**Problem:** After logging in via Google once, trying to log in with email/password later fails with "Invalid email or password"

**Root Cause:**
- Google OAuth creates User with empty `password_hash=''`
- Later, password login check fails: `check_password_hash(user.password_hash, password)` 
- When password_hash is empty string, it can't match any password

**Also:** There are TWO login endpoints:
- `/auth/login` in app.py (Flask route) - for template-based login
- `/auth/login` in api/auth.py (API blueprint) - for API login

This causes confusion and inconsistent behavior.

---

## Issue 3: Data Loss After Re-login ❌

**Problem:** User creates campaigns, logs out, logs in again → All data is lost!

**Root Cause:**
- Workspace creation is inconsistent
- Google OAuth doesn't create workspace
- API endpoint `get_active_workspace_id()` creates workspace on-demand IF user has no membership
- But if user logs in again via different method, a DIFFERENT workspace might be created
- User has campaigns in Workspace #1, but now browsing Workspace #2 (empty!)
- Data isn't lost, but user can't see it!

**Flow:**
1. User logs in (Google) → User created, NO workspace
2. User creates campaign → API creates Workspace #1 automatically
3. User logs out
4. User logs in again (email/password) → Session created
5. But WorkspaceMember membership might not exist or be in wrong workspace
6. API creates a NEW Workspace #2
7. User sees empty dashboard! 😱

---

## Summary of Issues:
- ❌ Google Auth: No workspace created → incomplete auth flow
- ❌ Password Login: Password field not initialized properly for OAuth users
- ❌ Workspace: Inconsistent creation logic across OAuth, password, and API endpoints
- ❌ Data Isolation: User data scattered across multiple workspaces
