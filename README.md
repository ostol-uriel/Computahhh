# Deadline Guardian

A powerful Chrome extension that transforms Canvas LMS deadlines into actionable browser notifications and organized task management. Stay on top of your assignments with real-time alerts, deadline tracking, and assignment prerequisites at a glance.

## 📋 What is This?

**Deadline Guardian** is a Manifest V3 Chrome extension that connects to your Canvas LMS instance and surfaces your upcoming assignments with intelligent deadline tracking. It fetches your courses and assignments via the Canvas REST API, then presents them in an intuitive interface with:

- **Real-time deadline countdowns** - See exactly how much time you have left
- **Urgency levels** - Assignments are color-coded by proximity to deadline (Overdue, Urgent, Soon, Normal)
- **Assignment prerequisites** - View prerequisites and requirements before opening assignments
- **Locked assignment detection** - See which assignments are locked and why
- **Smart notifications** - Receive browser notifications at 3 days, 1 day, and 3 hours before deadlines
- **Course announcements** - Stay informed with the latest course announcements and inbox messages
- **Filtering and grouping** - Filter by Due Today, This Week, Overdue, or view all assignments
- **Summary dashboard** - Quick stats showing due today, this week, and overdue counts
- **Classes & Meeting Links** - Track your classes, meeting times, and quick links to Zoom/Google Meet/Teams
- **Task completion sync** - Automatically marks assignments as done when submitted on Canvas
- **Persistent task tracking** - Mark assignments as done locally and they stay marked across sessions
- **Custom reminders** - Set personalized reminders for any deadline with preset options or custom times

Perfect for students who want to never miss a deadline and stay organized throughout the semester.

## 🚀 How Do I Use It?

### Initial Setup

1. **Install the extension**
   - Open `chrome://extensions` in your browser
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select this repository folder

2. **Configure Canvas credentials**
   - Click the **Deadline Guardian** icon (⚙️ settings button)
   - Enter your Canvas instance URL (e.g., `https://canvas.instructure.com`)
   - Generate a Personal Access Token from Canvas:
     - Go to Canvas → Account → Settings
     - Click **+ New Access Token**
     - Copy the token and paste it into the extension
   - Click **Save**

### Using the Extension

**Main Dashboard:**
- See summary cards showing:
  - Number of assignments **Due Today**
  - Number of assignments due **This Week**
  - Number of **Overdue** assignments

**Filtering Assignments:**
- Click filter buttons to view:
  - **All** - Show all upcoming assignments
  - **Today** - Only assignments due today
  - **This Week** - Only assignments due within 7 days
  - **Overdue** - Only past-due assignments

**Assignment Cards:**
- Click **Open** to view the assignment in Canvas (disabled if locked)
- Click **Remind** to set a personal reminder notification
- Click **Done** to mark the assignment as completed
- View prerequisites and assignment details
- See the 🔒 locked indicator if the assignment is locked with explanation

**Notifications Tab:**
- View all announcements from your courses
- See direct messages and inbox items
- Message previews for quick scanning
- Click any announcement to open it in Canvas

**Classes Tab:**
- Add your classes with subject names and meeting times
- Store meeting links (Google Meet, Zoom, Teams, or other)
- Edit or delete classes as needed
- Quick access to your meeting links from the extension
- Set reminders for upcoming classes

**Syncing Data:**
- Click **Sync** button to fetch the latest:
  - Assignments from all your courses
  - Announcements and messages from all courses
  - Prerequisites and locked status information
  - User submission status (auto-marks completed assignments)

## 🛠️ How Do I Run It?

### Prerequisites
- Google Chrome or Chromium-based browser (Edge, Brave, etc.)
- A Canvas LMS account with at least one course
- A Canvas Personal Access Token (generated in your account settings)

### Installation & Setup

1. **Clone or download this repository:**
   ```bash
   git clone https://github.com/ostol-uriel/Computahhh
   cd "Initial Canvas Tracker"
   ```

2. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions`
   - Toggle **Developer mode** (top-right corner)
   - Click **Load unpacked**
   - Select the repository folder
   - The extension will appear in your Chrome toolbar

3. **Generate a Canvas Token:**
   - Log into your Canvas instance
   - Click your profile icon → Settings
   - Scroll to "Approved Integrations"
   - Click **+ New Access Token**
   - Name it (e.g., "Deadline Guardian")
   - Set expiration (optional)
   - Click **Generate Token**
   - Copy the token (you'll only see it once!)

4. **Configure the extension:**
   - Click the Deadline Guardian icon in your toolbar
   - Click the ⚙️ settings icon
   - Paste your Canvas URL and API token
   - Click **Save**

5. **First sync:**
   - Click the **Sync** button
   - The extension will fetch all your courses and assignments
   - Check the "Assignments" tab to see your deadlines
   - Check the "Notifications" tab to see course announcements

### No Build Step Required
This is a vanilla HTML/CSS/JavaScript extension with no bundler or build process. After cloning, you can immediately load it in Chrome.

## 📁 Project Structure

```
.
├── manifest.json          # Chrome extension manifest (Manifest V3)
├── popup.html             # Extension popup UI
├── popup.css              # Styling for popup
├── popup.js               # Popup logic and Canvas API integration
├── background.js          # Service worker for notification handling
├── icons/                 # Extension icons (16px, 48px, 128px)
├── README.md              # This file
└── LICENSE               # License file
```

## 🔑 Key Features

### Summary Dashboard
- Quick view of deadline statistics
- Visual cards with urgency color coding
- Last sync timestamp

### Intelligent Filtering
- Filter by time period or urgency
- Grouped by TODAY, THIS WEEK, OVERDUE sections
- Quick "All" view for everything

### Assignment Management
- Course name and due date/time
- Remaining time countdown
- Prerequisites and requirements
- Locked status with explanations
- Direct links to Canvas
- **Mark Done button** - Toggle assignment completion status
- **Undo functionality** - Reverse your "Done" mark
- **Auto-sync completion** - Automatically marks submissions done when submitted on Canvas
- **Persistent tracking** - Marked assignments stay marked after closing the extension

### Class & Meeting Tracking
- Add subjects with meeting times
- Support for Google Meet, Zoom, Teams, and custom links
- Quick access to meeting links
- Edit and delete classes
- Class reminders

### Notifications System
- Browser notifications at 3-day, 1-day, and 3-hour marks
- Requires Interaction flag for urgent (3-hour) notifications
- Click notifications to open assignment in Canvas
- Custom reminder options (1hr, 12hrs, 1d, 2d, or custom)

### Course Communications
- View latest announcements from all courses
- See direct messages and inbox items
- Message previews with HTML stripping
- Sorted by newest first (30-day window)
- Quick links to open in Canvas

## 🔐 Privacy & Security

- **No data collection**: The extension only reads your Canvas data
- **Local storage only**: All data is stored locally in your browser
- **Token security**: Your Canvas token is stored in encrypted browser storage
- **No server communication**: The extension communicates directly with your Canvas instance

## 📝 Permissions Explained

- `storage` - Store your Canvas URL, token, and deadline data locally
- `alarms` - Schedule periodic notification checks (every 30 minutes)
- `notifications` - Display browser notifications for approaching deadlines
- `host_permissions: https://*/*` - Access your Canvas instance (intentionally broad to support custom Canvas domains)

## 🐛 Troubleshooting

**No deadlines showing?**
- Make sure you've synced at least once
- Check that you entered the correct Canvas URL and token
- Verify you have active courses in Canvas

**Notifications not showing?**
- Check Chrome notification permissions for your Canvas domain
- Ensure the extension has notification permission
- Verify your deadlines are actually within the notification windows (3d, 1d, 3h)

**"Sync failed" error?**
- Verify your Canvas URL is correct (no trailing slash needed)
- Check that your API token is valid
- Ensure your token hasn't expired

**"Missing permission" errors?**
- The extension may need to be reloaded after installation
- Click the reload icon on the extension card at `chrome://extensions`

## 💡 Tips & Best Practices

1. **Sync regularly** - Click Sync at least once per day to stay updated
2. **Set reminders** - Use the "Remind" button for extra-important assignments
3. **Check announcements** - Switch to the Notifications tab for course updates
4. **Review prerequisites** - Always check prerequisites before starting an assignment
5. **Pay attention to locked assignments** - Locked assignments usually have a reason

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👤 Author

Built with ❤️ for Canvas users who never want to miss a deadline.

## 🤝 Contributing

Have ideas to improve Deadline Guardian? Found a bug? Feel free to open an issue or submit a pull request!

---

**Last Updated:** May 6, 2026  
**Version:** 2.0.0  
**Canvas API Version:** v1 (Canvas REST API)

## 📝 Recent Updates (v2.0.0)
- ✨ Added Classes tab for tracking subjects and meeting links
- 🔄 Auto-sync task completion status from Canvas submissions
- 📌 Persistent "Mark Done" functionality
- 💬 Enhanced announcements with message previews
- 🎯 Improved notification system with custom reminders
- 🐛 Fixed announcements/notifications fetching
