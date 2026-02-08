'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  console.log('TEST PAGE LOADED - Project ID:', projectId)

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="mb-4 flex items-center space-x-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Geri Dön</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Proje Detay Sayfası
        </h1>

        <div className="space-y-2">
          <p className="text-gray-700">
            <strong>Proje ID:</strong> {projectId}
          </p>
          <p className="text-green-600 font-semibold">
            ✅ Bu sayfa başarıyla yüklendi!
          </p>
          <p className="text-gray-600 text-sm mt-4">
            Console'da "TEST PAGE LOADED" mesajını görebilmelisiniz.
          </p>
        </div>
      </div>
    </div>
  )
}
