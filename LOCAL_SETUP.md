# 🚀 How to Run Deadline Guardian Locally

## Prerequisites

- Google Chrome or Chromium-based browser (Edge, Brave, Opera, etc.)
- A Canvas LMS account with at least one active course
- Internet connection

## Step-by-Step Installation

### 1. Clone or Download the Repository

**Option A: Using Git**
```bash
git clone https://github.com/ostol-uriel/Computahhh.git
cd "Initial Canvas Tracker"
```

**Option B: Download ZIP**
- Go to https://github.com/ostol-uriel/Computahhh
- Click **Code** → **Download ZIP**
- Extract the ZIP file
- Navigate to the `Initial Canvas Tracker` folder

### 2. Get Your Canvas API Token

1. Log into your Canvas instance (e.g., `canvas.instructure.com` or your school's custom domain)
2. Click your **profile icon** (top right)
3. Select **Settings**
4. Scroll down to **"Approved Integrations"**
5. Click **+ New Access Token**
6. Fill in the form:
   - **Purpose:** "Deadline Guardian" (or any name you like)
   - **Expires:** Choose your preferred expiration (or leave blank for no expiration)
7. Click **Generate Token**
8. **Copy the token** (you'll only see it once!)
9. Keep this token safe - you'll need it in the next step

### 3. Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** (top right corner)
3. Click **Load unpacked**
4. Navigate to your `Initial Canvas Tracker` folder and select it
5. The extension will appear in your Chrome toolbar

### 4. Configure the Extension

1. Click the **Deadline Guardian** icon in your toolbar (you might need to pin it)
2. Click the **⚙️ settings icon** (gear icon in top right of the popup)
3. Enter:
   - **Canvas URL:** Your Canvas domain (e.g., `https://canvas.instructure.com` or `https://canvas.myschool.edu`)
   - **API Token:** Paste the token you copied earlier
4. Click **Save**
5. You should see a green success message

### 5. First Sync

1. Click the **Sync** button
2. Wait for it to complete (you'll see a success message)
3. Your assignments will now appear in the **Assignments** tab
4. Check the **Notifications** tab to see course announcements
5. Add your classes in the **Classes** tab

## ✨ Features Overview

### 📋 Assignments Tab
- See all your deadlines with countdowns
- Filter by: All, Today, This Week, Overdue
- Click **Open** to view in Canvas
- Click **Done** to mark as complete
- Click **Remind** to set custom reminders
- See locked assignment indicators

### 🔔 Notifications Tab
- View all course announcements
- See direct messages and inbox items
- Click any item to open in Canvas

### 📚 Classes Tab
- Add your classes with subject names and times
- Add meeting links (Zoom, Google Meet, Teams, etc.)
- Edit or delete classes
- Quick access to meeting links

## 🔧 Troubleshooting

### "Sync failed" Error
**Problem:** Extension won't sync with Canvas

**Solutions:**
- ✅ Double-check your Canvas URL (it should NOT have a trailing slash)
- ✅ Verify your API token is correct (copy it again from Canvas settings)
- ✅ Check that you have active courses in Canvas
- ✅ Try clicking Sync again

### No Deadlines Showing
**Problem:** Assignments aren't displaying

**Solutions:**
- ✅ Make sure you clicked **Sync** at least once
- ✅ Verify you have upcoming assignments in Canvas
- ✅ Check that assignments have due dates set
- ✅ Reload the extension (click reload icon at `chrome://extensions`)

### Notifications Not Appearing
**Problem:** Browser notifications aren't showing

**Solutions:**
- ✅ Check Chrome notification permissions:
  - Chrome menu → Settings → Privacy and security → Site Settings → Notifications
  - Make sure your Canvas domain is allowed
- ✅ Make sure your deadlines are within notification windows:
  - 3 days before
  - 1 day before
  - 3 hours before
- ✅ Reload the extension

### Token Expired
**Problem:** Getting authentication errors after a while

**Solutions:**
- ✅ Generate a new token in Canvas Settings
- ✅ Update the token in the extension settings
- ✅ Click Save and try Sync again

### "Missing Permission" Errors
**Problem:** Extension asking for permissions

**Solutions:**
- ✅ Reload the extension:
  - Go to `chrome://extensions`
  - Find Deadline Guardian
  - Click the reload icon (↻)
- ✅ If that doesn't work, unload and reload:
  - Toggle off the extension
  - Toggle it back on
  - Click the extension icon and set up again

## 🔄 Keep It Updated

To get the latest features and fixes:

1. Navigate to the repository folder in your terminal
2. Run:
   ```bash
   git pull
   ```
3. Reload the extension in Chrome (click reload icon at `chrome://extensions`)

## ⚙️ Advanced: Custom Canvas Domain

If your school uses a custom Canvas domain (like `canvas.myschool.edu`):

1. Enter the full URL in settings: `https://canvas.myschool.edu`
2. The extension will work with any Canvas instance

## 📖 Manual Refresh

If something seems off:
1. Go to `chrome://extensions`
2. Find **Deadline Guardian**
3. Click the **reload** icon (↻)
4. Close and reopen the popup
5. Try syncing again

## 🎓 Tips for Best Results

- **Sync daily** - Click Sync once per day for latest assignments
- **Check announcements** - Switch to Notifications tab regularly
- **Set reminders** - Use the Remind button for important deadlines
- **Add your classes** - Use the Classes tab to track meetings
- **Mark done** - Mark assignments as complete to keep track

## 🆘 Still Having Issues?

1. Check the browser console for errors:
   - Right-click popup → Inspect
   - Look at the Console tab for any red errors
2. Verify all settings are correct:
   - Canvas URL format: `https://...` (no trailing slash)
   - API token is from your current Canvas account
3. Try clearing data and re-configuring:
   - Click Settings → Clear
   - Set up credentials again
   - Sync fresh

---

**Version:** 2.0.0  
**Last Updated:** May 6, 2026  
**Browser Support:** Chrome, Edge, Brave, Opera (any Chromium-based browser)
