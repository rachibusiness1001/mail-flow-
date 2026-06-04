# MailFlow - New Features Plan 📋

## Feature 1: Campaign-Based Lead Management

### Problem:
- Currently leads can be uploaded without a campaign
- No relationship between leads and campaigns during upload
- Leads are shown individually in table format

### Solution:
Implement campaign-linked lead uploads with file-based view

---

## 1. Lock Leads Section (Require Campaign First)

### UI Changes:
- `/leads` page shows premium lock icon if no campaigns exist
- Message: "Create a campaign first to manage leads"
- Button to redirect to campaigns page

### Implementation:
- **Frontend:** Check campaign count on `/leads` page
- **Backend:** No changes needed

### Files to Modify:
- `frontend/src/app/leads/page.tsx` - Add lock UI
- `frontend/src/components/LeadsLock.tsx` - New lock component

---

## 2. Add Leads Modal (After Campaign Creation)

### Workflow:
1. User creates campaign ✅
2. Popup appears: "Add leads to this campaign?"
3. User clicks "Add Leads" → Modal opens
4. Modal shows upload form with campaign pre-selected
5. Success → Redirects to leads section

### Implementation:
- **Frontend:** Modal component with file upload
- **Backend:** Existing `/leads/upload` endpoint works (just pre-fill campaign_id)

### Files to Modify:
- `frontend/src/app/campaigns/new/page.tsx` - Add modal after create
- `frontend/src/components/AddLeadsModal.tsx` - New modal component

---

## 3. Files-Based View (Not Individual Leads)

### Current State:
```
CONTACT          COMPANY    STATUS    CAMPAIGN           ADDED
email@test.com   -          Pending   New SaaS Outreach  -
email@test.com   -          Pending   New SaaS Outreach  -
```

### New State:
```
FILE NAME              LEADS    STATUS     UPLOADED    EXPORT
Q1_Leads.csv          150      ✅ Imported  May 5, 2026  📥
Q2_Prospects.csv      200      ✅ Imported  May 4, 2026  📥
Conferences_2026.csv  45       ✅ Imported  May 3, 2026  📥
```

### Implementation:
- Add `file_source` column to `UploadHistory` table (already exists ✅)
- Change leads view to group by `UploadHistory` entry
- Show upload metadata instead of individual leads

### Files to Modify:
- `frontend/src/app/leads/page.tsx` - Change table view structure
- `frontend/src/components/LeadsTable.tsx` - New file-based table
- `app.py` - Minor changes to `/leads` endpoint (add file grouping)

---

## 4. Export Leads Feature

### What to Export:
- All leads from a single upload
- Format: CSV with columns (Email, Name, Company, Phone, Status)

### New Endpoint:
```
GET /api/v1/leads/export/<upload_id>
Returns: CSV file download
```

### Implementation:
- Create new export endpoint in `api/leads.py`
- Add export button to each file row
- Browser downloads CSV

### Files to Modify:
- `api/leads.py` - Add `/export/<upload_id>` endpoint
- `frontend/src/components/LeadsTable.tsx` - Add export button

---

## 5. Leads Filter by Campaign

### Change:
- When viewing leads, filter by campaign
- Dropdown to select which campaign's leads to view
- Or auto-filter to current campaign

### Files to Modify:
- `frontend/src/app/leads/page.tsx` - Add campaign filter dropdown

---

## Database Changes

### Schema Updates:
```python
# Already exists in UploadHistory:
- filename ✅
- campaign_id ✅
- uploaded_at ✅

# Might need to add:
- lead_count (rename from `total`) - already exists as `total` ✅
```

**No migration needed!** All columns already exist.

---

## Implementation Order

1. **Phase 1 - Lock Leads Section** (Quick)
   - Add lock UI on `/leads` if no campaigns
   - ~30 mins

2. **Phase 2 - Add Leads Modal** (Medium)
   - Show modal after campaign creation
   - Link to add leads
   - ~45 mins

3. **Phase 3 - Files View** (Complex)
   - Rewrite leads table to show uploads instead of individual leads
   - Group leads by upload file
   - ~1.5 hours

4. **Phase 4 - Export Feature** (Easy)
   - Create `/export/<id>` endpoint
   - Add export button
   - ~30 mins

5. **Phase 5 - Campaign Filter** (Easy)
   - Add dropdown to filter by campaign
   - ~20 mins

---

## UI Mockup - Files View

### Leads Page - Files Based

```
┌─────────────────────────────────────────────────────────────┐
│ LEADS MANAGEMENT                                             │
│ Filter by Campaign: [New SaaS Outreach ▼]                   │
├─────────────────────────────────────────────────────────────┤
│
│ ┌───────────────────────────────────────────────────────────┐
│ │ 📄 Q1_Leads.csv                                       150  │
│ │    Status: ✅ Imported | Uploaded: May 5, 2026 2:30 AM   │
│ │    Valid: 145 | Invalid: 5                            📥  │
│ └───────────────────────────────────────────────────────────┘
│
│ ┌───────────────────────────────────────────────────────────┐
│ │ 📄 Q2_Prospects.csv                                   200  │
│ │    Status: ✅ Imported | Uploaded: May 4, 2026 1:15 AM   │
│ │    Valid: 198 | Invalid: 2                            📥  │
│ └───────────────────────────────────────────────────────────┘
│
│ ┌───────────────────────────────────────────────────────────┐
│ │ 📄 Conferences_2026.csv                                45  │
│ │    Status: ✅ Imported | Uploaded: May 3, 2026 11:30 PM  │
│ │    Valid: 45 | Invalid: 0                             📥  │
│ └───────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────┘
```

### Locked State

```
┌─────────────────────────────────────────────────────────────┐
│                    🔒 PREMIUM FEATURE                        │
│                                                               │
│              CREATE A CAMPAIGN FIRST TO MANAGE LEADS          │
│                                                               │
│                  [Create Campaign] [Browse Campaigns]         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Estimated Time
- Total: **4-5 hours**
- Phase 1: 30 mins
- Phase 2: 45 mins
- Phase 3: 90 mins (complex)
- Phase 4: 30 mins
- Phase 5: 20 mins
- Testing: 30 mins

---

## Files to Create/Modify

### New Files:
1. `frontend/src/components/LeadsLock.tsx` - Lock UI component
2. `frontend/src/components/AddLeadsModal.tsx` - Add leads modal
3. `frontend/src/components/LeadsFilesList.tsx` - Files-based leads view

### Modify Files:
1. `frontend/src/app/leads/page.tsx` - Main leads page
2. `frontend/src/app/campaigns/new/page.tsx` - Add modal after create
3. `api/leads.py` - Add export endpoint
4. `app.py` - Minor lead filtering changes

### Delete/Archive:
1. Old leads table component (if separate)

---

## Next Steps

Ready for implementation? Confirm:
1. Should we start with Phase 1 (Lock)?
2. Keep existing leads table for admins/manual view?
3. Any other customization needed?
