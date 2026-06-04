'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import PermissionGuard from '@/components/PermissionGuard'
import { Calendar, Plus, Check, X, Trash2, ArrowLeft, Filter, Clock, CheckCircle, XCircle } from 'lucide-react'

interface Employee {
  id: string
  full_name: string
  employee_code: string
  annual_leave_days?: number
}

interface Leave {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  reason?: string
  status: string
  rejection_reason?: string
  notes?: string
  created_at: string
  approved_at?: string
  employee?: Employee
}

const LEAVE_TYPES = [
  { value: 'annual', label: 'Yıllık İzin', color: 'blue' },
  { value: 'sick', label: 'Hastalık', color: 'red' },
  { value: 'unpaid', label: 'Ücretsiz İzin', color: 'gray' },
  { value: 'excuse', label: 'Mazeret', color: 'orange' },
  { value: 'maternity', label: 'Doğum İzni', color: 'pink' },
  { value: 'marriage', label: 'Evlilik', color: 'purple' },
  { value: 'death', label: 'Vefat', color: 'gray' },
  { value: 'other', label: 'Diğer', color: 'teal' },
]

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Bekliyor', color: 'orange', icon: Clock },
  approved: { label: 'Onaylandı', color: 'green', icon: CheckCircle },
  rejected: { label: 'Reddedildi', color: 'red', icon: XCircle },
}

