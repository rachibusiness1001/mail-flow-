# MailFlow - Complete Requirements & Issues

## ✅ FIXED ISSUES (Already Completed)

### Issue 1: Google Auth Redirects Back to Login
- **Status:** ✅ FIXED
- **Commit:** 9b21dea
- **Details:** Workspace now auto-created during Google OAuth callback

### Issue 2: Password Login Fails After Google Auth
- **Status:** ✅ FIXED
- **Commit:** 9b21dea
- **Details:** Password validation now checks if password_hash exists

### Issue 3: Data Loss After Re-login
- **Status:** ✅ FIXED
- **Commit:** 9b21dea
- **Details:** Workspace remains consistent across re-logins

---

## 🆕 NEW FEATURE: Campaign-Based Lead Management

### Phase 1: Lock Leads Section
- Leads section locked until campaign created
- Shows premium lock UI with message

### Phase 2: Add Leads Modal
- Modal appears after campaign creation
- Pre-fills campaign_id for upload

### Phase 3: Files-Based View
- Shows uploaded files instead of individual leads
- Groups leads by upload filename
- Displays: Filename, Lead Count, Status, Upload Date

### Phase 4: Export Feature
- Export button for each file
- Downloads CSV with all leads from that file

### Phase 5: Campaign Filter
- Dropdown to filter leads by campaign
- Auto-filters to selected campaign

---

## 🆕 NEW ISSUE: Email Threading Problem

### Problem Description:
**Emails are being split into separate conversations instead of staying in one thread.**

**Current Behavior:**
- User sends email to "Rachit" → Creates conversation #1
- User sends another email to "Rachit" → Creates conversation #2 (WRONG!)
- Result: Two separate chat threads for same person

**Expected Behavior:**
- All emails with "Rachit" should be in ONE conversation
- All emails with "Abhi" should be in ONE conversation
- Each person = ONE thread (like WhatsApp or Gmail)

### Root Cause:
- Email threading logic not properly grouping by recipient
- Each send creates new thread instead of appending to existing
- Message-ID and In-Reply-To headers not properly linked

### Solution Required:
1. **Backend Fix:**
   - Modify email sending to check for existing thread with recipient
   - Use proper Message-ID and In-Reply-To headers
   - Group replies by recipient email address

2. **Frontend Fix:**
   - Inbox should show one row per contact (not per email)
   - Clicking contact shows full conversation history
   - All emails with that contact in chronological order

3. **Database:**
   - Ensure `thread_id` is consistent for same recipient
   - Link all messages in conversation via `thread_id`

### Files to Modify:
- `app.py` - Email sending logic (thread_id handling)
- `api/inbox.py` - Conversation grouping
- `frontend/src/app/inbox/page.tsx` - Show conversations not individual emails

### Expected Result:
```
INBOX VIEW (Conversations):
┌─────────────────────────────────────┐
│ Rachit (rachit@company.com)         │
│ Last: "Thanks for reaching out..."  │
│ 5 emails in conversation            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Abhi (abhi@company.com)             │
│ Last: "Let's schedule a call"       │
│ 3 emails in conversation            │
└─────────────────────────────────────┘

CONVERSATION VIEW (Click on Rachit):
┌─────────────────────────────────────┐
│ Rachit (rachit@company.com)         │
├─────────────────────────────────────┤
│ [You] May 5, 2:30 PM                │
│ "Hi Rachit, interested in..."       │
│                                     │
│ [Rachit] May 5, 3:15 PM             │
│ "Thanks for reaching out..."        │
│                                     │
│ [You] May 6, 10:00 AM               │
│ "Great! Let's schedule..."          │
│                                     │
│ [Rachit] May 6, 11:30 AM            │
│ "Perfect, I'm available..."         │
│                                     │
│ [You] May 6, 2:00 PM                │
│ "Confirmed for tomorrow at 3 PM"    │
└─────────────────────────────────────┘
```

---

## 📋 COMPLETE IMPLEMENTATION CHECKLIST

### Phase A: Email Threading Fix (PRIORITY 1)
- [ ] Fix thread_id generation in email sending
- [ ] Ensure Message-ID and In-Reply-To headers are correct
- [ ] Group inbox by recipient (conversation view)
- [ ] Show full conversation history when clicking contact
- [ ] Test with multiple recipients

### Phase B: Campaign-Based Leads (PRIORITY 2)
- [ ] Phase 1: Lock Leads Section
- [ ] Phase 2: Add Leads Modal
- [ ] Phase 3: Files-Based View
- [ ] Phase 4: Export Feature
- [ ] Phase 5: Campaign Filter

---

## 🚀 DEPLOYMENT CHECKLIST

After all fixes are complete:

1. **Code Review:**
   - [ ] All changes reviewed
   - [ ] No console errors
   - [ ] No database warnings

2. **Testing:**
   - [ ] Email threading works correctly
   - [ ] Leads management works as expected
   - [ ] All previous fixes still working

3. **Git Operations:**
   - [ ] All changes committed with clear messages
   - [ ] Pushed to origin/main
   - [ ] No merge conflicts

4. **Production:**
   - [ ] Deploy to production
   - [ ] Monitor logs for errors
   - [ ] Verify features working live

---

## 📝 NOTES

- Email threading is critical for user experience
- Campaign-based leads improves workflow
- All fixes should be tested before deployment
- Git commits should be atomic and descriptive

---

## PRIORITY ORDER

1. **CRITICAL:** Email Threading Fix (affects user experience)
2. **HIGH:** Campaign-Based Leads (improves workflow)
3. **MEDIUM:** Export Feature (nice to have)

---

## TIME ESTIMATE

- Email Threading Fix: **1.5-2 hours**
- Campaign-Based Leads (All 5 phases): **2.5-3 hours**
- Testing & Deployment: **30 mins**

**Total: 4.5-5.5 hours**

---

## NEXT STEPS

1. Confirm priority order
2. Start with Email Threading Fix
3. Then implement Campaign-Based Leads
4. Test everything
5. Push to GitHub
6. Deploy to production
