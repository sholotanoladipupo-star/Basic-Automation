import React, { useState } from 'react';
import { ShoppingBag, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { useBusinessStore } from './store';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import OrderList from './components/OrderList';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-order' | 'orders'>('dashboard');
  const { orders, getTotalSales } = useBusinessStore();

  const stats = {
    totalSales: getTotalSales(),
    totalOrders: orders.filter(o => o.status !== 'cancelled').length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    deliveredOrders: orders.filter(o => o.status === 'delivered').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Quick Stats */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Sales</p>
                  <p className="text-2xl font-bold text-blue-600">₦{stats.totalSales.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Orders</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalOrders}</p>
                </div>
                <ShoppingBag className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Pending Orders</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.pendingOrders}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-600 opacity-50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Delivered</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.deliveredOrders}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-4 font-semibold border-b-2 transition ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('new-order')}
              className={`px-4 py-4 font-semibold border-b-2 transition ${
                activeTab === 'new-order'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              New Order
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-4 font-semibold border-b-2 transition ${
                activeTab === 'orders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              All Orders
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'new-order' && <OrderForm />}
        {activeTab === 'orders' && <OrderList />}
      </main>
    </div>
  );
}
