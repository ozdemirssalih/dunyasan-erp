'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import PermissionGuard from '@/components/PermissionGuard'
import { DollarSign, Plus, Trash2, ArrowLeft, Filter, FileText, Calendar, Zap } from 'lucide-react'

interface Employee {
  id: string
  full_name: string
  employee_code: string
  salary?: number
  department?: string
}

interface CashAccount {
  id: string
  account_name: string
  currency: string
}

interface Advance {
  id: string
  employee_id: string
  amount: number
  paid_amount: number
  remaining_amount: number
  status: string
}

interface SalaryPayment {
  id: string
  employee_id: string
  payment_date: string
  period_month: number
  period_year: number
  gross_salary: number
  advance_deduction: number
  other_deductions: number
  bonus: number
  overtime_amount: number
  net_amount: number
  payment_method?: string
  status: string
  notes?: string
  cash_account_id?: string
  employee?: Employee
  cash_account?: { account_name: string }
}

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const fmt = (n: number) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    {children}
  </div>
)

export default function SalariesPage() {
  const [payments, setPayments] = useState<SalaryPayment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [openAdvances, setOpenAdvances] = useState<Advance[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString())

  const [form, setForm] = useState({
    employee_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    period_month: (new Date().getMonth() + 1).toString(),
    period_year: new Date().getFullYear().toString(),
    gross_salary: '',
    advance_deduction: '0',
    other_deductions: '0',
    bonus: '0',
    overtime_amount: '0',
    payment_method: 'transfer',
    cash_account_id: '',
    notes: ''
  })

  const [bulkForm, setBulkForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    period_month: (new Date().getMonth() + 1).toString(),
    period_year: new Date().getFullYear().toString(),
    payment_method: 'transfer',
    cash_account_id: ''
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

      const [empRes, payRes, advRes, caRes] = await Promise.all([
        supabase.from('employees').select('id, full_name, employee_code, salary, department').eq('company_id', profile.company_id).eq('status', 'active').order('full_name'),
        supabase.from('salary_payments').select('*, employee:employees(id, full_name, employee_code, department), cash_account:cash_accounts(account_name)').eq('company_id', profile.company_id).order('payment_date', { ascending: false }),
        supabase.from('salary_advances').select('id, employee_id, amount, paid_amount, remaining_amount, status').eq('company_id', profile.company_id).eq('status', 'open'),
        supabase.from('cash_accounts').select('id, account_name, currency').eq('company_id', profile.company_id).eq('is_active', true).eq('currency', 'TRY').order('account_name')
      ])

      setEmployees(empRes.data || [])
      setPayments(payRes.data || [])
      setOpenAdvances(advRes.data || [])
      setCashAccounts(caRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Personelin açık avansı (toplam)
  const getEmployeeOpenAdvance = (empId: string) => {
    return openAdvances
      .filter(a => a.employee_id === empId)
      .reduce((s, a) => s + Number(a.remaining_amount || a.amount), 0)
  }

  // Net hesapla
  const calcNet = () => {
    const gross = parseFloat(form.gross_salary) || 0
    const advDed = parseFloat(form.advance_deduction) || 0
    const othDed = parseFloat(form.other_deductions) || 0
    const bonus = parseFloat(form.bonus) || 0
    const overtime = parseFloat(form.overtime_amount) || 0
    return gross - advDed - othDed + bonus + overtime
  }

  const handleSelectEmployee = (empId: string) => {
    const emp = employees.find(e => e.id === empId)
    const openAdv = getEmployeeOpenAdvance(empId)
    setForm({
      ...form,
      employee_id: empId,
      gross_salary: emp?.salary?.toString() || '',
      advance_deduction: openAdv.toString()
    })
  }

  const handleSave = async () => {
    if (!form.employee_id || !form.gross_salary || !companyId) {
      alert('Personel ve brüt maaş zorunlu!')
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const emp = employees.find(e => e.id === form.employee_id)
      const net = calcNet()
      const advDed = parseFloat(form.advance_deduction) || 0

      // 1. Kasa işlemi (gider - maaş)
      let cashTxId: string | null = null
      if (form.cash_account_id && net > 0) {
        const { data: cashTx, error: cashErr } = await supabase.from('cash_transactions').insert({
          company_id: companyId,
          cash_account_id: form.cash_account_id,
          transaction_date: form.payment_date,
          transaction_type: 'expense',
          amount: net,
          payment_method: form.payment_method,
          description: `MAAŞ ${MONTHS[parseInt(form.period_month) - 1]} ${form.period_year} - ${emp?.full_name || ''}`,
          reference_no: `MAAS-${Date.now()}`,
          created_by: user?.id
        }).select().single()

        if (cashErr) throw cashErr
        cashTxId = cashTx?.id || null

        const { data: caCur } = await supabase.from('cash_accounts').select('current_balance').eq('id', form.cash_account_id).single()
        if (caCur) {
          await supabase.from('cash_accounts').update({ current_balance: Number(caCur.current_balance) - net }).eq('id', form.cash_account_id)
        }
      }

      // 2. Maaş kaydı
      const { error } = await supabase.from('salary_payments').insert({
        company_id: companyId,
        employee_id: form.employee_id,
        payment_date: form.payment_date,
        period_month: parseInt(form.period_month),
        period_year: parseInt(form.period_year),
        gross_salary: parseFloat(form.gross_salary),
        advance_deduction: advDed,
        other_deductions: parseFloat(form.other_deductions) || 0,
        bonus: parseFloat(form.bonus) || 0,
        overtime_amount: parseFloat(form.overtime_amount) || 0,
        net_amount: net,
        payment_method: form.payment_method,
        cash_account_id: form.cash_account_id || null,
        cash_transaction_id: cashTxId,
        status: 'paid',
        notes: form.notes || null,
        created_by: user?.id
      })

      if (error) throw error

      // 3. Avansları mahsuplaştır
      if (advDed > 0) {
        let toDeduct = advDed
        const empAdvances = openAdvances.filter(a => a.employee_id === form.employee_id).sort((a, b) => Number(a.remaining_amount || a.amount) - Number(b.remaining_amount || b.amount))
        for (const adv of empAdvances) {
          if (toDeduct <= 0) break
          const remaining = Number(adv.remaining_amount || adv.amount)
          const pay = Math.min(toDeduct, remaining)
          const newPaid = Number(adv.paid_amount || 0) + pay
          const newRem = remaining - pay
          await supabase.from('salary_advances').update({
            paid_amount: newPaid,
            remaining_amount: newRem,
            status: newRem <= 0.01 ? 'paid' : 'open'
          }).eq('id', adv.id)
          toDeduct -= pay
        }
      }

      alert('✅ Maaş ödemesi kaydedildi')
      setShowModal(false)
      setForm({
        employee_id: '', payment_date: new Date().toISOString().split('T')[0],
        period_month: (new Date().getMonth() + 1).toString(), period_year: new Date().getFullYear().toString(),
        gross_salary: '', advance_deduction: '0', other_deductions: '0', bonus: '0', overtime_amount: '0',
        payment_method: 'transfer', cash_account_id: '', notes: ''
      })
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + (e?.message || 'bilinmeyen'))
    }
  }

  const handleBulkPay = async () => {
    if (!companyId || !confirm(`${employees.filter(e => e.salary && e.salary > 0).length} personel için toplu maaş ödemesi yapılacak. Onaylıyor musunuz?`)) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let count = 0
      let totalAmount = 0
      for (const emp of employees) {
        if (!emp.salary || emp.salary <= 0) continue

        // Bu dönem için zaten ödenmiş mi?
        const exists = payments.some(p =>
          p.employee_id === emp.id &&
          p.period_month === parseInt(bulkForm.period_month) &&
          p.period_year === parseInt(bulkForm.period_year)
        )
        if (exists) continue

        const advDed = getEmployeeOpenAdvance(emp.id)
        const net = Number(emp.salary) - advDed

        let cashTxId: string | null = null
        if (bulkForm.cash_account_id && net > 0) {
          const { data: cashTx } = await supabase.from('cash_transactions').insert({
            company_id: companyId,
            cash_account_id: bulkForm.cash_account_id,
            transaction_date: bulkForm.payment_date,
            transaction_type: 'expense',
            amount: net,
            payment_method: bulkForm.payment_method,
            description: `MAAŞ ${MONTHS[parseInt(bulkForm.period_month) - 1]} ${bulkForm.period_year} - ${emp.full_name}`,
            reference_no: `MAAS-${Date.now()}-${emp.employee_code}`,
            created_by: user?.id
          }).select().single()
          cashTxId = cashTx?.id || null
          totalAmount += net
        }

        await supabase.from('salary_payments').insert({
          company_id: companyId,
          employee_id: emp.id,
          payment_date: bulkForm.payment_date,
          period_month: parseInt(bulkForm.period_month),
          period_year: parseInt(bulkForm.period_year),
          gross_salary: Number(emp.salary),
          advance_deduction: advDed,
          other_deductions: 0,
          bonus: 0,
          overtime_amount: 0,
          net_amount: net,
          payment_method: bulkForm.payment_method,
          cash_account_id: bulkForm.cash_account_id || null,
          cash_transaction_id: cashTxId,
          status: 'paid',
          created_by: user?.id
        })

        // Avansları mahsuplaştır
        if (advDed > 0) {
          let toDeduct = advDed
          const empAdvances = openAdvances.filter(a => a.employee_id === emp.id)
          for (const adv of empAdvances) {
            if (toDeduct <= 0) break
            const remaining = Number(adv.remaining_amount || adv.amount)
            const pay = Math.min(toDeduct, remaining)
            const newPaid = Number(adv.paid_amount || 0) + pay
            const newRem = remaining - pay
            await supabase.from('salary_advances').update({
              paid_amount: newPaid,
              remaining_amount: newRem,
              status: newRem <= 0.01 ? 'paid' : 'open'
            }).eq('id', adv.id)
            toDeduct -= pay
          }
        }

        count++
      }

      // Kasa bakiyesi
      if (bulkForm.cash_account_id && totalAmount > 0) {
        const { data: caCur } = await supabase.from('cash_accounts').select('current_balance').eq('id', bulkForm.cash_account_id).single()
        if (caCur) {
          await supabase.from('cash_accounts').update({ current_balance: Number(caCur.current_balance) - totalAmount }).eq('id', bulkForm.cash_account_id)
        }
      }

      alert(`✅ ${count} personel için toplam ${fmt(totalAmount)} ₺ maaş ödendi`)
      setShowBulkModal(false)
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + e?.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu maaş ödemesini ve ilgili kasa işlemini silmek istediğinizden emin misiniz?')) return
    try {
      const p = payments.find(x => x.id === id) as any
      if (p?.cash_transaction_id) {
        const { data: tx } = await supabase.from('cash_transactions').select('cash_account_id, amount').eq('id', p.cash_transaction_id).single()
        if (tx) {
          const { data: caCur } = await supabase.from('cash_accounts').select('current_balance').eq('id', tx.cash_account_id).single()
          if (caCur) {
            await supabase.from('cash_accounts').update({ current_balance: Number(caCur.current_balance) + Number(tx.amount) }).eq('id', tx.cash_account_id)
          }
          await supabase.from('cash_transactions').delete().eq('id', p.cash_transaction_id)
        }
      }
      await supabase.from('salary_payments').delete().eq('id', id)
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + e?.message)
    }
  }

  const filtered = payments.filter(p => {
    if (filterMonth !== 'all' && p.period_month !== parseInt(filterMonth)) return false
    if (filterYear !== 'all' && p.period_year !== parseInt(filterYear)) return false
    return true
  })

  const totalGross = filtered.reduce((s, p) => s + Number(p.gross_salary), 0)
  const totalNet = filtered.reduce((s, p) => s + Number(p.net_amount), 0)
  const totalDeductions = filtered.reduce((s, p) => s + Number(p.advance_deduction || 0) + Number(p.other_deductions || 0), 0)
  const totalBonuses = filtered.reduce((s, p) => s + Number(p.bonus || 0) + Number(p.overtime_amount || 0), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="text-gray-600">Yükleniyor...</div></div>
  }

  const years = Array.from(new Set(payments.map(p => p.period_year))).sort((a, b) => b - a)
  if (years.length === 0) years.push(new Date().getFullYear())

  return (
    <PermissionGuard module="employees" permission="view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/hr" className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Maaş Yönetimi</h2>
              <p className="text-gray-600">Aylık maaş bordrosu ve ödemeler</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowBulkModal(true)} className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-lg">
              <Zap className="w-5 h-5" /> Toplu Ödeme
            </button>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-lg">
              <Plus className="w-5 h-5" /> Yeni Maaş
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Toplam Brüt" value={`${fmt(totalGross)} ₺`} color="blue" />
          <StatBox label="Toplam Net" value={`${fmt(totalNet)} ₺`} color="green" />
          <StatBox label="Kesintiler" value={`${fmt(totalDeductions)} ₺`} color="red" />
          <StatBox label="Prim + Mesai" value={`${fmt(totalBonuses)} ₺`} color="purple" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap items-center gap-3">
          <Filter className="w-5 h-5 text-gray-500" />
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={inputCls + ' max-w-xs'}>
            <option value="all">Tüm Yıllar</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={inputCls + ' max-w-xs'}>
            <option value="all">Tüm Aylar</option>
            {MONTHS.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-md overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase">Personel</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase">Dönem</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">Brüt</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">Prim</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">Mesai</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">Avans Mahsubu</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">Diğer Kesinti</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">NET</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tarih / Kasa</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-500">Maaş kaydı yok</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-sm text-gray-800">{p.employee?.full_name}</p>
                    <p className="text-xs text-gray-500">{p.employee?.department}</p>
                  </td>
                  <td className="px-3 py-3 text-sm">{MONTHS[p.period_month - 1]} {p.period_year}</td>
                  <td className="px-3 py-3 text-right text-sm">{fmt(Number(p.gross_salary))}</td>
                  <td className="px-3 py-3 text-right text-sm text-purple-600">{p.bonus > 0 ? '+' + fmt(Number(p.bonus)) : '-'}</td>
                  <td className="px-3 py-3 text-right text-sm text-purple-600">{p.overtime_amount > 0 ? '+' + fmt(Number(p.overtime_amount)) : '-'}</td>
                  <td className="px-3 py-3 text-right text-sm text-orange-600">{p.advance_deduction > 0 ? '-' + fmt(Number(p.advance_deduction)) : '-'}</td>
                  <td className="px-3 py-3 text-right text-sm text-red-600">{p.other_deductions > 0 ? '-' + fmt(Number(p.other_deductions)) : '-'}</td>
                  <td className="px-3 py-3 text-right font-bold text-green-700">{fmt(Number(p.net_amount))} ₺</td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    <p>{new Date(p.payment_date).toLocaleDateString('tr-TR')}</p>
                    <p className="text-gray-500">{p.cash_account?.account_name || '-'}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tek Kişi Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Yeni Maaş Ödemesi</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Personel *">
                  <select value={form.employee_id} onChange={e => handleSelectEmployee(e.target.value)} className={inputCls}>
                    <option value="">Seçiniz</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} (#{e.employee_code})</option>)}
                  </select>
                </Field>
                <Field label="Ödeme Tarihi *">
                  <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Dönem Ay *">
                  <select value={form.period_month} onChange={e => setForm({ ...form, period_month: e.target.value })} className={inputCls}>
                    {MONTHS.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Dönem Yıl *">
                  <input type="number" value={form.period_year} onChange={e => setForm({ ...form, period_year: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Brüt Maaş (₺) *">
                  <input type="number" step="0.01" value={form.gross_salary} onChange={e => setForm({ ...form, gross_salary: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Prim (₺)">
                  <input type="number" step="0.01" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Mesai (₺)">
                  <input type="number" step="0.01" value={form.overtime_amount} onChange={e => setForm({ ...form, overtime_amount: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Avans Mahsubu (₺)">
                  <input type="number" step="0.01" value={form.advance_deduction} onChange={e => setForm({ ...form, advance_deduction: e.target.value })} className={inputCls} />
                  {form.employee_id && getEmployeeOpenAdvance(form.employee_id) > 0 && (
                    <p className="text-xs text-orange-600 mt-1">Açık avans: {fmt(getEmployeeOpenAdvance(form.employee_id))} ₺</p>
                  )}
                </Field>
                <Field label="Diğer Kesinti (₺)">
                  <input type="number" step="0.01" value={form.other_deductions} onChange={e => setForm({ ...form, other_deductions: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Ödeme Yöntemi">
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className={inputCls}>
                    <option value="transfer">Havale/EFT</option>
                    <option value="cash">Nakit</option>
                    <option value="card">Kart</option>
                  </select>
                </Field>
                <Field label="Kasa">
                  <select value={form.cash_account_id} onChange={e => setForm({ ...form, cash_account_id: e.target.value })} className={inputCls}>
                    <option value="">Seçiniz</option>
                    {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.account_name}</option>)}
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="Not">
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} rows={2} />
                  </Field>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">NET ÖDENECEK:</span>
                  <span className="text-2xl font-bold text-green-700">{fmt(calcNet())} ₺</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold">İptal</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">Kaydet</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                <Zap className="w-6 h-6 text-blue-600" /> Toplu Maaş Ödemesi
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Seçilen dönem için maaşı tanımlı tüm aktif personele otomatik maaş ödemesi yapılır. Açık avanslar otomatik mahsup edilir.
              </p>
              <div className="space-y-3">
                <Field label="Ödeme Tarihi *">
                  <input type="date" value={bulkForm.payment_date} onChange={e => setBulkForm({ ...bulkForm, payment_date: e.target.value })} className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Dönem Ay *">
                    <select value={bulkForm.period_month} onChange={e => setBulkForm({ ...bulkForm, period_month: e.target.value })} className={inputCls}>
                      {MONTHS.map((m, i) => <option key={i} value={(i+1).toString()}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Dönem Yıl *">
                    <input type="number" value={bulkForm.period_year} onChange={e => setBulkForm({ ...bulkForm, period_year: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Ödeme Yöntemi">
                  <select value={bulkForm.payment_method} onChange={e => setBulkForm({ ...bulkForm, payment_method: e.target.value })} className={inputCls}>
                    <option value="transfer">Havale/EFT</option>
                    <option value="cash">Nakit</option>
                  </select>
                </Field>
                <Field label="Kasa *">
                  <select value={bulkForm.cash_account_id} onChange={e => setBulkForm({ ...bulkForm, cash_account_id: e.target.value })} className={inputCls}>
                    <option value="">Seçiniz</option>
                    {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.account_name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">Etki:</p>
                <p className="text-xs text-blue-700 mt-1">
                  • {employees.filter(e => e.salary && e.salary > 0).length} personel için ödeme yapılacak<br />
                  • Toplam brüt: {fmt(employees.filter(e => e.salary && e.salary > 0).reduce((s, e) => s + Number(e.salary), 0))} ₺<br />
                  • Açık avanslar otomatik mahsup edilecek
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowBulkModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold">İptal</button>
                <button onClick={handleBulkPay} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">Toplu Öde</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 text-blue-600',
    green: 'border-green-500 text-green-600',
    red: 'border-red-500 text-red-600',
    purple: 'border-purple-500 text-purple-600',
  }
  return (
    <div className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${colors[color]}`}>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
