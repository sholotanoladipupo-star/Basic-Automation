# CV Generator & Business App - Setup Guide

## Overview

This repository contains two modern web applications:
1. **CV Generator** - Create beautiful CVs with multiple templates and download as PDF
2. **Business App** - Manage orders, track sales, and monitor profits

## Prerequisites

- Node.js 18+ (https://nodejs.org/)
- npm or yarn
- Modern web browser

## Quick Start

### 1. CV Generator Setup

```bash
cd CV-Generator
npm install
npm run dev
```

The CV Generator will be available at `http://localhost:3000`

**Features:**
- Multiple CV templates (Modern, Professional, Creative, Minimal)
- Form-based CV building
- Real-time preview
- Download as PDF
- Print functionality

### 2. Business App Setup

```bash
cd Business-App
npm install
npm run dev
```

The Business App will be available at `http://localhost:3001`

**Features:**
- Create and manage orders
- Track order status (Pending, Processing, Out for Delivery, Delivered, Cancelled)
- View sales dashboard with key metrics
- Print and download receipts
- Filter orders by status
- Real-time profit calculation

## Project Structure

### CV Generator
```
CV-Generator/
├── src/
│   ├── components/
│   │   ├── CVForm.tsx        # Main form for CV input
│   │   ├── CVPreview.tsx     # PDF download & print
│   │   ├── TemplateSelector.tsx
│   │   └── templates/
│   │       ├── ModernTemplate.tsx
│   │       ├── ProfessionalTemplate.tsx
│   │       ├── CreativeTemplate.tsx
│   │       └── MinimalTemplate.tsx
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── types.ts
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

### Business App
```
Business-App/
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Dashboard.tsx     # Analytics & metrics
│   │   ├── OrderForm.tsx     # Create new orders
│   │   ├── OrderList.tsx     # View all orders
│   │   └── OrderReceipt.tsx  # Print/download receipts
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── store.ts              # Zustand state management
│   └── types.ts
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Technologies Used

- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Fast build tool
- **jsPDF & html2canvas** - PDF generation (CV)
- **Zustand** - State management (Business App)
- **Lucide React** - Icons

## Features in Detail

### CV Generator

1. **Template Selection**
   - Modern: Clean, contemporary design with blue theme
   - Professional: Classic corporate style
   - Creative: Bold, colorful layout with gradients
   - Minimal: Simple and elegant

2. **CV Sections**
   - Personal Information (name, email, phone, location, summary)
   - Experience (add multiple jobs with descriptions)
   - Education (add degrees and institutions)
   - Skills (comma-separated list)

3. **Export Options**
   - Download as PDF
   - Print to physical paper
   - Real-time preview

### Business App

1. **Dashboard**
   - Total Sales Revenue
   - Total Profit & Profit Margin
   - Conversion Rate
   - Order Status Overview
   - Recent Orders List

2. **Order Management**
   - Create new orders with items
   - Track 5 order statuses
   - Add delivery address
   - Include customer phone
   - Add order notes

3. **Receipt Management**
   - Professional receipt format
   - Print receipts
   - Download as text file
   - Order items breakdown

4. **Analytics**
   - Real-time sales tracking
   - Order status distribution
   - Delivery completion rate

## Local Testing & Sharing

### Testing Locally

1. Open terminal in project folder
2. Run `npm run dev`
3. Open browser to `http://localhost:3000` (CV) or `http://localhost:3001` (Business)

### Sharing with Friends

1. Make sure your fireplace is configured (Windows Firewall / macOS)
2. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. Share URL: `http://YOUR_LOCAL_IP:3000` or `http://YOUR_LOCAL_IP:3001`
4. Friends must be on same network

**For wider sharing**, use:
- **Ngrok**: `ngrok http 3000` → Get public URL
- **Vercel**: Deploy and get public URL
- **Localhost.run**: `ssh -R 80:localhost:3000 localhost.run`

## Building for Production

### CV Generator
```bash
cd CV-Generator
npm run build
# Output in dist/ folder
```

### Business App
```bash
cd Business-App
npm run build
# Output in dist/ folder
```

## Data Storage

Currently both apps use:
- **In-memory storage** for CV data (lost on page refresh)
- **Zustand store** for Business App orders (lost on page refresh)

To persist data, add:
1. LocalStorage (browser)
2. Firebase/Supabase (cloud)
3. Backend API (Node/Python server)

## Future Enhancements

### CV Generator
- AI-powered content suggestions
- Integration with job search APIs
- LinkedIn import
- Multiple CV versions for different roles
- Cloud sync

### Business App
- Delivery integration (Uber/Bolt APIs)
- Payment integration
- SMS notifications
- Email receipts
- Database persistence
- Multi-user support
- Expense tracking
- Advanced analytics

## Troubleshooting

### Port Already in Use
```bash
# Change port in vite.config.ts
server: {
  port: 3002,  // or any free port
}
```

### Dependencies Issues
```bash
# Clear cache and reinstall
rm -rf node_modules
rm package-lock.json
npm install
```

### PDF Download Not Working
- Check browser console for errors
- Ensure html2canvas can access images (use CORS)

## Support

For issues or questions:
1. Check the component files for inline comments
2. Review React/TypeScript documentation
3. Check Tailwind CSS docs for styling

## License

Open source - feel free to modify and share!

---

**Happy coding! 🚀**
