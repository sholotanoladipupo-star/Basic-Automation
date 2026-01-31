# Customization Guide

This guide helps you customize both applications to fit your needs.

## 🎨 Changing Colors

### CV Generator

Edit `CV-Generator/tailwind.config.js`:

```javascript
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',    // Change this
        secondary: '#10B981',  // And this
        accent: '#F59E0B',     // And this
      },
    },
  },
  plugins: [],
};
```

### Business App

Same process in `Business-App/tailwind.config.js`

### How Colors Are Used

- **Primary**: Buttons, headers, main elements
- **Secondary**: Success states, accents
- **Accent**: Warnings, highlights

## 🔤 Changing Fonts

Edit `src/index.css` in any project:

```css
body {
  @apply bg-gray-50 text-gray-900;
  font-family: 'Your Font Name', sans-serif;  /* Change this */
}
```

Or use Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

body {
  font-family: 'Poppins', sans-serif;
}
```

## 📍 Changing Port Numbers

### CV Generator (vite.config.ts)
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,  // Change to any free port
    host: true,
  },
});
```

### Business App (vite.config.ts)
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,  // Change to any free port
    host: true,
  },
});
```

## 💱 Changing Currency

### Business App

In `src/components/Dashboard.tsx`, find:
```javascript
₦{totalSales.toLocaleString()}
```

Replace `₦` with your currency symbol:
- `$` for USD
- `€` for EUR
- `£` for GBP
- `¥` for JPY
- Or any symbol you want

Search & Replace in all components:
1. Open Search: `Cmd+Shift+F` (Mac) or `Ctrl+Shift+F` (Windows)
2. Search: `₦`
3. Replace: `$` (or your currency)

## 🎯 Changing App Names

### CV Generator

In `CV-Generator/index.html`:
```html
<title>CV Generator</title>  <!-- Change this -->
```

In `CV-Generator/src/App.tsx`:
```jsx
<h1 className="text-3xl font-bold">CV Generator</h1>  <!-- Change this -->
```

### Business App

In `Business-App/index.html`:
```html
<title>Business Manager</title>  <!-- Change this -->
```

In `Business-App/src/components/Header.tsx`:
```jsx
<h1 className="text-3xl font-bold">Business Manager</h1>  <!-- Change this -->
```

## 📧 Adding Company Info

### CV Generator

Edit `CV-Generator/src/components/templates/ModernTemplate.tsx` to add:
```jsx
<p className="text-gray-600">Powered by Your Company Name</p>
```

### Business App

Edit `Business-App/src/components/Header.tsx` to add:
```jsx
<p className="text-blue-100">Your Company • contact@company.com</p>
```

## 🗂️ Adding CV Templates

To add a new CV template:

1. Create new file: `src/components/templates/YourTemplate.tsx`

```typescript
import React from 'react';
import { CVData } from '../../types';

interface TemplateProps {
  cvData: CVData;
}

export default function YourTemplate({ cvData }: TemplateProps) {
  return (
    <div className="font-sans">
      {/* Your template HTML here */}
    </div>
  );
}
```

2. Update `src/components/TemplateSelector.tsx`:
```javascript
const templates = [
  // ... existing templates
  { value: 'your_template', label: 'Your Template', description: 'Your description' },
];
```

3. Update `src/App.tsx` type:
```typescript
type Template = 'modern' | 'professional' | 'creative' | 'minimal' | 'your_template';
```

4. Update `CVPreview.tsx`:
```typescript
case 'your_template':
  return <YourTemplate cvData={cvData} />;
```

## 📦 Adding Order Statuses

Edit `Business-App/src/store.ts`:

```typescript
export interface Order {
  // ... existing fields
  status: 'pending' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'on_hold';
  // Add your new status
}
```

Update `OrderList.tsx` select options:
```jsx
<option value="on_hold">On Hold</option>
```

## 🎯 Adding Dashboard Metrics

In `Business-App/src/components/Dashboard.tsx`:

```typescript
const customMetric = orders
  .filter(o => /* your condition */)
  .reduce((sum, order) => sum + order.totalAmount, 0);
