import React, { useState } from 'react';
import { useBusinessStore, OrderItem, Order } from '../store';
import { Plus, Trash2, Send } from 'lucide-react';

export default function OrderForm() {
  const { addOrder } = useBusinessStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, price: 0 });

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleAddItem = () => {
    if (newItem.name && newItem.price > 0) {
      const item: OrderItem = {
        id: Date.now().toString(),
        ...newItem,
      };
      setItems([...items, item]);
      setNewItem({ name: '', quantity: 1, price: 0 });
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    if (!customerName || items.length === 0) {
      alert('Please fill in customer name and add items');
      return;
    }

    const order: Order = {
      id: Date.now().toString(),
      customerName,
      customerPhone,
      items,
      totalAmount,
      status: 'pending',
      deliveryAddress,
      createdAt: new Date(),
      notes,
    };

    addOrder(order);
    alert('Order created successfully!');

    // Reset form
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setItems([]);
    setNotes('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>

        {/* Customer Information */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
          <input
            type="text"
            placeholder="Customer Name"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Delivery Address"
            value={deliveryAddress}
            onChange={e => setDeliveryAddress(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Items */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>

          {items.length > 0 && (
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Item</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Qty</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Price</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Subtotal</th>
                    <th className="text-center py-3 px-4 text-gray-700 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="py-3 px-4">{item.name}</td>
                      <td className="py-3 px-4">{item.quantity}</td>
                      <td className="py-3 px-4">₦{item.price.toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold">
                        ₦{(item.quantity * item.price).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Add New Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Item Name"
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={newItem.quantity}
                onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                min="1"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Price"
                value={newItem.price}
                onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                min="0"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAddItem}
              className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Item
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-gray-700 font-semibold">Order Notes (Optional)</label>
          <textarea
            placeholder="Add any special instructions or notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Total and Submit */}
        <div className="border-t-2 border-gray-200 pt-6 space-y-4">
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold text-gray-900">Total Amount:</span>
            <span className="text-3xl font-bold text-blue-600">₦{totalAmount.toLocaleString()}</span>
          </div>
          <button
            onClick={handleSubmit}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2 text-lg"
          >
            <Send className="w-5 h-5" />
            Create Order
          </button>
        </div>
      </div>
    </div>
  );
}
