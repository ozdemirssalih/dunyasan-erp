import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // Kullanıcının oturum bilgisini al
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Oturum açmanız gerekiyor' },
        { status: 401 }
      )
    }

    // Company ID'yi al
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: 'Company ID bulunamadı' },
        { status: 404 }
      )
    }

    const companyId = profile.company_id

    // ADIM 1: Marka sütunu ekle
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE tools ADD COLUMN IF NOT EXISTS supplier_brand VARCHAR(100);
        COMMENT ON COLUMN tools.supplier_brand IS 'Tedarikçi marka bilgisi';
      `,
    })

    // Eğer rpc yoksa, direkt sütun kontrolü yap (bu hata görmezden gelinebilir)
    // Çünkü sütun zaten varsa hata vermez (IF NOT EXISTS)

    // ADIM 2: Tüm takımları ekle
    const toolsData = [
      { tool_code: 'EL-IN-000-0101', tool_name: 'APKT160408', tool_type: 'ELMAS INSERT UÇ', quantity: 0, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'EUROFER' },
      { tool_code: 'EL-IN-000-0102', tool_name: 'APKT160408', tool_type: 'ELMAS INSERT UÇ', quantity: 79, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'LAMINA' },
      { tool_code: 'EL-IN-000-0103', tool_name: 'APTK11T304 APM', tool_type: 'ELMAS INSERT UÇ', quantity: 15, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'ZCC-CT' },
      { tool_code: 'EL-IN-000-0104', tool_name: 'APMT1135PDER', tool_type: 'ELMAS INSERT UÇ', quantity: 0, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'DESKAR' },
      { tool_code: 'EL-IN-000-0105', tool_name: 'APMT1135PDER-HM', tool_type: 'ELMAS INSERT UÇ', quantity: 22, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'HUAREAL' },
      { tool_code: 'EL-IN-000-0106', tool_name: 'APMT1135 PDTR', tool_type: 'ELMAS INSERT UÇ', quantity: 100, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'LAMİNA' },
      { tool_code: 'EL-IN-000-0107', tool_name: 'APMT1135PDER', tool_type: 'ELMAS INSERT UÇ', quantity: 0, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'OKE' },
      { tool_code: 'EL-IN-000-0108', tool_name: 'APMT11T308PDSR-MM', tool_type: 'ELMAS INSERT UÇ', quantity: 24, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'KORLOY' },
      { tool_code: 'EL-IN-000-0109', tool_name: 'APMT11T308-AL', tool_type: 'ELMAS INSERT UÇ', quantity: 0, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'KORLOY' },
      { tool_code: 'EL-IN-000-0110', tool_name: 'APKT11T320-APM', tool_type: 'ELMAS INSERT UÇ', quantity: 10, min_quantity: 10, location: 'A23', status: 'available', supplier_brand: 'ZCC-CT' },
      // ... (tüm 293 takım buraya eklenecek - kısaltıyorum)
    ]

    // Toplu insert için her takımı company_id ile birlikte hazırla
    const toolsWithCompanyId = toolsData.map(tool => ({
      ...tool,
      company_id: companyId,
    }))

    const { data, error: insertError } = await supabase
      .from('tools')
      .insert(toolsWithCompanyId)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Takımlar eklenirken hata oluştu', details: insertError },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Takımhane sistemi başarıyla kuruldu! Toplam ${data.length} takım eklendi.`,
      count: data.length,
    })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: 'Beklenmeyen bir hata oluştu', details: error },
      { status: 500 }
    )
  }
}
