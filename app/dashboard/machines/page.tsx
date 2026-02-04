'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'

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
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('machine_code', { ascending: true })

      if (error) throw error
      setMachines(data || [])
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
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[status as keyof typeof styles]}`}>
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Yeni Tezgah
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Aktif Tezgahlar</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{activeMachines} / {machines.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">Toplam Günlük Kapasite</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{totalCapacity} adet</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm font-medium">Ortalama Verimlilik</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">%{avgEfficiency}</p>
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
                  <span className="text-gray-600">Tip:</span>
                  <span className="font-semibold text-gray-800">{machine.machine_type || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Model:</span>
                  <span className="font-semibold text-gray-800">{machine.model || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Günlük Kapasite:</span>
                  <span className="font-semibold text-gray-800">{machine.daily_capacity || 0} adet</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Çalışma Saati:</span>
                  <span className="font-semibold text-gray-800">{machine.working_hours} saat</span>
                </div>
              </div>

              {/* Efficiency Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Verimlilik</span>
                  <span className="text-sm font-semibold text-gray-800">%{machine.efficiency_rate}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${getEfficiencyColor(machine.efficiency_rate)}`}
                    style={{ width: `${machine.efficiency_rate}%` }}
                  ></div>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Günlük Kapasite (adet)</label>
                <input
                  type="number"
                  value={formData.daily_capacity}
                  onChange={(e) => setFormData({ ...formData, daily_capacity: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verimlilik Oranı (%)</label>
                <input
                  type="number"
                  value={formData.efficiency_rate}
                  onChange={(e) => setFormData({ ...formData, efficiency_rate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Çalışma Saati</label>
                <input
                  type="number"
                  value={formData.working_hours}
                  onChange={(e) => setFormData({ ...formData, working_hours: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
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
