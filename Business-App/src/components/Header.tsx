import React from 'react';
import { Package, Settings } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold">Business Manager</h1>
            <p className="text-blue-100">Track orders, sales, and profits</p>
          </div>
        </div>
        <button className="p-2 hover:bg-blue-700 rounded-lg transition">
          <Settings className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
