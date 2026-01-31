import React, { useState } from 'react';
import { useBusinessStore } from '../store';
import { Trash2, Eye } from 'lucide-react';
import OrderReceipt from './OrderReceipt';

export default function OrderList() {
  const { orders, updateOrder, deleteOrder } = useBusinessStore();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(order => order.status === filterStatus);

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrder(orderId, { status: newStatus as any });
  };

  const handleDelete = (orderId: string) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      deleteOrder(orderId);
    }
  };

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  if (selectedOrderId && selectedOrder) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedOrderId(null)}
          className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition"
        >
          ← Back to Orders
        </button>
        <OrderReceipt order={selectedOrder} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <label className="text-gray-700 font-semibold mr-4">Filter by Status:</label>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Orders</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <p className="text-lg">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Customer</th>
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Items</th>
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Amount</th>
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Status</th>
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Date</th>
                  <th className="text-center py-4 px-4 text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.id} className="border-b hover:bg-gray-50 transition">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold text-gray-900">{order.customerName}</p>
                        <p className="text-xs text-gray-600">{order.customerPhone}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-xs text-gray-600">{order.items.length} items</p>
                    </td>
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      ₦{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-4 px-4">
                      <select
                        value={order.status}
                        onChange={e => handleStatusChange(order.id, e.target.value)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                          order.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'pending'
                            ? 'bg-orange-100 text-orange-800'
                            : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedOrderId(order.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Receipt"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete Order"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
