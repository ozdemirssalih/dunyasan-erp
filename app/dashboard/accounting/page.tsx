'use client'

import { useState } from 'react'
import PermissionGuard from '@/components/PermissionGuard'
import { BarChart3, FileText, CreditCard, Users, Wallet, Tag } from 'lucide-react'

type TabType = 'dashboard' | 'invoices' | 'checks' | 'current-accounts' | 'payment-accounts' | 'categories'

export default function AccountingPage() {
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
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-4">📊 Dashboard</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-6">
                  <div className="text-sm text-green-400 mb-2">Toplam Gelir</div>
                  <div className="text-3xl font-bold text-white">0,00 ₺</div>
                </div>
                <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-lg p-6">
                  <div className="text-sm text-red-400 mb-2">Toplam Gider</div>
                  <div className="text-3xl font-bold text-white">0,00 ₺</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-6">
                  <div className="text-sm text-blue-400 mb-2">Net Kar/Zarar</div>
                  <div className="text-3xl font-bold text-white">0,00 ₺</div>
                </div>
              </div>
              <p className="text-gray-400 text-center py-8">Muhasebe işlemleri eklendiğinde istatistikler burada görünecek</p>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="text-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">🧾 Faturalar</h2>
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
                  + Yeni Fatura
                </button>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-8 text-center">
                <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Henüz fatura bulunmuyor</p>
                <p className="text-sm text-gray-500 mt-2">Yukarıdaki butona tıklayarak fatura ekleyebilirsiniz</p>
              </div>
            </div>
          )}

          {/* Checks Tab */}
          {activeTab === 'checks' && (
            <div className="text-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">💳 Çek Yönetimi</h2>
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
                  + Yeni Çek
                </button>
              </div>
              <div className="flex gap-4 mb-6">
                <button className="flex-1 py-3 px-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 font-medium">
                  Alınan Çekler
                </button>
                <button className="flex-1 py-3 px-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-medium">
                  Verilen Çekler
                </button>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-8 text-center">
                <CreditCard className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Henüz çek kaydı bulunmuyor</p>
              </div>
            </div>
          )}

          {/* Current Accounts Tab */}
          {activeTab === 'current-accounts' && (
            <div className="text-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">👥 Cari Hesaplar</h2>
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
                  + Yeni Cari Hesap
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="text-sm text-green-400 mb-1">Toplam Alacak</div>
                  <div className="text-2xl font-bold text-white">0,00 ₺</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="text-sm text-red-400 mb-1">Toplam Borç</div>
                  <div className="text-2xl font-bold text-white">0,00 ₺</div>
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-8 text-center">
                <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Henüz cari hesap bulunmuyor</p>
              </div>
            </div>
          )}

          {/* Payment Accounts Tab */}
          {activeTab === 'payment-accounts' && (
            <div className="text-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">🏦 Kasa & Banka</h2>
                <div className="flex gap-2">
                  <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">
                    Transfer
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
                    + Yeni Hesap
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="text-sm text-green-400 mb-1">Kasa Bakiyesi</div>
                  <div className="text-2xl font-bold text-white">0,00 ₺</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="text-sm text-blue-400 mb-1">Banka Bakiyesi</div>
                  <div className="text-2xl font-bold text-white">0,00 ₺</div>
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-8 text-center">
                <Wallet className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Henüz kasa/banka hesabı bulunmuyor</p>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="text-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">🏷️ Kategoriler</h2>
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
                  + Yeni Kategori
                </button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3">💰 Gelir Kategorileri</h3>
                  <div className="bg-gray-700/50 rounded-lg p-6 text-center">
                    <p className="text-gray-400 text-sm">Kategori bulunmuyor</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-400 mb-3">💸 Gider Kategorileri</h3>
                  <div className="bg-gray-700/50 rounded-lg p-6 text-center">
                    <p className="text-gray-400 text-sm">Kategori bulunmuyor</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-400 text-sm">
            ℹ️ <strong>Not:</strong> Tam işlevsellik için Supabase'de <code className="bg-black/30 px-2 py-1 rounded">FULL-ACCOUNTING-SYSTEM-FIXED.sql</code> dosyasını çalıştırın.
          </p>
        </div>
      </div>
    </PermissionGuard>
  )
}