```

Then add to dashboard:
```jsx
<div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
  <p className="text-gray-600">Your Metric</p>
  <p className="text-3xl font-bold text-blue-600">₦{customMetric.toLocaleString()}</p>
</div>
```

## 🔐 Adding Logo

### CV Generator

Add to `src/App.tsx` header:
```jsx
<img src="/logo.png" alt="Logo" className="w-10 h-10" />
```

Place image in `public/logo.png`

### Business App

Add to `src/components/Header.tsx`:
```jsx
<img src="/logo.png" alt="Logo" className="w-10 h-10" />
```

## 🌙 Adding Dark Mode

Install plugin:
```bash
npm install -D @tailwindcss/forms
```

Update `tailwind.config.js`:
```javascript
module.exports = {
  darkMode: 'class',  // Add this
  theme: {
    // ... rest of config
  },
};
```

Use in components:
```jsx
<div className="bg-white dark:bg-gray-900">
  <p className="text-gray-900 dark:text-white">Dark mode ready!</p>
</div>
```

## 🔔 Adding Notifications

Use simple alerts for now:
```javascript
// Success
alert('✅ Success! Order created');

// Error
alert('❌ Error! Please try again');

// Info
alert('ℹ️ Order updated');
```

## 📊 Customizing Receipt

Edit `Business-App/src/components/OrderReceipt.tsx`:

```jsx
{/* Add your company info */}
<div className="text-center mb-4">
  <h1 className="text-2xl font-bold">Your Company Name</h1>
  <p>123 Business Street, City</p>
  <p>Phone: +234 XXX XXXX</p>
</div>
```

## 🎨 CV Template Customization

Edit any template file to change:

- Colors: Update className colors
- Layout: Change grid/flex classes
- Fonts: Add font classes
- Spacing: Modify px/py values
- Borders: Change border styles

Example in `ModernTemplate.tsx`:
```jsx
<div className="bg-gradient-to-r from-blue-600 to-blue-800">  <!-- Colors -->
  <h1 className="text-4xl font-bold">  <!-- Font sizes -->
```

## 🔄 Resetting to Default

If you mess something up:

```bash
# Restore single file from git
git checkout src/components/Dashboard.tsx

# Or restore everything
git checkout .

# Or just reinstall dependencies
rm -rf node_modules
npm install
```

## 💾 Saving Custom Changes

Create a backup:
```bash
# Copy entire folder
cp -r CV-Generator CV-Generator-backup
cp -r Business-App Business-App-backup
```

## 🚀 Performance Optimization

### Lazy Load Components
```typescript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### Image Optimization
```jsx
<img 
  src="image.webp"  // Use WebP format
  alt="Description"
  loading="lazy"     // Lazy load
  width={100}
  height={100}
/>
```

## 📱 Adding Mobile Menu

In App.tsx:
```jsx
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

return (
  <>
    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
      ☰ Menu
    </button>
    {mobileMenuOpen && (
      <nav className="md:hidden">
        {/* Mobile menu items */}
      </nav>
    )}
  </>
);
```

## 🔗 Adding External Links

```jsx
<a 
  href="https://example.com"
  target="_blank"
  rel="noopener noreferrer"
  className="text-blue-600 hover:underline"
>
  External Link
</a>
```

## 📝 Common Customizations Checklist

- [ ] Change app name
- [ ] Update colors to match brand
- [ ] Add company logo
- [ ] Update currency symbol
- [ ] Add custom fonts
- [ ] Change port numbers
- [ ] Add company information
- [ ] Update templates
- [ ] Customize receipt format
- [ ] Add metrics to dashboard

## ❓ Need More Help?

- Check Tailwind CSS docs: https://tailwindcss.com
- React documentation: https://react.dev
- Vite docs: https://vitejs.dev

---

**Happy customizing! 🎨**
