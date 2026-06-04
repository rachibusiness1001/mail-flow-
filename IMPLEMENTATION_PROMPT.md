# MailFlow - Implementation Prompt

## 🎯 TASK OVERVIEW

You are tasked with implementing two major features in the MailFlow email automation platform:

1. **Email Threading Fix** - Group emails by recipient into single conversations
2. **Campaign-Based Lead Management** - Restructure lead uploads to be campaign-dependent

Both features must be completed, tested, and pushed to GitHub.

---

## 🔴 CRITICAL ISSUE: Email Threading

### Current Problem:
When a user sends multiple emails to the same person, each email creates a separate conversation instead of being grouped together.

**Example:**
- Send email to "Rachit" → Conversation #1
- Send another email to "Rachit" → Conversation #2 (WRONG!)
- Result: Two separate threads for same person

### Expected Behavior:
All emails with the same recipient should appear in ONE conversation thread, like Gmail or WhatsApp.

**Example:**
- Send email to "Rachit" → Conversation #1
- Send another email to "Rachit" → Same Conversation #1 (CORRECT!)
- Result: One thread with all Rachit emails in chronological order

### Root Cause Analysis:
1. **Backend Issue:** Email sending doesn't check for existing thread with recipient
2. **Message Headers Issue:** Message-ID and In-Reply-To headers not properly linked
3. **Database Issue:** thread_id not consistent for same recipient
4. **Frontend Issue:** Inbox shows individual emails instead of grouped conversations

### Solution Implementation:

#### Step 1: Backend - Fix Email Sending Logic
**File:** `app.py` (function `send_email_smtp`)

```python
# BEFORE: Each send creates new thread
success, error, gmail_thread_id, rfc_message_id = send_email_smtp(...)

# AFTER: Check for existing thread with recipient
existing_thread = InboxReply.query.filter_by(
    user_id=uid,
    from_email=recipient_email
).order_by(InboxReply.received_at.desc()).first()

if existing_thread:
    # Use existing thread_id
    thread_id = existing_thread.thread_id
    message_id = existing_thread.message_id
else:
    # Create new thread
    thread_id = str(uuid.uuid4())
    message_id = None
```

#### Step 2: Backend - Fix Message Headers
**File:** `app.py` (function `send_email_smtp`)

Ensure proper email headers:
```python
msg['Message-ID'] = email_lib.utils.make_msgid()
msg['In-Reply-To'] = previous_message_id  # Link to previous email
msg['References'] = previous_message_id   # Gmail threading
```

#### Step 3: Backend - Group Inbox by Recipient
**File:** `api/inbox.py` (new endpoint)

Create endpoint to get conversations grouped by recipient:
```python
@inbox_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    uid = get_jwt_identity()
    
    # Group by from_email (recipient)
    conversations = db.session.query(
        InboxReply.from_email,
        db.func.count(InboxReply.id).label('count'),
        db.func.max(InboxReply.received_at).label('last_message')
    ).filter_by(user_id=uid).group_by(InboxReply.from_email).all()
    
    return jsonify({'conversations': conversations})
```

#### Step 4: Frontend - Show Conversations Not Emails
**File:** `frontend/src/app/inbox/page.tsx`

Change from showing individual emails to showing conversations:

```typescript
// BEFORE: Show all emails
const replies = InboxReply.query.filter_by(user_id=uid).all()

// AFTER: Group by recipient
const conversations = replies.reduce((acc, reply) => {
  const key = reply.from_email
  if (!acc[key]) acc[key] = []
  acc[key].push(reply)
  return acc
}, {})
```

#### Step 5: Frontend - Show Full Conversation
**File:** `frontend/src/components/ConversationView.tsx` (new)

When user clicks on a conversation, show all emails with that recipient in chronological order.

### Testing Email Threading:
1. Create campaign
2. Add leads (Rachit, Abhi, etc.)
3. Send email to Rachit
4. Send another email to Rachit
5. ✅ Both emails should appear in ONE conversation
6. Send email to Abhi
7. ✅ Abhi's email should be in SEPARATE conversation

---

## 🟢 NEW FEATURE: Campaign-Based Lead Management

### Phase 1: Lock Leads Section (10-15 mins)

**Problem:** Users can upload leads without creating a campaign first

**Solution:** Show lock UI on `/leads` page if no campaigns exist

**Files to Modify:**
- `frontend/src/app/leads/page.tsx`
- `frontend/src/components/LeadsLock.tsx` (new)

**Implementation:**
```typescript
// Check if user has campaigns
const campaigns = await fetch('/api/v1/campaigns')
if (campaigns.length === 0) {
  return <LeadsLock />  // Show lock UI
}
```

### Phase 2: Add Leads Modal (20-25 mins)

**Problem:** No easy way to add leads after campaign creation

**Solution:** Show modal after campaign is created asking "Add leads to this campaign?"

**Files to Modify:**
- `frontend/src/app/campaigns/new/page.tsx`
- `frontend/src/components/AddLeadsModal.tsx` (new)

**Implementation:**
```typescript
// After campaign created
const [showModal, setShowModal] = useState(false)

if (campaignCreated) {
  return <AddLeadsModal campaignId={campaignId} />
}
```

### Phase 3: Files-Based View (45-60 mins) ⭐ MOST IMPORTANT

**Problem:** Leads shown as individual rows, hard to see which file they came from

**Solution:** Show uploaded files instead of individual leads

