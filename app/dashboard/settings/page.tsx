'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Tab = 'users' | 'roles' | 'invitations' | 'company' | 'activity'

interface User {
  id: string
  full_name: string
  email: string
  role_id: string
  role_name: string
  is_active: boolean
  created_at: string
  last_login: string | null
}

interface Role {
  id: string
  name: string
  description: string
  permissions: any
  is_system_role: boolean
  user_count?: number
}

interface Invitation {
  id: string
  email: string
  role_id: string
  role_name: string
  invited_by_name: string
  status: string
  created_at: string
  expires_at: string
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
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Selection
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

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

  useEffect(() => {
    applyFilters()
  }, [users, searchQuery, filterRole, filterStatus])

  const applyFilters = () => {
    let filtered = [...users]

    // Search
    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter((user) => user.role_id === filterRole)
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((user) => user.is_active)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((user) => !user.is_active)
    }

    setFilteredUsers(filtered)
  }

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single()

      setCurrentUserRole(roleData?.name || '')

      // Load users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active, created_at, role_id, last_login')
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
              last_login: u.last_login,
            }
          })
        )
        setUsers(usersWithRoles)
      }

      // Load roles with user counts
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (rolesData) {
        const rolesWithCounts = await Promise.all(
          rolesData.map(async (role: any) => {
            const { count } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('role_id', role.id)
              .eq('company_id', profile.company_id)

            return { ...role, user_count: count || 0 }
          })
        )
        setRoles(rolesWithCounts)
      }

      // Load invitations
      const { data: invitationsData } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')

      if (invitationsData) {
        const invitationsWithDetails = await Promise.all(
          invitationsData.map(async (inv: any) => {
            const { data: roleData } = await supabase
              .from('roles')
              .select('name')
              .eq('id', inv.role_id)
              .single()

            const { data: inviterData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', inv.invited_by)
              .single()

            return {
              id: inv.id,
              email: inv.email,
              role_id: inv.role_id,
              role_name: roleData?.name || 'Bilinmiyor',
              invited_by_name: inviterData?.full_name || 'Bilinmiyor',
              status: inv.status,
              created_at: inv.created_at,
              expires_at: inv.expires_at,
            }
          })
        )
        setInvitations(invitationsWithDetails)
      }

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

  const handleBulkRoleChange = async (roleId: string) => {
    if (selectedUsers.length === 0) {
      alert('⚠️ Lütfen en az bir kullanıcı seçin!')
      return
    }

    if (!confirm(`${selectedUsers.length} kullanıcının rolünü değiştirmek istediğinizden emin misiniz?`))
      return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role_id: roleId })
        .in('id', selectedUsers)

      if (error) throw error

      alert('✅ Roller başarıyla güncellendi!')
      setSelectedUsers([])
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
      const { error } = await supabase.from('profiles').delete().eq('id', userId)

      if (error) throw error

      alert('✅ Kullanıcı silindi!')
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()

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

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { error } = await supabase.from('user_invitations').insert({
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
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Bu daveti iptal etmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId)

      if (error) throw error

      alert('✅ Davet iptal edildi!')
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { error } = await supabase
        .from('user_invitations')
        .update({ expires_at: expiresAt.toISOString() })
        .eq('id', invitation.id)

      if (error) throw error

      alert(`✅ Davet ${invitation.email} adresine yeniden gönderildi!`)
      loadData()
    } catch (error: any) {
      alert('❌ Hata: ' + error.message)
    }
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingRole) {
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
        const { error } = await supabase.from('roles').insert({
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

  const handleDuplicateRole = async (role: Role) => {
    setEditingRole(null)
    setRoleForm({
      name: `${role.name} (Kopya)`,
      description: role.description,
      permissions: role.permissions,
    })
    setShowRoleModal(true)
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
      const { error } = await supabase.from('roles').delete().eq('id', roleId)

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
          ...(roleForm.permissions as any)[module],
          [permission]: value,
        },
      },
    })
  }

  const handleSelectAllPermissions = (module: string) => {
    setRoleForm({
      ...roleForm,
      permissions: {
        ...roleForm.permissions,
        [module]: {
          view: true,
          create: true,
          edit: true,
          delete: true,
        },
      },
    })
  }

  const handleClearAllPermissions = (module: string) => {
    setRoleForm({
      ...roleForm,
      permissions: {
        ...roleForm.permissions,
        [module]: {
          view: false,
          create: false,
          edit: false,
          delete: false,
        },
      },
    })
  }

  const tabs = [
    { id: 'users' as Tab, label: 'Kullanıcılar', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', count: users.length },
    { id: 'roles' as Tab, label: 'Roller', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', count: roles.length },
    { id: 'invitations' as Tab, label: 'Davetler', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', count: invitations.length },
    { id: 'company' as Tab, label: 'Şirket', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  const isSuperAdmin = currentUserRole === 'Super Admin'
  const activeUsers = users.filter((u) => u.is_active).length
  const inactiveUsers = users.filter((u) => !u.is_active).length

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Sistem Ayarları</h2>
            <p className="text-gray-600 mt-1">Kullanıcılar, roller ve şirket yönetimi</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg">
              {currentUserRole}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Kullanıcı</p>
                <p className="text-3xl font-bold text-gray-800">{users.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Aktif Kullanıcı</p>
                <p className="text-3xl font-bold text-gray-800">{activeUsers}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-orange-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Roller</p>
                <p className="text-3xl font-bold text-gray-800">{roles.length}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-purple-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Bekleyen Davet</p>
                <p className="text-3xl font-bold text-gray-800">{invitations.length}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
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
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors relative ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="font-semibold">{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Kullanıcı ara (isim veya email)..."
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Tüm Roller</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Pasif</option>
                </select>

                {isSuperAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold flex items-center space-x-2 transition-colors whitespace-nowrap"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Davet Et</span>
                  </button>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedUsers.length > 0 && isSuperAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-800">
                    {selectedUsers.length} kullanıcı seçildi
                  </span>
                  <div className="flex space-x-2">
                    <select
                      onChange={(e) => handleBulkRoleChange(e.target.value)}
                      className="px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Toplu Rol Değiştir</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setSelectedUsers([])}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {/* Users Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {isSuperAdmin && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsers(filteredUsers.map((u) => u.id))
                              } else {
                                setSelectedUsers([])
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kullanıcı</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Rol</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Durum</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Son Giriş</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kayıt Tarihi</th>
                      {isSuperAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">İşlemler</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-lg font-semibold mb-1">Kullanıcı bulunamadı</p>
                          <p className="text-sm">Arama kriterlerinizi değiştirmeyi deneyin</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          {isSuperAdmin && (
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUsers([...selectedUsers, user.id])
                                  } else {
                                    setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold mr-3 shadow-lg">
                                {user.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                                {user.id === currentUserId && (
                                  <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Siz</span>
                                )}
                              </div>
                            </div>
                          </td>
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
                                user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              } ${isSuperAdmin && user.id !== currentUserId ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                            >
                              {user.is_active ? '● Aktif' : '● Pasif'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {user.last_login ? new Date(user.last_login).toLocaleDateString('tr-TR') : 'Hiç giriş yapmadı'}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ROLES TAB */}
          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Roller & İzinler</h3>
                  <p className="text-sm text-gray-600">Sistem rollerini ve izinlerini yönetin</p>
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
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    ✨ Yeni Rol Oluştur
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-bold text-gray-800">{role.name}</h4>
                          {role.is_system_role && (
                            <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded">
                              Sistem
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {role.user_count || 0} kullanıcı
                        </div>
                      </div>
                    </div>

                    {/* Permission Summary */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-600 mb-2">İzinler:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(role.permissions || {})
                          .filter(([_, perms]: any) => perms.view || perms.create || perms.edit || perms.delete)
                          .map(([module]) => (
                            <span
                              key={module}
                              className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded"
                            >
                              {module}
                            </span>
                          ))}
                      </div>
                      {Object.keys(role.permissions || {}).length === 0 && (
                        <p className="text-xs text-gray-500">İzin tanımlanmamış</p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {isSuperAdmin && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditRole(role)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                          ✏️ Düzenle
                        </button>
                        <button
                          onClick={() => handleDuplicateRole(role)}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                          📋 Kopyala
                        </button>
                        {!role.is_system_role && (
                          <button
                            onClick={() => handleDeleteRole(role.id, role.name, role.is_system_role)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {roles.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-lg font-semibold mb-1 text-gray-700">Henüz rol tanımlanmamış</p>
                  <p className="text-sm text-gray-500">Yeni rol oluşturmak için yukarıdaki butonu kullanın</p>
                </div>
              )}
            </div>
          )}

          {/* INVITATIONS TAB */}
          {activeTab === 'invitations' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Bekleyen Davetler</h3>
                {invitations.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg font-semibold mb-1 text-gray-700">Bekleyen davet yok</p>
                    <p className="text-sm text-gray-500">Yeni kullanıcı davet etmek için "Kullanıcılar" sekmesini kullanın</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {invitations.map((invitation) => {
                      const isExpired = new Date(invitation.expires_at) < new Date()
                      return (
                        <div
                          key={invitation.id}
                          className={`border rounded-xl p-6 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'} shadow-sm hover:shadow-md transition-shadow`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="font-semibold text-gray-800">{invitation.email}</p>
                              <p className="text-sm text-gray-600 mt-1">Rol: {invitation.role_name}</p>
                            </div>
                            {isExpired && (
                              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">
                                Süresi Doldu
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Davet eden: {invitation.invited_by_name}
                            </div>
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Son kullanma: {new Date(invitation.expires_at).toLocaleDateString('tr-TR')}
                            </div>
                          </div>

                          {isSuperAdmin && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleResendInvitation(invitation)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                              >
                                Yeniden Gönder
                              </button>
                              <button
                                onClick={() => handleCancelInvitation(invitation.id)}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                              >
                                İptal Et
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COMPANY TAB */}
          {activeTab === 'company' && company && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Şirket Bilgileri</h3>
                <p className="text-sm text-gray-600">Şirket detaylarını yönetin</p>
              </div>

              <form onSubmit={handleCompanyUpdate} className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Şirket Adı <span className="text-red-500">*</span>
                    </label>
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

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
                  >
                    💾 Değişiklikleri Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={loadData}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    ↺ İptal
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
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

      {/* Role Modal (Create/Edit) */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-8 max-w-5xl w-full my-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingRole ? '✏️ Rol Düzenle' : '✨ Yeni Rol Oluştur'}
              </h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-6">
              {/* Role Name and Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rol Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    required
                    placeholder="örn: Üretim Müdürü"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Açıklama <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    required
                    placeholder="Rol açıklaması"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Permissions Matrix */}
              <div>
                <h4 className="text-lg font-bold text-gray-800 mb-4">İzinler</h4>
                <div className="bg-gray-50 rounded-lg p-6 space-y-4 max-h-[500px] overflow-y-auto">
                  {Object.entries(roleForm.permissions).map(([module, perms]: [string, any]) => (
                    <div key={module} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-bold text-gray-800 capitalize">{module}</h5>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAllPermissions(module)}
                            className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 transition-colors"
                          >
                            ✓ Tümünü Seç
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearAllPermissions(module)}
                            className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                          >
                            ✗ Temizle
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['view', 'create', 'edit', 'delete'].map((permission) => {
                          const hasPermission = (roleForm.permissions as any)[module]?.[permission]
                          return (
                            <label
                              key={permission}
                              className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
                                hasPermission ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={hasPermission || false}
                                onChange={(e) =>
                                  handlePermissionChange(module, permission, e.target.checked)
                                }
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {permission === 'view' && '👁️ Görüntüle'}
                                {permission === 'create' && '➕ Oluştur'}
                                {permission === 'edit' && '✏️ Düzenle'}
                                {permission === 'delete' && '🗑️ Sil'}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  {editingRole ? '💾 Değişiklikleri Kaydet' : '✨ Rol Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-8 py-3 rounded-lg font-semibold transition-colors"
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
