# Business Manager - Order & Sales Tracking

Complete order management and sales analytics system for small businesses. Track orders, manage receipts, and monitor profits.

## ✨ Features

- **📊 Dashboard**: Real-time sales analytics and profit tracking
- **📦 Order Management**: Create, update, and track orders
- **🧾 Receipt Generation**: Professional receipts with print & download
- **💰 Sales Tracking**: Monitor revenue, expenses, and profits
- **📈 Analytics**: Order status overview and conversion rates
- **📱 Mobile-Friendly**: Works on all devices
- **⚡ Real-time Updates**: Instant calculations and status changes

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3001 in your browser
```

## 📖 How to Use

### 1. Dashboard
View all your key business metrics:
- **Total Sales Revenue** - Sum of all delivered orders
- **Total Profit** - Revenue minus expenses
- **Profit Margin** - Percentage calculation
- **Conversion Rate** - Percentage of delivered orders
- **Order Status Overview** - Breakdown by status
- **Recent Orders** - Last 5 orders at a glance

### 2. Create New Order
```
1. Click "New Order" tab
2. Enter customer name and phone
3. Add delivery address
4. Add items one by one (name, quantity, price)
5. Add optional notes
6. Click "Create Order"
```

### 3. Manage Orders
```
1. Click "All Orders" tab
2. View all orders in a table
3. Filter by status using dropdown
4. Update order status by clicking on status badge
5. View receipt by clicking "View" icon
6. Delete orders by clicking "Delete" icon
```

### 4. Generate Receipts
```
1. Click "View" on an order
2. Receipt displays with order details
3. Click "Print Receipt" to print
4. Click "Download Receipt" to save as text file
```

## 📊 Dashboard Metrics

### Total Sales
- Sum of all order amounts
- Excludes cancelled orders
- Real-time calculation

### Total Profit
- Sales minus expenses
- Profit margin percentage
- Updated instantly

### Conversion Rate
- Percentage of delivered orders
- Shows business efficiency
- Calculated from all orders

### Order Status Overview
- **Pending**: New orders awaiting action
- **Processing**: Orders being prepared
- **Out for Delivery**: Orders in transit
- **Delivered**: Completed orders
- **Cancelled**: Cancelled orders

## 🛠️ Order Management

### Order Statuses
1. **Pending** - Initial status when order created
2. **Processing** - Preparing the order
3. **Out for Delivery** - Order shipped/picked up
4. **Delivered** - Order received by customer
5. **Cancelled** - Order cancelled

### Order Information
- Customer name and phone
- List of items with quantities and prices
- Automatic total calculation
- Delivery address
- Order date and time
- Optional notes

## 💾 Receipt Features

### Receipt Includes
- Order number and date
- Customer information
- Itemized list with prices
- Total amount
- Order status
- Order notes (if any)

### Export Options
- **Print**: Professional receipt to paper
- **Download**: Save as text file for records

## 🎯 Key Metrics Explained

### Profit Calculation
```
Profit = Total Sales - Total Expenses
```

### Profit Margin
```
Margin % = (Profit / Total Sales) × 100
```

### Conversion Rate
```
Rate % = (Delivered Orders / Total Orders) × 100
```

## 💡 Best Practices

1. **Update Order Status Regularly** - Keep customers informed
2. **Add Detailed Notes** - Track special requests or issues
3. **Use Consistent Naming** - Make searching easier
4. **Print Receipts** - Keep physical records
5. **Monitor Dashboard** - Track business health

## 🛠️ Built With

- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **Vite** - Build Tool
- **Zustand** - State Management

## 📱 Responsive Design

- ✅ Mobile phones (320px+)
- ✅ Tablets (768px+)
- ✅ Desktops (1024px+)
- ✅ Large displays (1280px+)

## 🔄 Data Persistence

**Current**: In-memory storage (lost on refresh)

**To Add Persistence**:
- LocalStorage (browser)
- Firebase/Supabase (cloud)
- Backend API (Node/Python)

## 🐛 Troubleshooting

**Orders Not Saving**
- Data is in-memory, refresh loses data
- Consider adding LocalStorage persistence
- Use browser DevTools to check console

**Port 3001 Already in Use**
- Edit `vite.config.ts` and change port
- Or stop the process using that port

**Receipt Print Issues**
- Check browser print settings
- Ensure page setup is correct
- Try "Save as PDF" instead

## 📊 Typical Workflow

1. Open Dashboard - Review metrics
2. Create New Order - Add customer and items
3. Update Status - Move through workflow
4. View Receipt - Print or download when ready
5. Check Dashboard - Monitor sales trends

## 🎨 Customization

### Change Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  primary: '#YOUR_COLOR',
  secondary: '#YOUR_COLOR',
}
```

### Change Currency
Search for "₦" symbol and replace with your currency in components

### Add New Status
Edit `store.ts` and add new status type

## 🚀 Production Build

```bash
npm run build
# Output in dist/ folder
```

## 📁 File Structure

```
src/
├── components/
│   ├── Header.tsx          # App header
│   ├── Dashboard.tsx       # Analytics & metrics
│   ├── OrderForm.tsx       # Create orders
│   ├── OrderList.tsx       # View/manage orders
│   └── OrderReceipt.tsx    # Print receipts
├── store.ts                # Zustand state management
├── App.tsx                 # Main app component
└── main.tsx                # Entry point
```

## 🎯 Future Features

- [ ] Uber/Bolt delivery integration
- [ ] Payment gateway integration
- [ ] SMS notifications to customers
- [ ] Email receipts
- [ ] Advanced analytics & charts
- [ ] Expense tracking
- [ ] Inventory management
- [ ] Multi-user support
- [ ] Database backend
- [ ] Mobile app version

## 📚 Learn More

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Zustand](https://github.com/pmndrs/zustand)

---

**Built to help small businesses grow and manage efficiently! 💼**