// Constants OUTSIDE to prevent re-render focus loss
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    {children}
  </div>
)

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterEmployee, setFilterEmployee] = useState<string>('all')

  const [form, setForm] = useState({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const [empRes, lvRes] = await Promise.all([
        supabase.from('employees').select('id, full_name, employee_code, annual_leave_days').eq('company_id', profile.company_id).eq('status', 'active').order('full_name'),
        supabase.from('employee_leaves').select('*, employee:employees(id, full_name, employee_code, annual_leave_days)').eq('company_id', profile.company_id).order('start_date', { ascending: false })
      ])

      setEmployees(empRes.data || [])
      setLeaves(lvRes.data || [])
    } catch (e) {
      console.error('Leaves load error:', e)
    } finally {
      setLoading(false)
    }
  }

  const calcDays = (start: string, end: string): number => {
    if (!start || !end) return 0
    const s = new Date(start)
    const e = new Date(end)
    const diff = e.getTime() - s.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
  }

  const handleSave = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date || !companyId) {
      alert('Personel, başlangıç ve bitiş tarihi zorunlu!')
      return
    }
    const days = calcDays(form.start_date, form.end_date)
    if (days <= 0) {
      alert('Bitiş tarihi başlangıçtan sonra olmalı!')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        company_id: companyId,
        employee_id: form.employee_id,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        total_days: days,
        reason: form.reason || null,
        notes: form.notes || null,
        created_by: user?.id
      }

      if (editingLeave) {
        const { error } = await supabase.from('employee_leaves').update(payload).eq('id', editingLeave.id)
        if (error) throw error
        alert('✅ İzin güncellendi')
      } else {
        const { error } = await supabase.from('employee_leaves').insert(payload)
        if (error) throw error
        alert('✅ İzin kaydedildi')
      }

      setShowModal(false)
      setEditingLeave(null)
      setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '', notes: '' })
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + (e?.message || 'bilinmeyen'))
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('employee_leaves').update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      }).eq('id', id)
      if (error) throw error
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + e?.message)
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Red sebebi:')
    if (reason === null) return
    try {
      const { error } = await supabase.from('employee_leaves').update({
        status: 'rejected',
        rejection_reason: reason || null
      }).eq('id', id)
      if (error) throw error
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + e?.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu izin kaydını silmek istediğinizden emin misiniz?')) return
    try {
      const { error } = await supabase.from('employee_leaves').delete().eq('id', id)
      if (error) throw error
      await loadData()
    } catch (e: any) {
      alert('Hata: ' + e?.message)
    }
  }

  const handleEdit = (l: Leave) => {
    setEditingLeave(l)
    setForm({
      employee_id: l.employee_id,
      leave_type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason || '',
      notes: l.notes || ''
    })
    setShowModal(true)
  }

  // Filtering
  const filteredLeaves = leaves.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    if (filterEmployee !== 'all' && l.employee_id !== filterEmployee) return false
    return true
  })

  // İzin hakkı hesaplama (yıllık iznin kullanılan miktarı)
  const usedAnnualLeaves: Record<string, number> = {}
  const currentYear = new Date().getFullYear()
  leaves.forEach(l => {
    if (l.leave_type === 'annual' && l.status === 'approved') {
      const year = new Date(l.start_date).getFullYear()
      if (year === currentYear) {
        usedAnnualLeaves[l.employee_id] = (usedAnnualLeaves[l.employee_id] || 0) + Number(l.total_days)
      }
    }
  })

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
              <h2 className="text-3xl font-bold text-gray-800">İzin Yönetimi</h2>
              <p className="text-gray-600">Personel izin başvuruları ve takip</p>
            </div>
          </div>
          <button onClick={() => { setEditingLeave(null); setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '', notes: '' }); setShowModal(true) }} className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold shadow-lg">
            <Plus className="w-5 h-5" /> Yeni İzin
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Toplam" value={leaves.length} color="blue" />
          <StatBox label="Bekleyen" value={leaves.filter(l => l.status === 'pending').length} color="orange" />
          <StatBox label="Onaylanan" value={leaves.filter(l => l.status === 'approved').length} color="green" />
          <StatBox label="Reddedilen" value={leaves.filter(l => l.status === 'rejected').length} color="red" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap items-center gap-3">
          <Filter className="w-5 h-5 text-gray-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls + ' max-w-xs'}>
            <option value="all">Tüm Durumlar</option>
            <option value="pending">Bekleyen</option>
            <option value="approved">Onaylanan</option>
            <option value="rejected">Reddedilen</option>
          </select>
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className={inputCls + ' max-w-xs'}>
            <option value="all">Tüm Personel</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>

        {/* Leave List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Personel</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tarih Aralığı</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Gün</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Sebep</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Durum</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeaves.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">İzin kaydı yok</td></tr>
              ) : filteredLeaves.map(l => {
                const lt = LEAVE_TYPES.find(t => t.value === l.leave_type)
                const status = STATUS_LABELS[l.status] || STATUS_LABELS.pending
                const Icon = status.icon
                const remainingAnnual = l.employee?.annual_leave_days
                  ? (l.employee.annual_leave_days - (usedAnnualLeaves[l.employee_id] || 0))
                  : null
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm text-gray-800">{l.employee?.full_name}</p>
                      <p className="text-xs text-gray-500">#{l.employee?.employee_code}</p>
                      {l.leave_type === 'annual' && remainingAnnual !== null && (
                        <p className={`text-xs mt-0.5 ${remainingAnnual < 5 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          Kalan: {remainingAnnual} gün
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${lt?.color}-100 text-${lt?.color}-700`}>{lt?.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <p>{new Date(l.start_date).toLocaleDateString('tr-TR')}</p>
                      <p className="text-xs text-gray-500">→ {new Date(l.end_date).toLocaleDateString('tr-TR')}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{l.total_days}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{l.reason || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-${status.color}-100 text-${status.color}-700`}>
                        <Icon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {l.status === 'rejected' && l.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1 italic">{l.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {l.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(l.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Onayla">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleReject(l.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reddet">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleEdit(l)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Düzenle">
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(l.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Sil">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-gray-800">{editingLeave ? 'İzin Düzenle' : 'Yeni İzin'}</h3>
              <div className="space-y-3">
                <Field label="Personel *">
                  <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className={inputCls}>
                    <option value="">Seçiniz</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} (#{e.employee_code})</option>)}
                  </select>
                </Field>
                <Field label="İzin Tipi *">
                  <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })} className={inputCls}>
                    {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Başlangıç *">
                    <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Bitiş *">
                    <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                {form.start_date && form.end_date && (
                  <div className="text-sm text-gray-600 bg-purple-50 p-2 rounded">
                    Toplam: <strong>{calcDays(form.start_date, form.end_date)} gün</strong>
                  </div>
                )}
                <Field label="Sebep">
                  <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className={inputCls} placeholder="Örn: Tatil" />
                </Field>
                <Field label="Not">
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} rows={2} />
                </Field>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold">İptal</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold">Kaydet</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 text-blue-600',
    orange: 'border-orange-500 text-orange-600',
    green: 'border-green-500 text-green-600',
    red: 'border-red-500 text-red-600',
  }
  return (
    <div className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${colors[color]}`}>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
