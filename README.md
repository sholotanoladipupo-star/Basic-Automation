# Basic Automation Projects

Complete suite of modern web applications built with React, TypeScript, and Tailwind CSS.

## 📋 Projects Included

### 1. **CV Generator** 🎓
A beautiful, professional CV creation tool with multiple templates and PDF export.

**Key Features:**
- ✨ 4 Professional Templates (Modern, Professional, Creative, Minimal)
- 📝 Comprehensive Form Inputs (Personal Info, Experience, Education, Skills)
- 📥 Download as PDF
- 🖨️ Print Functionality
- 👁️ Real-time Preview
- 📱 Responsive Design

**Getting Started:**
```bash
cd CV-Generator
npm install
npm run dev
```
Access at: `http://localhost:3000`

---

### 2. **Business Manager App** 💼
Complete order and sales management system for small businesses.

**Key Features:**
- 📊 Interactive Dashboard with Real-time Analytics
- 📦 Order Management (Create, Update, Track)
- 💰 Sales & Profit Tracking
- 🧾 Professional Receipt Generation
- 🖨️ Print & Download Receipts
- 📈 Order Status Overview
- 📱 Mobile-Friendly Interface

**Getting Started:**
```bash
cd Business-App
npm install
npm run dev
```
Access at: `http://localhost:3001`

---

### 3. **Valentine App** 💝 *(NEW)*
A beautiful, interactive Valentine's Day surprise app to make the day unforgettable!

**Key Features:**
- 📸 Interactive Photo Gallery (Upload & Browse Memories)
- ❓ Fun Questions About You (Food, Personality, Date Preference, Outfit)
- 💍 Beautiful Proposal Screen
- 🎉 Celebration & Sharing
- ✨ Romantic Animations & Effects
- 📱 Fully Responsive Design
- 🌐 Shareable Link

**Getting Started:**
```bash
cd Valentine-App
npm install
npm run dev
```
Access at: `http://localhost:3002`

**How It Works:**
1. Upload photos from your memories
2. Answer fun questions about yourself
3. Experience a beautiful proposal
4. Celebrate with confetti
5. Share the link with your loved one

👉 **See [VALENTINE_APP_GUIDE.md](./VALENTINE_APP_GUIDE.md) for detailed guide!**

---

## 🚀 Quick Setup

### All Apps Together

```bash
# Install all dependencies at once
./install-all.sh
```

### Individual Setup

**CV Generator:**
```bash
cd CV-Generator
npm install
npm run dev
```

**Business App:**
```bash
cd Business-App
npm install
npm run dev
```

**Valentine App:**
```bash
cd Valentine-App
npm install
npm run dev
```

---

## 💻 System Requirements

- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher
- **Browser**: Modern browser (Chrome, Firefox, Safari, Edge)
- **Disk Space**: ~500MB
- **RAM**: 2GB minimum

---

## 🌍 Sharing with Friends

### Local Network Sharing

1. **Find Your IP:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Share URL:**
   - CV: `http://YOUR_IP:3000`
   - Business App: `http://YOUR_IP:3001`

### Local Network Sharing

1. **Find Your IP:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Share URLs:**
   - CV Generator: `http://YOUR_IP:3000`
   - Business App: `http://YOUR_IP:3001`
   - Valentine App: `http://YOUR_IP:3002`

### Public URL (Ngrok)

```bash
ngrok http 3000  # CV Generator
ngrok http 3001  # Business App
ngrok http 3002  # Valentine App
```

---

## 📚 Documentation

- [VALENTINE_APP_GUIDE.md](./VALENTINE_APP_GUIDE.md) - Complete Valentine app guide
- [CV-Generator/README.md](./CV-Generator/README.md) - CV app documentation
- [Business-App/README.md](./Business-App/README.md) - Business app documentation
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup instructions
- [CUSTOMIZATION_GUIDE.md](./CUSTOMIZATION_GUIDE.md) - How to customize all apps

---

## 🎯 Project Ports

| App | Port | Access |
|-----|------|--------|
| CV Generator | 3000 | http://localhost:3000 |
| Business App | 3001 | http://localhost:3001 |
| Valentine App | 3002 | http://localhost:3002 |

---

## 📚 Tech Stack

- React 18 | TypeScript | Tailwind CSS
- Vite | jsPDF | html2canvas | Zustand

---

## 📖 Quick Documentation

See **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** for detailed setup and usage instructions.

---

## 🎓 For more details, visit individual project READMEs:**

- [CV-Generator/README.md](./CV-Generator/README.md)
- [Business-App/README.md](./Business-App/README.md)
