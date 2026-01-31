import React from 'react';
import { Order } from '../store';
import { Printer, Download } from 'lucide-react';

interface OrderReceiptProps {
  order: Order;
}

export default function OrderReceipt({ order }: OrderReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Simple text download as alternative
    const receiptText = `
=====================================
          ORDER RECEIPT
=====================================

Date: ${new Date(order.createdAt).toLocaleDateString()}
Order ID: ${order.id}

CUSTOMER INFORMATION
-------------------------------------
Name: ${order.customerName}
Phone: ${order.customerPhone}
Address: ${order.deliveryAddress}

ORDER ITEMS
-------------------------------------
${order.items.map(item => `${item.name}
  Qty: ${item.quantity} x ₦${item.price.toLocaleString()} = ₦${(item.quantity * item.price).toLocaleString()}`).join('\n')}

-------------------------------------
TOTAL: ₦${order.totalAmount.toLocaleString()}

Status: ${order.status.replace(/_/g, ' ').toUpperCase()}
${order.notes ? `Notes: ${order.notes}` : ''}

=====================================
    `;
    
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(receiptText));
    element.setAttribute('download', `receipt-${order.id}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-4 justify-center sticky top-20 z-40">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg"
        >
          <Printer className="w-5 h-5" />
          Print Receipt
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-lg"
        >
          <Download className="w-5 h-5" />
          Download Receipt
        </button>
      </div>

      {/* Receipt */}
      <div className="bg-white rounded-lg shadow-lg p-12 max-w-2xl mx-auto print:shadow-none">
        <div className="border border-gray-300 p-8 bg-white">
          {/* Header */}
          <div className="text-center mb-8 pb-4 border-b-2 border-gray-300">
            <h1 className="text-3xl font-bold text-gray-900">RECEIPT</h1>
            <p className="text-gray-600 mt-2">Order #{order.id}</p>
            <p className="text-sm text-gray-500">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Customer Info */}
          <div className="mb-8">
            <h2 className="font-bold text-gray-900 mb-3">Customer Information</h2>
            <div className="text-gray-700 space-y-1">
              <p>
                <span className="font-semibold">Name:</span> {order.customerName}
              </p>
              <p>
                <span className="font-semibold">Phone:</span> {order.customerPhone}
              </p>
              <p>
                <span className="font-semibold">Address:</span> {order.deliveryAddress}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="mb-8">
            <h2 className="font-bold text-gray-900 mb-3">Order Items</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 font-semibold text-gray-900">Item</th>
                  <th className="text-center py-2 font-semibold text-gray-900">Qty</th>
                  <th className="text-right py-2 font-semibold text-gray-900">Price</th>
                  <th className="text-right py-2 font-semibold text-gray-900">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-2 text-gray-700">{item.name}</td>
                    <td className="text-center py-2 text-gray-700">{item.quantity}</td>
                    <td className="text-right py-2 text-gray-700">
                      ₦{item.price.toLocaleString()}
                    </td>
                    <td className="text-right py-2 font-semibold text-gray-900">
                      ₦{(item.quantity * item.price).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="bg-gray-100 p-4 rounded-lg mb-8">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">TOTAL AMOUNT:</span>
              <span className="text-3xl font-bold text-blue-600">
                ₦{order.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Status and Notes */}
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-semibold text-gray-900">Status:</span>
              <span className={`ml-2 px-3 py-1 rounded-full font-semibold ${
                order.status === 'delivered'
                  ? 'bg-green-100 text-green-800'
                  : order.status === 'pending'
                  ? 'bg-orange-100 text-orange-800'
                  : order.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            {order.notes && (
              <div>
                <span className="font-semibold text-gray-900">Notes:</span>
                <p className="mt-1 text-gray-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-600">
            <p>Thank you for your business!</p>
            <p className="mt-2">Receipt printed on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