**Current View:**
```
CONTACT              COMPANY    STATUS    CAMPAIGN
email@test.com       -          Pending   New SaaS
email@test.com       -          Pending   New SaaS
email@test.com       -          Pending   New SaaS
```

**New View:**
```
FILE NAME              LEADS    STATUS        UPLOADED
Q1_Leads.csv          150      ✅ Imported    May 5, 2026
Q2_Prospects.csv      200      ✅ Imported    May 4, 2026
Conferences_2026.csv  45       ✅ Imported    May 3, 2026
```

**Files to Modify:**
- `frontend/src/app/leads/page.tsx`
- `frontend/src/components/LeadsFilesList.tsx` (new)
- `app.py` (add endpoint to get uploads grouped)

**Backend Endpoint:**
```python
@app.route('/api/v1/leads/uploads')
@jwt_required()
def get_uploads():
    uid = get_jwt_identity()
    uploads = UploadHistory.query.filter_by(user_id=uid).all()
    
    return jsonify({
        'uploads': [{
            'id': u.id,
            'filename': u.filename,
            'total': u.total,
            'invalid': u.invalid,
            'uploaded_at': u.uploaded_at,
            'campaign': u.campaign.name if u.campaign else 'Unknown'
        } for u in uploads]
    })
```

### Phase 4: Export Feature (15-20 mins)

**Problem:** No way to export leads from a file

**Solution:** Add export button to each file row

**Files to Modify:**
- `api/leads.py` (new endpoint)
- `frontend/src/components/LeadsFilesList.tsx`

**Backend Endpoint:**
```python
@leads_bp.route('/export/<int:upload_id>', methods=['GET'])
@jwt_required()
def export_leads(upload_id):
    uid = get_jwt_identity()
    upload = UploadHistory.query.filter_by(id=upload_id, user_id=uid).first_or_404()
    
    leads = Lead.query.filter_by(
        user_id=uid,
        campaign_id=upload.campaign_id
    ).all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Email', 'Name', 'Company', 'Phone', 'Status'])
    
    for lead in leads:
        writer.writerow([lead.email, lead.name, lead.company, lead.phone, lead.status])
    
    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = f'attachment; filename={upload.filename}'
    return response
```

### Phase 5: Campaign Filter (10 mins)

**Problem:** Can't filter leads by campaign

**Solution:** Add dropdown to filter by campaign

**Files to Modify:**
- `frontend/src/app/leads/page.tsx`

**Implementation:**
```typescript
const [selectedCampaign, setSelectedCampaign] = useState('')

const filteredUploads = uploads.filter(u => 
  !selectedCampaign || u.campaign_id === selectedCampaign
)
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Email Threading (PRIORITY 1)
- [ ] Fix thread_id generation in `send_email_smtp()`
- [ ] Add Message-ID and In-Reply-To headers
- [ ] Create `/api/v1/inbox/conversations` endpoint
- [ ] Modify frontend to show conversations instead of emails
- [ ] Test with multiple recipients
- [ ] Commit and push to GitHub

### Campaign-Based Leads (PRIORITY 2)
- [ ] Phase 1: Lock Leads Section
- [ ] Phase 2: Add Leads Modal
- [ ] Phase 3: Files-Based View
- [ ] Phase 4: Export Feature
- [ ] Phase 5: Campaign Filter
- [ ] Test all phases
- [ ] Commit and push to GitHub

---

## 🚀 DEPLOYMENT STEPS

After implementation:

1. **Test Locally:**
   ```bash
   cd mailflow
   python app.py
   # In another terminal
   cd frontend
   npm run dev
   ```

2. **Test Email Threading:**
   - Create campaign
   - Add leads
   - Send email to same person twice
   - Verify both emails in one conversation

3. **Test Campaign-Based Leads:**
   - Create campaign
   - Upload leads file
   - Verify file appears in files view
   - Export file
   - Verify CSV download

4. **Commit Changes:**
   ```bash
   git add .
   git commit -m "Feature: Email threading and campaign-based lead management"
   git push origin main
   ```

5. **Verify on GitHub:**
   - Check commits pushed
   - Verify no merge conflicts
   - Check CI/CD pipeline (if exists)

---

## ⏱️ TIME ESTIMATE

- Email Threading: **1.5-2 hours**
- Campaign-Based Leads: **2.5-3 hours**
- Testing: **30 mins**
- **Total: 4.5-5.5 hours**

---

## 📝 IMPORTANT NOTES

1. **Email Threading is CRITICAL** - Affects user experience significantly
2. **Test thoroughly** - Multiple recipients, multiple emails per recipient
3. **Database consistency** - Ensure thread_id is consistent
4. **Frontend UX** - Make conversation view intuitive
5. **Git commits** - Push after each major phase

---

## ✅ SUCCESS CRITERIA

### Email Threading:
- ✅ Multiple emails to same person appear in one conversation
- ✅ Conversation shows all emails in chronological order
- ✅ Each person has separate conversation
- ✅ Works with Gmail API and SMTP

### Campaign-Based Leads:
- ✅ Leads section locked until campaign created
- ✅ Modal appears after campaign creation
- ✅ Files view shows uploaded files not individual leads
- ✅ Export button downloads CSV
- ✅ Campaign filter works correctly

---

## 🎯 FINAL DELIVERABLE

After completion:
1. All features implemented and tested
2. All changes committed to GitHub
3. No console errors or warnings
4. Ready for production deployment

**Start implementation now!** 🚀
