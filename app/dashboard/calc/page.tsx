'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Wallet, TrendingUp, TrendingDown, Percent, Plus, Trash2, Calculator, Clock, ArrowDown, ArrowUp } from 'lucide-react'

interface Entry {
  id: string
  deposit: number
  withdrawal: number
  commission: number
  balance_after: number
  total_commission: number
  created_at: string
}

export default function CalcPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialBalance, setInitialBalance] = useState('')
  const [commissionRate, setCommissionRate] = useState('3')
  const [entries, setEntries] = useState<Entry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ deposit: '', withdrawal: '' })
  const [isSetup, setIsSetup] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      // Settings yükle
      const { data: settings } = await supabase.from('calc_settings').select('*').eq('company_id', profile.company_id).maybeSingle()
      if (settings) {
        setInitialBalance(settings.initial_balance.toString())
        setCommissionRate(settings.commission_rate.toString())
        setSettingsId(settings.id)
        setIsSetup(true)
      }

      // Entries yükle
      const { data: entriesData } = await supabase.from('calc_entries').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: true })
      setEntries(entriesData || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSetup = async () => {
    if (!initialBalance || !companyId) return alert('Ana kasa tutarı girin!')
    try {
      if (settingsId) {
        await supabase.from('calc_settings').update({ initial_balance: parseFloat(initialBalance), commission_rate: parseFloat(commissionRate), updated_at: new Date().toISOString() }).eq('id', settingsId)
      } else {
        const { data } = await supabase.from('calc_settings').insert({ company_id: companyId, initial_balance: parseFloat(initialBalance), commission_rate: parseFloat(commissionRate) }).select().single()
        setSettingsId(data.id)
      }
      setIsSetup(true)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleAddEntry = async () => {
    if (!companyId || !userId) return
    const deposit = parseFloat(formData.deposit) || 0
    const withdrawal = parseFloat(formData.withdrawal) || 0
    if (deposit === 0 && withdrawal === 0) return alert('Yatırım veya çekim tutarı girin!')

    const rate = parseFloat(commissionRate) / 100
    const commission = deposit * rate
    const lastBalance = entries.length > 0 ? entries[entries.length - 1].balance_after : parseFloat(initialBalance)
    const lastCommission = entries.length > 0 ? entries[entries.length - 1].total_commission : 0
    const balanceAfter = lastBalance + deposit - withdrawal
    const totalCommission = lastCommission + commission

    try {
      const { data, error } = await supabase.from('calc_entries').insert({
        company_id: companyId,
        deposit, withdrawal, commission,
        balance_after: balanceAfter,
        total_commission: totalCommission,
        created_by: userId,
      }).select().single()

      if (error) throw error
      setEntries([...entries, data])
      setFormData({ deposit: '', withdrawal: '' })
      setShowForm(false)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return
    try {
      await supabase.from('calc_entries').delete().eq('id', id)
      // Yeniden yükle ve hesapla
      const remaining = entries.filter(e => e.id !== id)
      let balance = parseFloat(initialBalance)
      let totalComm = 0
      const rate = parseFloat(commissionRate) / 100
      for (const e of remaining) {
        const comm = e.deposit * rate
        balance = balance + e.deposit - e.withdrawal
        totalComm += comm
        await supabase.from('calc_entries').update({ commission: comm, balance_after: balance, total_commission: totalComm }).eq('id', e.id)
        e.commission = comm
        e.balance_after = balance
        e.total_commission = totalComm
      }
      setEntries([...remaining])
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const handleReset = async () => {
    if (!confirm('TÜM verileri sıfırlamak istediğinizden emin misiniz?')) return
    try {
      if (companyId) {
        await supabase.from('calc_entries').delete().eq('company_id', companyId)
        await supabase.from('calc_settings').delete().eq('company_id', companyId)
      }
      setEntries([])
      setInitialBalance('')
      setCommissionRate('3')
      setIsSetup(false)
      setSettingsId(null)
    } catch (err: any) { alert('Hata: ' + err.message) }
  }

  const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance_after : parseFloat(initialBalance) || 0
  const totalDeposits = entries.reduce((s, e) => s + e.deposit, 0)
  const totalWithdrawals = entries.reduce((s, e) => s + e.withdrawal, 0)
  const totalCommission = entries.length > 0 ? entries[entries.length - 1].total_commission : 0

  const lastEntry = entries[entries.length - 1]
  const hoursSinceLastEntry = lastEntry ? (Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60) : 999
  const needsEntry = isSetup && hoursSinceLastEntry >= 12

  const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const groupedByDate: Record<string, Entry[]> = {}
  entries.forEach(e => {
    const date = new Date(e.created_at).toLocaleDateString('tr-TR')
    if (!groupedByDate[date]) groupedByDate[date] = []
    groupedByDate[date].push(e)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>

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
                placeholder="0.00" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Komisyon Oranı (%)</label>
              <input type="number" step="0.1" value={commissionRate} onChange={e => setCommissionRate(e.target.value)}
                placeholder="3" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleSetup} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg">Başla</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Calculator className="w-7 h-7 text-blue-600" /> Kasa Hesaplama</h2>
          <p className="text-sm text-gray-500">Komisyon: %{commissionRate} • Başlangıç: ₺{fmt(parseFloat(initialBalance))}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
            <Plus className="w-4 h-4" /> Yeni Kayıt
          </button>
          <button onClick={handleReset} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm">Sıfırla</button>
        </div>
      </div>

      {needsEntry && entries.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <Clock className="w-6 h-6 text-orange-600" />
          <div>
            <p className="font-bold text-orange-800">12 saat geçti — Yeni veri girişi gerekiyor!</p>
            <p className="text-sm text-orange-600">Son kayıt: {new Date(lastEntry.created_at).toLocaleString('tr-TR')}</p>
          </div>
          <button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }}
            className="ml-auto px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold">Veri Gir</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2"><Wallet className="w-8 h-8 opacity-80" /><span className="text-xs bg-white/20 px-2 py-1 rounded-full">ANA KASA</span></div>
          <div className="text-3xl font-bold font-mono">₺{fmt(currentBalance)}</div>
          <p className="text-blue-100 text-xs mt-1">Güncel bakiye</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2"><TrendingUp className="w-8 h-8 opacity-80" /><span className="text-xs bg-white/20 px-2 py-1 rounded-full">YATIRIM</span></div>
          <div className="text-3xl font-bold font-mono">₺{fmt(totalDeposits)}</div>
          <p className="text-green-100 text-xs mt-1">{entries.filter(e => e.deposit > 0).length} yatırım</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2"><TrendingDown className="w-8 h-8 opacity-80" /><span className="text-xs bg-white/20 px-2 py-1 rounded-full">ÇEKİM</span></div>
          <div className="text-3xl font-bold font-mono">₺{fmt(totalWithdrawals)}</div>
          <p className="text-red-100 text-xs mt-1">{entries.filter(e => e.withdrawal > 0).length} çekim</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2"><Percent className="w-8 h-8 opacity-80" /><span className="text-xs bg-white/20 px-2 py-1 rounded-full">KOMİSYON</span></div>
          <div className="text-3xl font-bold font-mono">₺{fmt(totalCommission)}</div>
          <p className="text-purple-100 text-xs mt-1">%{commissionRate} komisyon</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-5 border-b"><h3 className="font-bold text-gray-800">Kayıt Geçmişi ({entries.length} kayıt)</h3></div>
        {Object.keys(groupedByDate).length > 0 ? (
          <div>
            {Object.entries(groupedByDate).reverse().map(([date, dayEntries]) => {
              const dayD = dayEntries.reduce((s, e) => s + e.deposit, 0)
              const dayW = dayEntries.reduce((s, e) => s + e.withdrawal, 0)
              const dayC = dayEntries.reduce((s, e) => s + e.commission, 0)
              return (
                <div key={date} className="border-b last:border-0">
                  <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                    <span className="font-bold text-gray-700 text-sm">{date}</span>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-600 font-semibold flex items-center gap-1"><ArrowDown className="w-3 h-3" />₺{fmt(dayD)}</span>
                      <span className="text-red-600 font-semibold flex items-center gap-1"><ArrowUp className="w-3 h-3" />₺{fmt(dayW)}</span>
                      <span className="text-purple-600 font-semibold">Kom: ₺{fmt(dayC)}</span>
                    </div>
                  </div>
                  {dayEntries.map(entry => (
                    <div key={entry.id} className="px-5 py-3 flex items-center justify-between hover:bg-blue-50/30 border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400 font-mono w-14">{new Date(entry.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {entry.deposit > 0 && <span className="flex items-center gap-1 text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full"><ArrowDown className="w-3 h-3" />+₺{fmt(entry.deposit)}</span>}
                        {entry.withdrawal > 0 && <span className="flex items-center gap-1 text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full"><ArrowUp className="w-3 h-3" />-₺{fmt(entry.withdrawal)}</span>}
                        {entry.commission > 0 && <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-semibold">Kom: ₺{fmt(entry.commission)}</span>}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-gray-800">₺{fmt(entry.balance_after)}</div>
                          <div className="text-[10px] text-gray-400">Kasa bakiye</div>
                        </div>
                        <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
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
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Yeni Kayıt</h3>
            <p className="text-sm text-gray-500 mb-4">12 saatlik dönem verilerini girin</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><ArrowDown className="w-4 h-4 text-green-600" /> Yatırım Miktarı (₺)</label>
                <input type="number" step="0.01" value={formData.deposit} onChange={e => setFormData({ ...formData, deposit: e.target.value })}
                  placeholder="0.00" className="w-full px-4 py-3 border-2 border-green-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-green-500" />
                {formData.deposit && parseFloat(formData.deposit) > 0 && (
                  <p className="text-xs text-purple-600 mt-1 font-semibold">Komisyon: ₺{fmt(parseFloat(formData.deposit) * parseFloat(commissionRate) / 100)} (%{commissionRate})</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><ArrowUp className="w-4 h-4 text-red-600" /> Çekim Miktarı (₺)</label>
                <input type="number" step="0.01" value={formData.withdrawal} onChange={e => setFormData({ ...formData, withdrawal: e.target.value })}
                  placeholder="0.00" className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-lg font-mono focus:ring-2 focus:ring-red-500" />
              </div>
              {(formData.deposit || formData.withdrawal) && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Mevcut bakiye:</span><span className="font-mono font-bold">₺{fmt(currentBalance)}</span></div>
                  {formData.deposit && parseFloat(formData.deposit) > 0 && <div className="flex justify-between text-green-600"><span>Yatırım:</span><span className="font-mono font-bold">+₺{fmt(parseFloat(formData.deposit))}</span></div>}
                  {formData.withdrawal && parseFloat(formData.withdrawal) > 0 && <div className="flex justify-between text-red-600"><span>Çekim:</span><span className="font-mono font-bold">-₺{fmt(parseFloat(formData.withdrawal))}</span></div>}
                  <div className="flex justify-between border-t pt-2 font-bold text-blue-700"><span>Yeni bakiye:</span><span className="font-mono">₺{fmt(currentBalance + (parseFloat(formData.deposit) || 0) - (parseFloat(formData.withdrawal) || 0))}</span></div>
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
