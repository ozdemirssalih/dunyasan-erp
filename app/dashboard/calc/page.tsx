'use client'

import { useState, useEffect } from 'react'
import { Wallet, TrendingUp, TrendingDown, Percent, Plus, Trash2, Calculator, Clock, ArrowDown, ArrowUp } from 'lucide-react'

interface Entry {
  id: string
  date: string
  time: string
  deposit: number
  withdrawal: number
  commission: number
  balanceAfter: number
  totalCommission: number
}

export default function CalcPage() {
  const [initialBalance, setInitialBalance] = useState('')
  const [commissionRate, setCommissionRate] = useState('3')
  const [entries, setEntries] = useState<Entry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ deposit: '', withdrawal: '' })
  const [isSetup, setIsSetup] = useState(false)

  // LocalStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem('calc_data')
    if (saved) {
      const data = JSON.parse(saved)
      setInitialBalance(data.initialBalance || '')
      setCommissionRate(data.commissionRate || '3')
      setEntries(data.entries || [])
      setIsSetup(data.isSetup || false)
    }
  }, [])

  // LocalStorage'a kaydet
  const saveData = (newEntries: Entry[], init?: string, rate?: string, setup?: boolean) => {
    const data = {
      initialBalance: init ?? initialBalance,
      commissionRate: rate ?? commissionRate,
      entries: newEntries,
      isSetup: setup ?? isSetup,
    }
    localStorage.setItem('calc_data', JSON.stringify(data))
  }

  const handleSetup = () => {
    if (!initialBalance || parseFloat(initialBalance) < 0) return alert('Ana kasa tutarı girin!')
    setIsSetup(true)
    saveData([], initialBalance, commissionRate, true)
  }

  const handleAddEntry = () => {
    const deposit = parseFloat(formData.deposit) || 0
    const withdrawal = parseFloat(formData.withdrawal) || 0

    if (deposit === 0 && withdrawal === 0) return alert('Yatırım veya çekim tutarı girin!')

    const commission = deposit * (parseFloat(commissionRate) / 100)
    const lastBalance = entries.length > 0 ? entries[entries.length - 1].balanceAfter : parseFloat(initialBalance)
    const lastCommission = entries.length > 0 ? entries[entries.length - 1].totalCommission : 0
    const balanceAfter = lastBalance + deposit - withdrawal
    const totalCommission = lastCommission + commission

    const now = new Date()
    const newEntry: Entry = {
      id: Date.now().toString(),
      date: now.toLocaleDateString('tr-TR'),
      time: now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      deposit,
      withdrawal,
      commission,
      balanceAfter,
      totalCommission,
    }

    const newEntries = [...entries, newEntry]
    setEntries(newEntries)
    saveData(newEntries)
    setFormData({ deposit: '', withdrawal: '' })
    setShowForm(false)
  }

  const handleDeleteEntry = (id: string) => {
    if (!confirm('Bu kaydı silmek istediğinizden emin misiniz? Sonraki kayıtlar yeniden hesaplanacak.')) return

    const idx = entries.findIndex(e => e.id === id)
    if (idx === -1) return

    const remaining = entries.filter(e => e.id !== id)
    // Yeniden hesapla
    let balance = parseFloat(initialBalance)
    let totalComm = 0
    const recalculated = remaining.map(e => {
      const comm = e.deposit * (parseFloat(commissionRate) / 100)
      balance = balance + e.deposit - e.withdrawal
      totalComm += comm
      return { ...e, commission: comm, balanceAfter: balance, totalCommission: totalComm }
    })

    setEntries(recalculated)
    saveData(recalculated)
  }

  const handleReset = () => {
    if (!confirm('Tüm verileri sıfırlamak istediğinizden emin misiniz?')) return
    setEntries([])
    setInitialBalance('')
    setIsSetup(false)
    setCommissionRate('3')
    localStorage.removeItem('calc_data')
  }

  // Hesaplamalar
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].balanceAfter : parseFloat(initialBalance) || 0
  const totalDeposits = entries.reduce((s, e) => s + e.deposit, 0)
  const totalWithdrawals = entries.reduce((s, e) => s + e.withdrawal, 0)
  const totalCommission = entries.length > 0 ? entries[entries.length - 1].totalCommission : 0
  const entryCount = entries.length

  // Son 12 saat kontrolü
  const lastEntry = entries[entries.length - 1]
  const hoursSinceLastEntry = lastEntry
    ? (Date.now() - parseInt(lastEntry.id)) / (1000 * 60 * 60)
    : 999
  const needsEntry = hoursSinceLastEntry >= 12

  const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Tarih bazlı gruplama
  const groupedByDate: Record<string, Entry[]> = {}
  entries.forEach(e => {
    if (!groupedByDate[e.date]) groupedByDate[e.date] = []
    groupedByDate[e.date].push(e)
  })

  if (!isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <Calculator className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-gray-800">Kasa Hesaplama</h1>
            <p className="text-sm text-gray-500 mt-1">Başlangıç değerlerini girin</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ana Kasa Tutarı (₺)</label>
              <input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)}
                placeholder="0.00" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Komisyon Oranı (%)</label>
              <input type="number" step="0.1" value={commissionRate} onChange={e => setCommissionRate(e.target.value)}
                placeholder="3" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <button onClick={handleSetup} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors">
              Başla
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="w-7 h-7 text-blue-600" /> Kasa Hesaplama
          </h2>
          <p className="text-sm text-gray-500">Komisyon: %{commissionRate} • Başlangıç: ₺{fmt(parseFloat(initialBalance))}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
            <Plus className="w-4 h-4" /> Yeni Kayıt
          </button>
          <button onClick={handleReset} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm">
            Sıfırla
          </button>
        </div>
      </div>

      {/* 12 saat uyarısı */}
      {needsEntry && entries.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <Clock className="w-6 h-6 text-orange-600" />
          <div>
            <p className="font-bold text-orange-800">12 saat geçti — Yeni veri girişi gerekiyor!</p>
            <p className="text-sm text-orange-600">Son kayıt: {lastEntry?.date} {lastEntry?.time}</p>
          </div>
          <button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }}
            className="ml-auto px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold">
            Veri Gir
          </button>
        </div>
      )}

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">ANA KASA</span>
          </div>
          <div className="text-3xl font-bold font-mono">₺{fmt(currentBalance)}</div>
          <p className="text-blue-100 text-xs mt-1">Güncel bakiye</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">YATIRIM</span>
          </div>
          <div className="text-3xl font-bold font-mono">₺{fmt(totalDeposits)}</div>
          <p className="text-green-100 text-xs mt-1">{entries.filter(e => e.deposit > 0).length} yatırım</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">ÇEKİM</span>
          </div>
          <div className="text-3xl font-bold font-mono">₺{fmt(totalWithdrawals)}</div>
          <p className="text-red-100 text-xs mt-1">{entries.filter(e => e.withdrawal > 0).length} çekim</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Percent className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">KOMİSYON</span>
          </div>
          <div className="text-3xl font-bold font-mono">₺{fmt(totalCommission)}</div>
          <p className="text-purple-100 text-xs mt-1">%{commissionRate} komisyon</p>
        </div>
      </div>

      {/* Tarih Bazlı Kayıtlar */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-bold text-gray-800">Kayıt Geçmişi ({entryCount} kayıt)</h3>
        </div>

        {Object.keys(groupedByDate).length > 0 ? (
          <div>
            {Object.entries(groupedByDate).reverse().map(([date, dayEntries]) => {
              const dayDeposits = dayEntries.reduce((s, e) => s + e.deposit, 0)
              const dayWithdrawals = dayEntries.reduce((s, e) => s + e.withdrawal, 0)
              const dayCommission = dayEntries.reduce((s, e) => s + e.commission, 0)
              return (
                <div key={date} className="border-b last:border-0">
                  {/* Tarih Başlık */}
                  <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                    <span className="font-bold text-gray-700 text-sm">{date}</span>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-600 font-semibold flex items-center gap-1"><ArrowDown className="w-3 h-3" />₺{fmt(dayDeposits)}</span>
                      <span className="text-red-600 font-semibold flex items-center gap-1"><ArrowUp className="w-3 h-3" />₺{fmt(dayWithdrawals)}</span>
                      <span className="text-purple-600 font-semibold">%₺{fmt(dayCommission)}</span>
                    </div>
                  </div>
                  {/* Kayıtlar */}
                  {dayEntries.map(entry => (
                    <div key={entry.id} className="px-5 py-3 flex items-center justify-between hover:bg-blue-50/30 border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400 font-mono w-14">{entry.time}</span>
                        {entry.deposit > 0 && (
                          <span className="flex items-center gap-1 text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                            <ArrowDown className="w-3 h-3" /> +₺{fmt(entry.deposit)}
                          </span>
                        )}
                        {entry.withdrawal > 0 && (
                          <span className="flex items-center gap-1 text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                            <ArrowUp className="w-3 h-3" /> -₺{fmt(entry.withdrawal)}
                          </span>
                        )}
                        {entry.commission > 0 && (
                          <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-semibold">
                            Kom: ₺{fmt(entry.commission)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-gray-800">₺{fmt(entry.balanceAfter)}</div>
                          <div className="text-[10px] text-gray-400">Kasa bakiye</div>
                        </div>
                        <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Henüz kayıt yok</p>
            <p className="text-sm mt-1">Yeni kayıt ekleyerek başlayın</p>
          </div>
        )}
      </div>

      {/* Yeni Kayıt Modalı */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Yeni Kayıt</h3>
            <p className="text-sm text-gray-500 mb-4">12 saatlik dönem verilerini girin</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-green-600" /> Yatırım Miktarı (₺)
                </label>
                <input type="number" step="0.01" value={formData.deposit} onChange={e => setFormData({ ...formData, deposit: e.target.value })}
                  placeholder="0.00" className="w-full px-4 py-3 border-2 border-green-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                {formData.deposit && parseFloat(formData.deposit) > 0 && (
                  <p className="text-xs text-purple-600 mt-1 font-semibold">
                    Komisyon: ₺{fmt(parseFloat(formData.deposit) * parseFloat(commissionRate) / 100)} (%{commissionRate})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-red-600" /> Çekim Miktarı (₺)
                </label>
                <input type="number" step="0.01" value={formData.withdrawal} onChange={e => setFormData({ ...formData, withdrawal: e.target.value })}
                  placeholder="0.00" className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500" />
              </div>

              {/* Önizleme */}
              {(formData.deposit || formData.withdrawal) && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mevcut bakiye:</span>
                    <span className="font-mono font-bold">₺{fmt(currentBalance)}</span>
                  </div>
                  {formData.deposit && parseFloat(formData.deposit) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Yatırım:</span>
                      <span className="font-mono font-bold">+₺{fmt(parseFloat(formData.deposit))}</span>
                    </div>
                  )}
                  {formData.withdrawal && parseFloat(formData.withdrawal) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Çekim:</span>
                      <span className="font-mono font-bold">-₺{fmt(parseFloat(formData.withdrawal))}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-bold text-blue-700">
                    <span>Yeni bakiye:</span>
                    <span className="font-mono">₺{fmt(currentBalance + (parseFloat(formData.deposit) || 0) - (parseFloat(formData.withdrawal) || 0))}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold">İptal</button>
                <button onClick={handleAddEntry} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
