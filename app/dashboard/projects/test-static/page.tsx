'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function TestStaticPage() {
  const router = useRouter()

  console.log('🔵 STATIC TEST PAGE LOADED')

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
          🔵 Statik Test Sayfası
        </h1>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-semibold">Bu bir statik route: /dashboard/projects/test-static</p>
            <p className="text-blue-700 mt-2">Dinamik [id] route değil.</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">Eğer bu sayfayı görüyorsanız, routing çalışıyor demektir!</p>
            <p className="text-green-700 mt-2">Sorun [id] dinamik route'unda.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
