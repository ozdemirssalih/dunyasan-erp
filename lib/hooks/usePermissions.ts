'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface Permission {
  view?: boolean
  create?: boolean
  edit?: boolean
  delete?: boolean
}

export interface Permissions {
  dashboard?: Permission
  production?: Permission
  machines?: Permission
  inventory?: Permission
  planning?: Permission
  warehouse?: Permission
  toolroom?: Permission
  quality_control?: Permission
  projects?: Permission
  customers?: Permission
  employees?: Permission
  accounting?: Permission
  invoices?: Permission
  accounts?: Permission
  costs?: Permission
  reports?: Permission
  settings?: Permission
  users?: Permission
}

export interface UserRole {
  id: string
  name: string
  permissions: Permissions
  is_system_role: boolean
}

export function usePermissions() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    loadPermissions()
  }, [])

  const loadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Get user's profile with role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        setLoading(false)
        return
      }

      // Get role details
      const { data: roleData } = await supabase
        .from('roles')
        .select('*')
        .eq('id', profile.role_id)
        .single()

      if (roleData) {
        setRole(roleData)
        setIsSuperAdmin(roleData.name === 'Super Admin')
      }
    } catch (error) {
      console.error('Error loading permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = (module: keyof Permissions, permission: keyof Permission): boolean => {
    // Super Admin has all permissions
    if (isSuperAdmin) return true

    // Check if user has the specific permission
    if (!role?.permissions) return false

    const modulePerms = role.permissions[module]
    if (!modulePerms) return false

    return modulePerms[permission] === true
  }

  const canView = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'view')
  }

  const canCreate = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'create')
  }

  const canEdit = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'edit')
  }

  const canDelete = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'delete')
  }

  return {
    role,
    loading,
    isSuperAdmin,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    refresh: loadPermissions,
  }
}
