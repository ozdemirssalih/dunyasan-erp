'use client'

import { useState } from 'react'
import PermissionGuard from '@/components/PermissionGuard'
import {
  BarChart3,
  FileText,
  CreditCard,
  Users,
  Wallet,
  Tag
} from 'lucide-react'

// Import tab components (will create these)
// import DashboardTab from './tabs/DashboardTab'
// import InvoicesTab from './tabs/InvoicesTab'
// import ChecksTab from './tabs/ChecksTab'
// import CurrentAccountsTab from './tabs/CurrentAccountsTab'
// import PaymentAccountsTab from './tabs/PaymentAccountsTab'
// import CategoriesTab from './tabs/CategoriesTab'

type TabType = 'dashboard' | 'invoices' | 'checks' | 'current-accounts' | 'payment-accounts' | 'categories'

export default function AccountingUnifiedPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart3 },
    { id: 'invoices' as TabType, label: 'Faturalar', icon: FileText },
    { id: 'checks' as TabType, label: 'Çekler', icon: CreditCard },
    { id: 'current-accounts' as TabType, label: 'Cari Hesaplar', icon: Users },
    { id: 'payment-accounts' as TabType, label: 'Kasa & Banka', icon: Wallet },
    { id: 'categories' as TabType, label: 'Kategoriler', icon: Tag },
  ]

  return (
    <PermissionGuard module="accounting" permission="view">
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">💰 Muhasebe Yönetimi</h1>
          <p className="text-gray-400">Tüm muhasebe işlemlerinizi buradan yönetin</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-800 rounded-lg p-2 mb-6 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800 rounded-lg p-6">
          {activeTab === 'dashboard' && (
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-4">📊 Dashboard</h2>
              <p className="text-gray-400">Dashboard içeriği buraya gelecek...</p>
              {/* <DashboardTab /> */}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-4">🧾 Faturalar</h2>
              <p className="text-gray-400">Faturalar içeriği buraya gelecek...</p>
              {/* <InvoicesTab /> */}
            </div>
          )}

          {activeTab === 'checks' && (
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-4">💳 Çek Yönetimi</h2>
              <p className="text-gray-400">Çekler içeriği buraya gelecek...</p>
              {/* <ChecksTab /> */}
            </div>
          )}

          {activeTab === 'current-accounts' && (
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-4">👥 Cari Hesaplar</h2>
              <p className="text-gray-400">Cari hesaplar içeriği buraya gelecek...</p>
              {/* <CurrentAccountsTab /> */}
            </div>
          )}

          {activeTab === 'payment-accounts' && (
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-4">🏦 Kasa & Banka</h2>
              <p className="text-gray-400">Kasa/Banka içeriği buraya gelecek...</p>
              {/* <PaymentAccountsTab /> */}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-4">🏷️ Kategoriler</h2>
              <p className="text-gray-400">Kategoriler içeriği buraya gelecek...</p>
              {/* <CategoriesTab /> */}
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  )
}
