# CV Generator - Professional Resume Builder

Create beautiful, professional CVs with multiple modern templates. Export as PDF, print, or share online.

## ✨ Features

- **4 Professional Templates**: Modern, Professional, Creative, Minimal
- **Real-time Preview**: See changes instantly
- **PDF Export**: Download your CV as a ready-to-print PDF
- **Print Support**: Print directly to paper
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Form-based Input**: Easy-to-use interface for entering CV information

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

## 📝 CV Sections

### Personal Information
- Full Name
- Email Address
- Phone Number
- Location
- Professional Summary

### Experience
- Add multiple job positions
- Job Title
- Company Name
- Start and End Dates
- Option to mark "Currently Working"
- Job Description

### Education
- Add multiple degrees
- Degree Name
- Institution/University
- Field of Study
- Graduation Date

### Skills
- Add skills as comma-separated list
- Example: JavaScript, React, TypeScript, CSS, etc.

## 🎨 Templates

### 1. Modern Template
- Clean, contemporary design
- Blue color scheme
- Section dividers with colored bars
- Great for tech industry

### 2. Professional Template
- Classic corporate style
- Serif fonts
- Traditional layout
- Perfect for formal roles

### 3. Creative Template
- Bold, colorful design
- Gradient header
- Side-by-side layout
- Ideal for creative professionals

### 4. Minimal Template
- Simple and elegant
- Minimal colors
- Focus on content
- Works for any industry

## 💾 Export Options

### Download as PDF
- A4 page size
- Print-ready resolution
- Preserves formatting
- Multi-page support

### Print Directly
- Print to physical paper
- Preview before printing
- Adjust page setup in browser

## 🛠️ Built With

- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **Vite** - Build Tool
- **jsPDF** - PDF Generation
- **html2canvas** - Canvas Rendering

## 📱 Responsive Design

- ✅ Mobile phones (320px+)
- ✅ Tablets (768px+)
- ✅ Desktops (1024px+)
- ✅ Large displays (1280px+)

## 🔄 Workflow

1. **Select Template** - Choose from 4 professional templates
2. **Fill Information** - Enter your CV details in the form
3. **Preview** - Switch to preview tab to see how it looks
4. **Download** - Get PDF or print
5. **Share** - Share your CV digitally

## 💡 Tips

- Switch between templates to see which looks best for your CV
- All changes are reflected in real-time in the preview
- PDF download preserves all formatting and styling
- Print preview in browser before actually printing
- You can regenerate the PDF multiple times

## 🐛 Troubleshooting

**PDF Download Not Working**
- Check browser console for errors
- Ensure all data is filled in
- Try a different browser
- Clear browser cache

**Formatting Looks Wrong**
- Check the preview before downloading
- Try a different template
- Ensure text isn't too long for sections

**Port 3000 Already in Use**
- Edit `vite.config.ts` and change port number
- Or kill the process using port 3000

## 🚀 Production Build

```bash
npm run build
# Output in dist/ folder
```

## 📚 File Structure

```
src/
├── components/
│   ├── CVForm.tsx              # CV data input form
│   ├── CVPreview.tsx           # PDF export & print
│   ├── TemplateSelector.tsx    # Template choice
│   └── templates/
│       ├── ModernTemplate.tsx
│       ├── ProfessionalTemplate.tsx
│       ├── CreativeTemplate.tsx
│       └── MinimalTemplate.tsx
├── types.ts                    # TypeScript types
├── App.tsx                     # Main app component
└── main.tsx                    # Entry point
```

## 🎯 Next Steps

- Add more templates
- Implement CV template customization
- Add AI suggestions for CV content
- Integrate with job search APIs
- Add LinkedIn profile import
- Cloud storage for saved CVs

## 📖 Learn More

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [jsPDF Documentation](https://github.com/parallax/jsPDF)

---

**Made with ❤️ for job seekers everywhere!**
