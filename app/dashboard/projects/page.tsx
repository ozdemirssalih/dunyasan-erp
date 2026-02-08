'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { FolderKanban, Plus, Eye } from 'lucide-react'

interface Project {
  id: string
  project_name: string
  project_code?: string
  status: string
  start_date: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const companyId = profile?.company_id
      if (!companyId) return

      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Proje Yönetimi</h2>
          <p className="text-gray-600">Projelerinizi yönetin ve takip edin</p>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{project.project_name}</h3>
                <p className="text-sm text-gray-600">{project.project_code || 'Kod yok'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                project.status === 'completed' ? 'bg-green-100 text-green-800' :
                project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status === 'planning' ? 'Planlama' :
                 project.status === 'in_progress' ? 'Devam Ediyor' :
                 project.status === 'completed' ? 'Tamamlandı' :
                 project.status === 'on_hold' ? 'Beklemede' : project.status}
              </span>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Detay
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
