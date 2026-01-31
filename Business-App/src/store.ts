import { create } from 'zustand';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryAddress: string;
  createdAt: Date;
  notes: string;
}

interface BusinessStore {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrder: (id: string, order: Partial<Order>) => void;
  deleteOrder: (id: string) => void;
  getTotalSales: () => number;
  getTotalOrders: () => number;
  getPendingOrders: () => Order[];
}

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  orders: [
    {
      id: '1',
      customerName: 'John Doe',
      customerPhone: '+234 123 456 7890',
      items: [
        { id: '1', name: 'Product A', quantity: 2, price: 5000 },
        { id: '2', name: 'Product B', quantity: 1, price: 3000 },
      ],
      totalAmount: 13000,
      status: 'delivered',
      deliveryAddress: '123 Main St, Lagos',
      createdAt: new Date(Date.now() - 86400000),
      notes: 'Delivered successfully',
    },
  ],
  
  addOrder: (order: Order) =>
    set(state => ({
      orders: [order, ...state.orders],
    })),

  updateOrder: (id: string, updatedOrder: Partial<Order>) =>
    set(state => ({
      orders: state.orders.map(order =>
        order.id === id ? { ...order, ...updatedOrder } : order
      ),
    })),

  deleteOrder: (id: string) =>
    set(state => ({
      orders: state.orders.filter(order => order.id !== id),
    })),

  getTotalSales: () => {
    const state = get();
    return state.orders
      .filter(order => order.status !== 'cancelled')
      .reduce((sum, order) => sum + order.totalAmount, 0);
  },

  getTotalOrders: () => {
    const state = get();
    return state.orders.filter(order => order.status !== 'cancelled').length;
  },

  getPendingOrders: () => {
    const state = get();
    return state.orders.filter(order => order.status === 'pending');
  },
}));
