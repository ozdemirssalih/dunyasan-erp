'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Tab = 'users' | 'roles' | 'company'

interface User {
  id: string
  full_name: string
  email: string
  role_id: string
  role_name: string
  is_active: boolean
  created_at: string
}

interface Role {
  id: string
  name: string
  description: string
  permissions: any
  is_system_role: boolean
}

interface Company {
  id: string
  name: string
  tax_number: string | null
  address: string | null
  phone: string | null
  email: string | null
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Get current user's company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Load users
      const { data: usersData } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          is_active,
          created_at,
          role_id,
          roles!inner(name)
        `)
        .eq('company_id', profile.company_id)

      if (usersData) {
        const formattedUsers = usersData.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email || '',
          role_id: u.role_id,
          role_name: u.roles.name,
          is_active: u.is_active,
          created_at: u.created_at,
        }))
        setUsers(formattedUsers)
      }

      // Load roles
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (rolesData) setRoles(rolesData)

      // Load company
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()

      if (companyData) setCompany(companyData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role_id: newRoleId })
        .eq('id', userId)

      if (error) throw error

      alert('Rol başarıyla güncellendi!')
      loadData()
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const handleCompanyUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: company.name,
          tax_number: company.tax_number,
          address: company.address,
          phone: company.phone,
          email: company.email,
        })
        .eq('id', company.id)

      if (error) throw error

      alert('Şirket bilgileri güncellendi!')
    } catch (error: any) {
      alert('Hata: ' + error.message)
    }
  }

  const tabs = [
    { id: 'users' as Tab, label: 'Kullanıcılar', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'roles' as Tab, label: 'Roller ve İzinler', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'company' as Tab, label: 'Şirket Ayarları', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-full">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Ayarlar</h2>
        <p className="text-gray-600">Sistem, kullanıcı ve şirket ayarları</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Kullanıcı Yönetimi</h3>
                <span className="text-sm text-gray-600">{users.length} kullanıcı</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Ad Soyad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Rol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Durum
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Kayıt Tarihi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {user.full_name}
                          {user.id === currentUserId && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Siz
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role_id}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              user.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {new Date(user.created_at).toLocaleDateString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Roles Tab */}
          {activeTab === 'roles' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Roller ve İzinler</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {roles.map((role) => (
                  <div key={role.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-800">{role.name}</h4>
                      {role.is_system_role && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          Sistem Rolü
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{role.description}</p>

                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold text-gray-700">İzinler:</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(role.permissions).map(([module, perms]: [string, any]) => (
                          <div key={module} className="text-xs">
                            <span className="font-semibold text-gray-700 capitalize">{module}:</span>
                            <div className="ml-2 text-gray-600">
                              {perms.view && '👁️ Görüntüle '}
                              {perms.create && '➕ Oluştur '}
                              {perms.edit && '✏️ Düzenle '}
                              {perms.delete && '🗑️ Sil'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && company && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Şirket Bilgileri</h3>

              <form onSubmit={handleCompanyUpdate} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Şirket Adı
                  </label>
                  <input
                    type="text"
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vergi Numarası
                  </label>
                  <input
                    type="text"
                    value={company.tax_number || ''}
                    onChange={(e) => setCompany({ ...company, tax_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={company.phone || ''}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={company.email || ''}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Adres
                  </label>
                  <textarea
                    value={company.address || ''}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Kaydet
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
