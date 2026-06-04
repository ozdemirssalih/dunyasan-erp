'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import PermissionGuard from '@/components/PermissionGuard'
import { Wallet, Plus, Trash2, ArrowLeft, Filter, DollarSign, CheckCircle, XCircle } from 'lucide-react'

interface Employee {
  id: string
  full_name: string
  employee_code: string
}

interface CashAccount {
  id: string
  account_name: string
  currency: string
}

interface Advance {
  id: string
  employee_id: string
  advance_date: string
  amount: number
  installments: number
  paid_amount: number
  remaining_amount: number
  status: string
  payment_method?: string
  cash_account_id?: string
  cash_transaction_id?: string
  notes?: string
  created_at: string
  employee?: Employee
  cash_account?: { account_name: string }
}

const fmt = (n: number) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    {children}
  </div>
)

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterEmployee, setFilterEmployee] = useState<string>('all')

  const [form, setForm] = useState({
    employee_id: '',
    advance_date: new Date().toISOString().split('T')[0],
    amount: '',
    installments: '1',
    payment_method: 'cash',
    cash_account_id: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const [empRes, advRes, caRes] = await Promise.all([
        supabase.from('employees').select('id, full_name, employee_code').eq('company_id', profile.company_id).eq('status', 'active').order('full_name'),
        supabase.from('salary_advances').select('*, employee:employees(id, full_name, employee_code), cash_account:cash_accounts(account_name)').eq('company_id', profile.company_id).order('advance_date', { ascending: false }),
        supabase.from('cash_accounts').select('id, account_name, currency').eq('company_id', profile.company_id).eq('is_active', true).eq('currency', 'TRY').order('account_name')
      ])

      setEmployees(empRes.data || [])
      setAdvances(advRes.data || [])
      setCashAccounts(caRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.employee_id || !form.amount || !companyId) {
      alert('Personel ve tutar zorunlu!')
      return
    }
    const amount = parseFloat(form.amount)
    if (amount <= 0) { alert('Tutar 0 dan büyük olmalı'); return }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const emp = employees.find(e => e.id === form.employee_id)

      // 1. Önce kasa işlemi (gider - avans)
      let cashTxId: string | null = null
      if (form.cash_account_id) {
        const { data: cashTx, error: cashErr } = await supabase.from('cash_transactions').insert({
          company_id: companyId,
          cash_account_id: form.cash_account_id,
          transaction_date: form.advance_date,
          transaction_type: 'expense',
          amount: amount,
          payment_method: form.payment_method,
          description: `AVANS - ${emp?.full_name || ''}`,
          reference_no: `AVN-${Date.now()}`,
          created_by: user?.id
        }).select().single()

        if (cashErr) throw cashErr
        cashTxId = cashTx?.id || null

        // Kasa bakiyesini güncelle
        const ca = cashAccounts.find(c => c.id === form.cash_account_id)
        if (ca) {
          const { data: caCur } = await supabase.from('cash_accounts').select('current_balance').eq('id', form.cash_account_id).single()
          if (caCur) {
            await supabase.from('cash_accounts').update({ current_balance: Number(caCur.current_balance) - amount }).eq('id', form.cash_account_id)
          }
        }
      }

      // 2. Avans kaydını oluştur
      const { error } = await supabase.from('salary_advances').insert({
        company_id: companyId,
        employee_id: form.employee_id,
        advance_date: form.advance_date,
        amount: amount,
        installments: parseInt(form.installments) || 1,
        paid_amount: 0,
        remaining_amount: amount,
        status: 'open',
        payment_method: form.payment_method,
        cash_account_id: form.cash_account_id || null,
        cash_transaction_id: cashTxId,
        notes: form.notes || null,
        created_by: user?.id
      })

      if (error) throw error
      alert('✅ Avans kaydedildi')
      setShowModal(false)
      setForm({ employee_id: '', advance_date: new Date().toISOString().split('T')[0], amount: '', installments: '1', payment_method: 'cash', cash_account_id: '', notes: '' })
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + (e?.message || 'bilinmeyen'))
    }
  }

  const handleClose = async (id: string) => {
    if (!confirm('Avansı kapatmak (tamamen ödendi olarak işaretle) istediğinizden emin misiniz?')) return
    try {
      const adv = advances.find(a => a.id === id)
      if (!adv) return
      const { error } = await supabase.from('salary_advances').update({
        status: 'paid',
        paid_amount: adv.amount,
        remaining_amount: 0
      }).eq('id', id)
      if (error) throw error
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + e?.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu avansı ve ilgili kasa işlemini silmek istediğinizden emin misiniz?')) return
    try {
      const adv = advances.find(a => a.id === id)
      // İlgili kasa işlemini ve bakiye iadesi
      if (adv?.cash_transaction_id) {
        const { data: tx } = await supabase.from('cash_transactions').select('cash_account_id, amount').eq('id', adv.cash_transaction_id).single()
        if (tx) {
          const { data: caCur } = await supabase.from('cash_accounts').select('current_balance').eq('id', tx.cash_account_id).single()
          if (caCur) {
            await supabase.from('cash_accounts').update({ current_balance: Number(caCur.current_balance) + Number(tx.amount) }).eq('id', tx.cash_account_id)
          }
          await supabase.from('cash_transactions').delete().eq('id', adv.cash_transaction_id)
        }
      }
      const { error } = await supabase.from('salary_advances').delete().eq('id', id)
      if (error) throw error
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + e?.message)
    }
  }

  // Filter
  const filtered = advances.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterEmployee !== 'all' && a.employee_id !== filterEmployee) return false
    return true
  })

  const totalOpen = advances.filter(a => a.status === 'open').reduce((s, a) => s + Number(a.remaining_amount || a.amount), 0)
  const totalPaid = advances.reduce((s, a) => s + Number(a.paid_amount || 0), 0)
  const openCount = advances.filter(a => a.status === 'open').length
  const paidCount = advances.filter(a => a.status === 'paid').length

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="text-gray-600">Yükleniyor...</div></div>
  }

  return (
    <PermissionGuard module="employees" permission="view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/hr" className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Avans Yönetimi</h2>
              <p className="text-gray-600">Personel avansları ve mahsuplama</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold shadow-lg">
            <Plus className="w-5 h-5" /> Yeni Avans
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Toplam Açık Avans" value={`${fmt(totalOpen)} ₺`} sub={`${openCount} adet`} color="orange" />
          <StatBox label="Toplam Mahsup Edilen" value={`${fmt(totalPaid)} ₺`} sub={`${paidCount} kapalı`} color="green" />
          <StatBox label="Toplam Avans Adedi" value={advances.length.toString()} sub="" color="blue" />
          <StatBox label="Bu Ay Verilen" value={`${fmt(advances.filter(a => {
            const d = new Date(a.advance_date)
            return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear()
          }).reduce((s, a) => s + Number(a.amount), 0))} ₺`} sub="" color="purple" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap items-center gap-3">
          <Filter className="w-5 h-5 text-gray-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls + ' max-w-xs'}>
            <option value="all">Tüm Durumlar</option>
            <option value="open">Açık</option>
            <option value="paid">Mahsup Edildi</option>
          </select>
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className={inputCls + ' max-w-xs'}>
            <option value="all">Tüm Personel</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Personel</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tarih</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Tutar</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Ödenen</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Kalan</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Kasa</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Durum</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Avans kaydı yok</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm text-gray-800">{a.employee?.full_name}</p>
                    <p className="text-xs text-gray-500">#{a.employee?.employee_code}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{new Date(a.advance_date).toLocaleDateString('tr-TR')}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-700">{fmt(Number(a.amount))} ₺</td>
                  <td className="px-4 py-3 text-right text-green-700">{fmt(Number(a.paid_amount || 0))} ₺</td>
                  <td className="px-4 py-3 text-right font-bold text-red-700">{fmt(Number(a.remaining_amount || a.amount))} ₺</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.cash_account?.account_name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {a.status === 'open' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                        <XCircle className="w-3 h-3" /> Açık
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Mahsup
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {a.status === 'open' && (
                        <button onClick={() => handleClose(a.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Kapat">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(a.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Sil">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Yeni Avans</h3>
              <div className="space-y-3">
                <Field label="Personel *">
                  <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className={inputCls}>
                    <option value="">Seçiniz</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} (#{e.employee_code})</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tarih *">
                    <input type="date" value={form.advance_date} onChange={e => setForm({ ...form, advance_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Tutar (₺) *">
                    <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputCls} placeholder="0.00" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ödeme Yöntemi">
                    <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className={inputCls}>
                      <option value="cash">Nakit</option>
                      <option value="transfer">Havale/EFT</option>
                      <option value="card">Kart</option>
                    </select>
                  </Field>
                  <Field label="Taksit Sayısı">
                    <input type="number" min="1" value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Kasa (Düşülecek)">
                  <select value={form.cash_account_id} onChange={e => setForm({ ...form, cash_account_id: e.target.value })} className={inputCls}>
                    <option value="">Seçiniz</option>
                    {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.account_name}</option>)}
                  </select>
                </Field>
                <Field label="Not">
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} rows={2} />
                </Field>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold">İptal</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold">Kaydet</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    orange: 'border-orange-500 text-orange-600',
    green: 'border-green-500 text-green-600',
    blue: 'border-blue-500 text-blue-600',
    purple: 'border-purple-500 text-purple-600',
  }
  return (
    <div className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${colors[color]}`}>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
