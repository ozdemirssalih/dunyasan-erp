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
  const [currentUserRole, setCurrentUserRole] = useState<string>('')

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')

  // Role form
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: {
      dashboard: { view: true },
      production: { view: false, create: false, edit: false, delete: false },
      machines: { view: false, create: false, edit: false, delete: false },
      inventory: { view: false, create: false, edit: false, delete: false },
      planning: { view: false, create: false, edit: false, delete: false },
      warehouse: { view: false, create: false, edit: false, delete: false },
      toolroom: { view: false, create: false, edit: false, delete: false },
      accounting: { view: false, create: false, edit: false, delete: false },
      invoices: { view: false, create: false, edit: false, delete: false },
      accounts: { view: false, create: false, edit: false, delete: false },
      costs: { view: false, create: false, edit: false, delete: false },
      reports: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
    },
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Get current user's company and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Get role name
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single()

      setCurrentUserRole(roleData?.name || '')

      // Load users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active, created_at, role_id')
        .eq('company_id', profile.company_id)

      if (usersData) {
        const usersWithRoles = await Promise.all(
          usersData.map(async (u: any) => {
            const { data: roleData } = await supabase
              .from('roles')
              .select('name')
              .eq('id', u.role_id)
              .single()

            return {
              id: u.id,
              full_name: u.full_name,
              email: u.email || '',
              role_id: u.role_id,
              role_name: roleData?.name || 'Bilinmiyor',
              is_active: u.is_active,
              created_at: u.created_at,
            }
          })
        )
        setUsers(usersWithRoles)
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

      alert('✅ Rol başarıyla güncellendi!')
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      alert(`✅ Kullanıcı ${!currentStatus ? 'aktif' : 'pasif'} yapıldı!`)
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`${userName} kullanıcısını silmek istediğinizden emin misiniz?`)) return

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (error) throw error

      alert('✅ Kullanıcı silindi!')
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()

    // Email domain kontrolü
    if (!inviteEmail.endsWith('@dunyasan.com')) {
      alert('❌ Sadece @dunyasan.com uzantılı emailler davet edilebilir!')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Create invitation
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 gün geçerli

      const { error } = await supabase
        .from('user_invitations')
        .insert({
          company_id: profile.company_id,
          email: inviteEmail,
          role_id: inviteRoleId,
          invited_by: user.id,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })

      if (error) throw error

      alert(`✅ ${inviteEmail} adresine davetiye gönderildi!`)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRoleId('')
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingRole) {
        // Update existing role
        const { error } = await supabase
          .from('roles')
          .update({
            name: roleForm.name,
            description: roleForm.description,
            permissions: roleForm.permissions,
          })
          .eq('id', editingRole.id)

        if (error) throw error
        alert('✅ Rol güncellendi!')
      } else {
        // Create new role
        const { error } = await supabase
          .from('roles')
          .insert({
            name: roleForm.name,
            description: roleForm.description,
            permissions: roleForm.permissions,
            is_system_role: false,
          })

        if (error) throw error
        alert('✅ Yeni rol oluşturuldu!')
      }

      setShowRoleModal(false)
      setEditingRole(null)
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    })
    setShowRoleModal(true)
  }

  const handleDeleteRole = async (roleId: string, roleName: string, isSystemRole: boolean) => {
    if (isSystemRole) {
      alert('❌ Sistem rolleri silinemez!')
      return
    }

    if (!confirm(`${roleName} rolünü silmek istediğinizden emin misiniz?`)) return

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)

      if (error) throw error

      alert('✅ Rol silindi!')
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
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

      alert('✅ Şirket bilgileri güncellendi!')
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handlePermissionChange = (module: string, permission: string, value: boolean) => {
    setRoleForm({
      ...roleForm,
      permissions: {
        ...roleForm.permissions,
        [module]: {
          ...roleForm.permissions[module],
          [permission]: value,
        },
      },
    })
  }

  const tabs = [
    { id: 'users' as Tab, label: 'Kullanıcılar', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'roles' as Tab, label: 'Roller ve İzinler', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'company' as Tab, label: 'Şirket Ayarları', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  ]

  const moduleNames: { [key: string]: string } = {
    dashboard: 'Dashboard',
    production: 'Üretim Takip',
    machines: 'Tezgah Yönetimi',
    inventory: 'Stok & Hammadde',
    planning: 'Üretim Planlama',
    warehouse: 'Depo',
    toolroom: 'Takımhane',
    accounting: 'Muhasebe',
    invoices: 'Faturalar',
    accounts: 'Cari Hesaplar',
    costs: 'Maliyet Analizi',
    reports: 'Raporlar',
    settings: 'Ayarlar',
    users: 'Kullanıcı Yönetimi',
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full">Yükleniyor...</div>
  }

  const isSuperAdmin = currentUserRole === 'Super Admin'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Ayarlar</h2>
          <p className="text-gray-600">Sistem, kullanıcı ve şirket yönetimi</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold text-sm">
            {currentUserRole}
          </div>
        </div>
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Kullanıcı Yönetimi</h3>
                  <p className="text-sm text-gray-600 mt-1">{users.length} aktif kullanıcı</p>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Kullanıcı Davet Et</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Ad Soyad</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Rol</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Durum</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kayıt Tarihi</th>
                      {isSuperAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold mr-3">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                              {user.id === currentUserId && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Siz</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                        <td className="px-6 py-4">
                          {isSuperAdmin ? (
                            <select
                              value={user.role_id}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={user.id === currentUserId}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                              {user.role_name}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => isSuperAdmin && user.id !== currentUserId && handleToggleUserStatus(user.id, user.is_active)}
                            disabled={!isSuperAdmin || user.id === currentUserId}
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              user.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            } ${isSuperAdmin && user.id !== currentUserId ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          >
                            {user.is_active ? 'Aktif' : 'Pasif'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {new Date(user.created_at).toLocaleDateString('tr-TR')}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-6 py-4">
                            {user.id !== currentUserId && (
                              <button
                                onClick={() => handleDeleteUser(user.id, user.full_name)}
                                className="text-red-600 hover:text-red-800 p-2"
                                title="Kullanıcıyı Sil"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </td>
                        )}
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Roller ve İzinler</h3>
                  <p className="text-sm text-gray-600 mt-1">{roles.length} rol tanımlı</p>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setEditingRole(null)
                      setRoleForm({
                        name: '',
                        description: '',
                        permissions: {
                          dashboard: { view: true },
                          production: { view: false, create: false, edit: false, delete: false },
                          machines: { view: false, create: false, edit: false, delete: false },
                          inventory: { view: false, create: false, edit: false, delete: false },
                          planning: { view: false, create: false, edit: false, delete: false },
                          warehouse: { view: false, create: false, edit: false, delete: false },
                          toolroom: { view: false, create: false, edit: false, delete: false },
                          accounting: { view: false, create: false, edit: false, delete: false },
                          invoices: { view: false, create: false, edit: false, delete: false },
                          accounts: { view: false, create: false, edit: false, delete: false },
                          costs: { view: false, create: false, edit: false, delete: false },
                          reports: { view: false, create: false, edit: false, delete: false },
                          settings: { view: false, create: false, edit: false, delete: false },
                          users: { view: false, create: false, edit: false, delete: false },
                        },
                      })
                      setShowRoleModal(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Yeni Rol Oluştur</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role) => (
                  <div key={role.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-gray-800">{role.name}</h4>
                        {role.is_system_role && (
                          <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            Sistem Rolü
                          </span>
                        )}
                      </div>
                      {isSuperAdmin && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleEditRole(role)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Düzenle"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {!role.is_system_role && (
                            <button
                              onClick={() => handleDeleteRole(role.id, role.name, role.is_system_role)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Sil"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{role.description}</p>

                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold text-gray-700 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        İzinler:
                      </h5>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {Object.entries(role.permissions).map(([module, perms]: [string, any]) => {
                          const hasAnyPermission = perms.view || perms.create || perms.edit || perms.delete
                          if (!hasAnyPermission) return null

                          return (
                            <div key={module} className="text-xs bg-gray-50 p-2 rounded">
                              <span className="font-semibold text-gray-700">{moduleNames[module] || module}</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {perms.view && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">👁️ Görüntüle</span>}
                                {perms.create && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">➕ Oluştur</span>}
                                {perms.edit && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">✏️ Düzenle</span>}
                                {perms.delete && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">🗑️ Sil</span>}
                              </div>
                            </div>
                          )
                        })}
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
              <div>
                <h3 className="text-xl font-bold text-gray-800">Şirket Bilgileri</h3>
                <p className="text-sm text-gray-600 mt-1">Şirket detaylarını güncelleyin</p>
              </div>

              <form onSubmit={handleCompanyUpdate} className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Şirket Adı *</label>
                    <input
                      type="text"
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vergi Numarası</label>
                    <input
                      type="text"
                      value={company.tax_number || ''}
                      onChange={(e) => setCompany({ ...company, tax_number: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Telefon</label>
                    <input
                      type="text"
                      value={company.phone || ''}
                      onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={company.email || ''}
                      onChange={(e) => setCompany({ ...company, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Adres</label>
                  <textarea
                    value={company.address || ''}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    💾 Değişiklikleri Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={loadData}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    ↺ İptal
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Kullanıcı Davet Et</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Adresi</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="kullanici@dunyasan.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-600 mt-1">Sadece @dunyasan.com uzantılı emailler</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                <select
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Rol seçin...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  📨 Davet Gönder
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Create/Edit Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingRole ? 'Rolü Düzenle' : 'Yeni Rol Oluştur'}
              </h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol Adı *</label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    required
                    placeholder="Örn: Satış Müdürü"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Açıklama</label>
                  <input
                    type="text"
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    placeholder="Rolün kısa açıklaması"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-gray-800 mb-4">İzinler</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {Object.keys(moduleNames).map((module) => (
                    <div key={module} className="bg-gray-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-gray-800 mb-3">{moduleNames[module]}</h5>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={roleForm.permissions[module]?.view || false}
                            onChange={(e) => handlePermissionChange(module, 'view', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">👁️ Görüntüle</span>
                        </label>
                        {module !== 'dashboard' && (
                          <>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={roleForm.permissions[module]?.create || false}
                                onChange={(e) => handlePermissionChange(module, 'create', e.target.checked)}
                                className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                              />
                              <span className="text-sm text-gray-700">➕ Oluştur</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={roleForm.permissions[module]?.edit || false}
                                onChange={(e) => handlePermissionChange(module, 'edit', e.target.checked)}
                                className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
                              />
                              <span className="text-sm text-gray-700">✏️ Düzenle</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={roleForm.permissions[module]?.delete || false}
                                onChange={(e) => handlePermissionChange(module, 'delete', e.target.checked)}
                                className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                              />
                              <span className="text-sm text-gray-700">🗑️ Sil</span>
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  💾 {editingRole ? 'Güncelle' : 'Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
