import React from 'react';
import { useBusinessStore } from '../store';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { orders } = useBusinessStore();

  const totalSales = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, order) => sum + order.totalAmount, 0);

  const totalExpenses = 0; // To be added by user
  const profit = totalSales - totalExpenses;
  const profitMargin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(2) : '0.00';

  const ordersByStatus = {
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm uppercase tracking-wide">Total Revenue</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">₦{totalSales.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-100" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm uppercase tracking-wide">Total Profit</p>
              <p className="text-3xl font-bold text-green-600 mt-2">₦{profit.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Margin: {profitMargin}%</p>
            </div>
            <PieChart className="w-12 h-12 text-green-100" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm uppercase tracking-wide">Conversion Rate</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {orders.length > 0 
                  ? ((ordersByStatus.delivered / orders.length) * 100).toFixed(1)
                  : '0'}%
              </p>
              <p className="text-xs text-gray-500 mt-1">{ordersByStatus.delivered} delivered</p>
            </div>
            <BarChart3 className="w-12 h-12 text-orange-100" />
          </div>
        </div>
      </div>

      {/* Order Status Overview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Status Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(ordersByStatus).map(([status, count]) => (
            <div key={status} className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg">
              <p className="text-gray-600 text-sm capitalize">{status.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-gray-700 font-semibold">Customer</th>
                <th className="text-left py-3 px-4 text-gray-700 font-semibold">Amount</th>
                <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                <th className="text-left py-3 px-4 text-gray-700 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr key={order.id} className="border-b hover:bg-gray-50 transition">
                  <td className="py-3 px-4 text-gray-900">{order.customerName}</td>
                  <td className="py-3 px-4 text-gray-900 font-semibold">₦{order.totalAmount.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      order.status === 'delivered'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'pending'
                        ? 'bg-orange-100 text-orange-800'
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
