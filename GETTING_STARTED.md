# 🚀 Getting Started Guide

Welcome to Basic Automation! This guide will help you get both applications running locally.

## ⚡ 5-Minute Quick Start

### Step 1: Install Node.js
- Download from https://nodejs.org/ (Choose LTS version)
- Verify installation: `node --version`

### Step 2: Clone/Download Projects
```bash
cd /Users/mac/myproject/Basic-Automation
```

### Step 3: Install Dependencies

**Option A: Both at once (macOS/Linux)**
```bash
chmod +x install-all.sh
./install-all.sh
```

**Option B: Individual setup**
```bash
# CV Generator
cd CV-Generator
npm install

# Business App (in another terminal)
cd ../Business-App
npm install
```

### Step 4: Start Applications

**Terminal 1 - CV Generator:**
```bash
cd CV-Generator
npm run dev
# Open http://localhost:3000
```

**Terminal 2 - Business App:**
```bash
cd Business-App
npm run dev
# Open http://localhost:3001
```

## 🌐 Accessing from Other Devices

### Same WiFi Network

1. **Find Your IP:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```

2. **Share URLs:**
   - CV: `http://192.168.x.x:3000` (replace with your IP)
   - Business: `http://192.168.x.x:3001`

3. **Friends Access:**
   - Type URL in their browser
   - Must be on same WiFi

### Internet-Wide Sharing

**Using Ngrok (Easiest):**

1. Download from https://ngrok.com/download
2. Extract and run:
   ```bash
   ./ngrok http 3000  # For CV Generator
   ./ngrok http 3001  # For Business App
   ```
3. Share the provided HTTPS URL

**Using Localhost.run:**
```bash
ssh -R 80:localhost:3000 localhost.run
# Generates public URL automatically
```

## 📦 What Gets Installed

- **Node Modules**: Dependencies for both projects (~300MB)
- **Build Tools**: Vite, TypeScript, ESLint
- **UI Libraries**: React, Tailwind CSS
- **Utilities**: jsPDF, Zustand, Lucide Icons

## 💻 Minimum Requirements

| Requirement | Minimum | Recommended |
|------------|---------|------------|
| Node.js | 18.0 | 20.0+ |
| npm | 9.0 | 10.0+ |
| RAM | 2GB | 8GB+ |
| Disk Space | 500MB | 1GB |
| Browser | Chrome 90+ | Latest version |

## 🎯 First Time Using?

### CV Generator First Steps:
1. Open http://localhost:3000
2. Try different templates
3. Fill in sample data
4. Click "Preview & Download"
5. Download as PDF

### Business App First Steps:
1. Open http://localhost:3001
2. Review Dashboard metrics
3. Click "New Order"
4. Add sample customer and items
5. Click "Create Order"
6. View receipt

## 🐛 Common Issues & Solutions

### Issue: "Port 3000 already in use"
```bash
# Find what's using it
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in vite.config.ts
server: { port: 3002 }
```

### Issue: "npm command not found"
- Node.js not installed properly
- Restart terminal after installation
- Check PATH environment variable

### Issue: "node_modules not found after npm install"
```bash
# Clear cache and reinstall
rm -rf node_modules
npm cache clean --force
npm install
```

### Issue: "Can't access from friend's phone"
- Check firewall settings
- Both devices on same WiFi?
- Disable VPN on both devices
- Restart development server

### Issue: "Tailwind styles not loading"
```bash
# Rebuild CSS
npm run build
npm run dev
```

## 📱 Testing on Mobile

### iPhone/iPad
1. Find your Mac's IP
2. Open Safari
3. Type `http://192.168.x.x:3000`
4. Should display responsive design

### Android Phone
1. Find your Mac's IP
2. Open Chrome
3. Type `http://192.168.x.x:3000`
4. Test touch interactions

## 🔧 Configuration

### Change Port Numbers

**CV-Generator/vite.config.ts:**
```typescript
server: {
  port: 3000,  // Change to any number
  host: true,
},
```

### Change Colors

**tailwind.config.js** (in each project):
```javascript
theme: {
  extend: {
    colors: {
      primary: '#3B82F6',    // Change colors
      secondary: '#10B981',
    },
  },
},
```

## 📊 Project Structure

```
Basic-Automation/
├── CV-Generator/          ← Create & download CVs
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
├── Business-App/          ← Manage orders & sales
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
├── install-all.sh         ← Auto-install script
├── start-all.sh           ← Run both apps
└── SETUP_GUIDE.md
```

## 🎓 Learning Tips

1. **Explore the UI** - Click around, try all features
2. **Check Browser Console** - See error messages
3. **Read Comments** - Code files have helpful comments
4. **Experiment** - Try different inputs and see results
5. **Share Feedback** - Help improve the apps

## 🚀 Next Steps

After getting comfortable:

1. **Customize Colors** - Make it yours
2. **Add Data Persistence** - Save data to LocalStorage
3. **Deploy Online** - Put on Vercel/Netlify
4. **Add Features** - Extend functionality
5. **Share with Team** - Get feedback

## 🆘 Need Help?

1. Check individual README files in each project folder
2. Review code comments in component files
3. Check browser console for error messages
4. Verify Node.js is installed correctly
5. Try clearing cache and reinstalling

## 📚 Useful Commands

```bash
# Start both apps at once
./start-all.sh

# Just CV Generator
cd CV-Generator && npm run dev

# Just Business App
cd Business-App && npm run dev

# Build for production
cd CV-Generator && npm run build
cd Business-App && npm run build

# Clear everything and reinstall
rm -rf node_modules
npm cache clean --force
npm install
```

## 💡 Pro Tips

1. **Multiple Terminals**: Use separate terminals for each app
2. **Browser Tabs**: Keep both apps open in different tabs
3. **Mobile Testing**: Use DevTools device emulation
4. **Local IP**: Save your IP for quick access
5. **ngrok URLs**: Bookmark them for sharing

## ✅ Verification Checklist

- [ ] Node.js installed (check: `node --version`)
- [ ] npm installed (check: `npm --version`)
- [ ] Dependencies installed (check: look for node_modules)
- [ ] CV Generator running on 3000
- [ ] Business App running on 3001
- [ ] Can access from phone/another device
- [ ] Both apps fully functional

## 🎉 You're Ready!

Everything is set up. Start building and sharing your applications!

**Questions?** Refer to individual project READMEs or code comments.

---

**Happy Building! 🚀**
