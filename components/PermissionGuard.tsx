'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions, Permissions } from '@/lib/hooks/usePermissions'

interface PermissionGuardProps {
  children: React.ReactNode
  module: keyof Permissions
  permission?: 'view' | 'create' | 'edit' | 'delete'
}

export default function PermissionGuard({ children, module, permission = 'view' }: PermissionGuardProps) {
  const router = useRouter()
  const { hasPermission, loading, isSuperAdmin } = usePermissions()

  useEffect(() => {
    if (!loading) {
      // Super Admin has access to everything
      if (isSuperAdmin) return

      // Check if user has the required permission
      if (!hasPermission(module, permission)) {
        router.push('/dashboard/unauthorized')
      }
    }
  }, [loading, isSuperAdmin, module, permission, hasPermission, router])

  // Show loading while checking permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yetki kontrol ediliyor...</p>
        </div>
      </div>
    )
  }

  // If Super Admin or has permission, render children
  if (isSuperAdmin || hasPermission(module, permission)) {
    return <>{children}</>
  }

  // Otherwise, show nothing (will redirect)
  return null
}
