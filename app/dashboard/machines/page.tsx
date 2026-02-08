'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { Factory, TrendingUp, Clock, Package, Activity, Settings, Wrench, AlertCircle } from 'lucide-react'

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  machine_type: string | null
  model: string | null
  status: 'active' | 'maintenance' | 'offline'
  daily_capacity: number | null
  efficiency_rate: number
  working_hours: number
  created_at: string
  production_count?: number
  material_assignments_count?: number
  last_production_date?: string
  calculated_efficiency?: number
  total_given?: number
  total_produced?: number
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [formData, setFormData] = useState<{
    machine_code: string
    machine_name: string
    machine_type: string
    model: string
    status: 'active' | 'maintenance' | 'offline'
    daily_capacity: number
    efficiency_rate: number
    working_hours: number
  }>({
    machine_code: '',
    machine_name: '',
    machine_type: '',
    model: '',
    status: 'active',
    daily_capacity: 0,
    efficiency_rate: 0,
    working_hours: 0,
  })

  useEffect(() => {
    loadMachines()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('machines_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
        loadMachines()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadMachines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let finalCompanyId = profile?.company_id

      if (!finalCompanyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', '%dünyasan%')
          .limit(1)
          .single()

        if (company?.id) {
          finalCompanyId = company.id
          await supabase
            .from('profiles')
            .update({ company_id: finalCompanyId })
            .eq('id', user.id)
        } else {
          const { data: firstCompany } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single()

          if (firstCompany?.id) {
            finalCompanyId = firstCompany.id
            await supabase
              .from('profiles')
              .update({ company_id: finalCompanyId })
              .eq('id', user.id)
          }
        }
      }

      if (!finalCompanyId) {
        console.error('No company found')
        setLoading(false)
        return
      }

      setCompanyId(finalCompanyId)

      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('machine_code', { ascending: true })

      if (error) throw error

      // Her tezgah için üretim istatistiklerini çek
      const machinesWithStats = await Promise.all(
        (data || []).map(async (machine) => {
          // Üretim sayısı
          const { count: productionCount } = await supabase
            .from('production_outputs')
            .select('*', { count: 'exact', head: true })
            .eq('machine_id', machine.id)

          // Hammadde atama sayısı
          const { count: assignmentsCount } = await supabase
            .from('production_material_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('machine_id', machine.id)

          // Son üretim tarihi
          const { data: lastProduction } = await supabase
            .from('production_outputs')
            .select('production_date')
            .eq('machine_id', machine.id)
            .order('production_date', { ascending: false })
            .limit(1)
            .single()

          // VERİMLİLİK HESAPLAMA
          // 1. Tezgaha verilen toplam hammadde
          const { data: givenMaterials } = await supabase
            .from('production_to_machine_transfers')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalGiven = givenMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0

          // 2. Tezgahın ürettiği toplam mamül
          const { data: producedItems } = await supabase
            .from('production_outputs')
            .select('quantity')
            .eq('machine_id', machine.id)

          const totalProduced = producedItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

          // 3. Verimlilik = (Üretilen / Verilen) × 100
          const calculatedEfficiency = totalGiven > 0 ? (totalProduced / totalGiven) * 100 : 0

          return {
            ...machine,
            production_count: productionCount || 0,
            material_assignments_count: assignmentsCount || 0,
            last_production_date: lastProduction?.production_date || null,
            total_given: totalGiven,
            total_produced: totalProduced,
            calculated_efficiency: calculatedEfficiency
          }
        })
      )

      setMachines(machinesWithStats)
    } catch (error) {
      console.error('Error loading machines:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      if (editingMachine) {
        // Update existing machine
        const { error } = await supabase
          .from('machines')
          .update({
            machine_code: formData.machine_code,
            machine_name: formData.machine_name,
            machine_type: formData.machine_type,
            model: formData.model,
            status: formData.status,
            daily_capacity: formData.daily_capacity,
            efficiency_rate: formData.efficiency_rate,
            working_hours: formData.working_hours,
          })
          .eq('id', editingMachine.id)

        if (error) throw error
      } else {
        // Create new machine
        const { error } = await supabase
          .from('machines')
          .insert({
            company_id: companyId,
            machine_code: formData.machine_code,
            machine_name: formData.machine_name,
            machine_type: formData.machine_type,
            model: formData.model,
            status: formData.status,
            daily_capacity: formData.daily_capacity,
            efficiency_rate: formData.efficiency_rate,
            working_hours: formData.working_hours,
          })

        if (error) throw error
      }

      // Reset form and close modal
      setFormData({
        machine_code: '',
        machine_name: '',
        machine_type: '',
        model: '',
        status: 'active',
        daily_capacity: 0,
        efficiency_rate: 0,
        working_hours: 0,
      })
      setEditingMachine(null)
      setShowModal(false)
      loadMachines()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine)
    setFormData({
      machine_code: machine.machine_code,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type || '',
      model: machine.model || '',
      status: machine.status as 'active' | 'maintenance' | 'offline',
      daily_capacity: machine.daily_capacity || 0,
      efficiency_rate: machine.efficiency_rate,
      working_hours: machine.working_hours,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu tezgahı silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadMachines()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      maintenance: 'bg-orange-100 text-orange-700',
      offline: 'bg-red-100 text-red-700',
    }
    const labels = {
      active: 'Çalışıyor',
      maintenance: 'Bakımda',
      offline: 'Çalışmıyor',
    }
    const icons = {
      active: <Activity className="w-4 h-4" />,
      maintenance: <Wrench className="w-4 h-4" />,
      offline: <AlertCircle className="w-4 h-4" />,
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getEfficiencyColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-600'
    if (rate >= 60) return 'bg-blue-600'
    if (rate >= 40) return 'bg-orange-600'
    return 'bg-red-600'
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full">Yükleniyor...</div>
  }

  const activeMachines = machines.filter(m => m.status === 'active').length
  const totalCapacity = machines.reduce((sum, m) => sum + (m.daily_capacity || 0), 0)
  const avgEfficiency = machines.length > 0
    ? Math.round(machines.reduce((sum, m) => sum + m.efficiency_rate, 0) / machines.length)
    : 0

  return (
    <PermissionGuard module="machines" permission="view">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Tezgah Yönetimi</h2>
          <p className="text-gray-600">CNC tezgahlarını yönetin ve izleyin</p>
        </div>
        <button
          onClick={() => {
            setEditingMachine(null)
            setFormData({
              machine_code: '',
              machine_name: '',
              machine_type: '',
              model: '',
              status: 'active',
              daily_capacity: 0,
              efficiency_rate: 0,
              working_hours: 0,
            })
            setShowModal(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
        >
          <Factory className="w-5 h-5" />
          Yeni Tezgah
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Aktif Tezgahlar</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{activeMachines} / {machines.length}</p>
            </div>
            <Activity className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Machines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {machines.length > 0 ? (
          machines.map((machine) => (
            <div key={machine.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              {/* Machine Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{machine.machine_code}</h3>
                  <p className="text-sm text-gray-600">{machine.machine_name}</p>
                </div>
                {getStatusBadge(machine.status)}
              </div>

              {/* Machine Details */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    Tip:
                  </span>
                  <span className="font-semibold text-gray-800">{machine.machine_type || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Model:</span>
                  <span className="font-semibold text-gray-800">{machine.model || '-'}</span>
                </div>
              </div>

              {/* Production Stats */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4 space-y-2">
                <p className="text-xs font-semibold text-blue-900 mb-2">Üretim İstatistikleri</p>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-700">Toplam Üretim:</span>
                  <span className="font-bold text-blue-900">{machine.production_count || 0} kayıt</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-700">Hammadde Atamaları:</span>
                  <span className="font-bold text-blue-900">{machine.material_assignments_count || 0} atama</span>
                </div>
                {machine.last_production_date && (
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-700">Son Üretim:</span>
                    <span className="font-bold text-blue-900">
                      {new Date(machine.last_production_date).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                )}
              </div>

              {/* Efficiency Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Verimlilik</span>
                  <span className="text-sm font-semibold text-gray-800">%{machine.calculated_efficiency?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${getEfficiencyColor(machine.calculated_efficiency || 0)}`}
                    style={{ width: `${Math.min(machine.calculated_efficiency || 0, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Verilen: {machine.total_given?.toFixed(2) || '0'}</span>
                  <span>Üretilen: {machine.total_produced?.toFixed(2) || '0'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(machine)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => handleDelete(machine.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            Henüz tezgah bulunmuyor. Yeni tezgah ekleyin.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {editingMachine ? 'Tezgahı Düzenle' : 'Yeni Tezgah'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tezgah Kodu</label>
                <input
                  type="text"
                  value={formData.machine_code}
                  onChange={(e) => setFormData({ ...formData, machine_code: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="T-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tezgah Adı</label>
                <input
                  type="text"
                  value={formData.machine_name}
                  onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="CNC Torna 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tezgah Tipi</label>
                <input
                  type="text"
                  value={formData.machine_type}
                  onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="CNC Torna 3 Eksen"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Fanuc 0i-TF"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="active">Çalışıyor</option>
                  <option value="maintenance">Bakımda</option>
                  <option value="offline">Çalışmıyor</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors"
                >
                  {editingMachine ? 'Güncelle' : 'Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingMachine(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg font-semibold transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  )
}
