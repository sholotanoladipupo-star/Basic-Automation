# 💝 Valentine App - Special Surprise

A beautiful, interactive Valentine's Day surprise app built with React, TypeScript, and Tailwind CSS.

## 🎯 Features

✨ **Interactive Journey**
- Welcome screen with romantic vibes
- Upload and browse through shared memories
- Answer fun questions about yourself
- Make a Valentine's Day proposal
- Celebrate the "yes" moment

👼 **Photo Gallery**
- Upload multiple photos from your Photos Library
- Browse through memories with carousel controls
- Delete or add more photos anytime
- Beautiful presentation with captions

❓ **Questions & Responses**
- What's your favorite food?
- One thing that describes you
- Date preference: Dinner, Beach, or Lovey Hangout
- Outfit selection: Short Gown, Long Gown, or Jumpsuit

💍 **The Proposal**
- Beautiful "Will you be my valentine?" screen
- Shows all responses and preferences
- Heartwarming animations and effects
- Celebration confetti on "YES!"

🎉 **Final Celebration**
- Beautiful summary of your special moment
- Shareable URL to relive the moment
- Save and share with your loved one

## 🚀 Quick Start

```bash
# Navigate to Valentine app directory
cd Valentine-App

# Install dependencies
npm install

# Start development server
npm run dev

# App opens at http://localhost:3002
```

## 📸 How to Use

1. **Start the Journey**: Click "Let's Begin" on the welcome screen
2. **Upload Memories**: Select photos from your computer (you can drag & drop or click)
3. **Unfold Photos**: Browse through memories using arrows or thumbnails
4. **Answer Questions**: Fill in the fun questions about yourself
5. **The Proposal**: See the beautiful proposal screen
6. **Make Your Choice**: Click "YES!" to celebrate
7. **Save & Share**: Copy the URL to share with your loved one

## 🎨 Customization

### Change Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  rose: {
    500: '#YOUR_COLOR_HERE',
    600: '#YOUR_COLOR_HERE',
  }
}
```

### Change Ports
Edit `vite.config.ts`:
```typescript
server: {
  port: 3002,  // Change to any available port
}
```

### Add More Questions
Edit `src/components/QuestionsFlow.tsx` and add more question sections.

### Customize Messages
Update text in each component file - all messages are easy to find and edit.

## 📦 Build for Production

```bash
npm run build
npm run preview
```

## 🌐 Deploy

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Deploy to DigitalOcean
See main README.md for detailed instructions.

## 🛠️ Tech Stack

- **React 18.2** - UI Framework
- **TypeScript 5.3** - Type Safety
- **Tailwind CSS 3.3** - Styling
- **Vite 5.0** - Build Tool
- **Zustand 4.4** - State Management
- **Lucide React** - Icons

## 💾 Data Storage

Currently, all data is stored in-memory (lost on refresh). To add persistence:

### Option 1: Browser LocalStorage
```javascript
// Auto-save responses
localStorage.setItem('valentineData', JSON.stringify(responses));
```

### Option 2: Cloud Database (Firebase, Supabase)
Add a backend service to save data permanently.

## 🎁 Sharing with Friends

### Same WiFi Network
1. Find your IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Share: `http://YOUR_IP:3002`

### Internet-Wide
1. Install ngrok: https://ngrok.com
2. Run: `ngrok http 3002`
3. Share the HTTPS URL

## 🚨 Troubleshooting

**Port already in use?**
```bash
# Use a different port
vite --port 3003
```

**Photos not uploading?**
- Ensure files are in valid image format (JPG, PNG, GIF, etc.)
- Check browser console for errors
- Try uploading one photo at a time

**Styling issues?**
```bash
# Rebuild Tailwind CSS
npm run build
```

## 📄 File Structure

```
Valentine-App/
├── src/
│   ├── components/
│   │   ├── WelcomeScreen.tsx
│   │   ├── PhotoGallery.tsx
│   │   ├── QuestionsFlow.tsx
│   │   ├── ProposalScreen.tsx
│   │   └── FinalScreen.tsx
│   ├── App.tsx
│   ├── store.ts
│   ├── types.ts
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## 💝 Tips for the Best Experience

1. **Choose Quality Photos**: Select clear, well-lit photos of your memories
2. **Meaningful Captions**: Add personal captions to photos
3. **Honest Answers**: Answer questions truthfully for maximum impact
4. **Mobile Friendly**: Works great on phones and tablets
5. **Timing**: Choose the right moment to send the link

## 🎨 Beautiful Moments Captured

This app celebrates:
- ♥ The memories you've shared
- ✨ Your unique personality
- 💕 The love you share
- 🎉 The special connection between you two

---

**Made with ❤️ for Valentine's Day**

Need help? Check the main README.md in the parent directory!
