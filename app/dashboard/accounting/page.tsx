'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/lib/hooks/usePermissions'
import {
  Wallet, TrendingUp, TrendingDown, Clock, Plus, X, Save, Calendar, History, Upload, FileDown, FileCheck, Edit2, Trash2
} from 'lucide-react'

type TransactionType = 'receivable' | 'payable' | 'payment'

export default function AccountingPageV2() {
  const { canCreate } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'checks'>('dashboard')

  // Döviz kurları
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    'TRY': 1,
    'USD': 32.50,
    'EUR': 35.20,
    'GBP': 41.10
  })

  // Data states - Para birimi bazında
  const [cashBalances, setCashBalances] = useState<Record<string, number>>({})
  const [totalReceivables, setTotalReceivables] = useState<Record<string, number>>({})
  const [totalPayables, setTotalPayables] = useState<Record<string, number>>({})
  const [monthlyIncome, setMonthlyIncome] = useState<Record<string, number>>({})
  const [monthlyExpense, setMonthlyExpense] = useState<Record<string, number>>({})

  // Lists
  const [recentCashTransactions, setRecentCashTransactions] = useState<any[]>([])
  const [allCashTransactions, setAllCashTransactions] = useState<any[]>([])
  const [unpaidReceivables, setUnpaidReceivables] = useState<any[]>([])
  const [unpaidPayables, setUnpaidPayables] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // Modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showCheckModal, setShowCheckModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [editingTransactionType, setEditingTransactionType] = useState<'cash' | 'account' | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<any>(null)
  const [deletingTransactionType, setDeletingTransactionType] = useState<'cash' | 'account' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Çek takip state'leri
  const [checks, setChecks] = useState<any[]>([])
  const [checkDocumentFile, setCheckDocumentFile] = useState<File | null>(null)

  // Yaklaşan çekler için tarih aralığı
  const [upcomingChecksStartDate, setUpcomingChecksStartDate] = useState<string>(new Date().toISOString().split('T')[0])
  const getDefaultEndDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().split('T')[0]
  }
  const [upcomingChecksEndDate, setUpcomingChecksEndDate] = useState<string>(getDefaultEndDate())

  const [checkForm, setCheckForm] = useState({
    check_number: '',
    check_type: 'incoming' as 'incoming' | 'outgoing',
    amount: '',
    currency: 'TRY',
    check_date: new Date().toISOString().split('T')[0],
    due_date: '',
    customer_id: '',
    supplier_id: '',
    description: '',
    status: 'pending' as 'pending' | 'collected' | 'paid' | 'bounced' | 'cancelled'
  })

  // Kasa geçmişi filtreleme state'leri
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Form state
  const [formMode, setFormMode] = useState<'account' | 'payment'>('account') // Cari kayıt mı, ödeme mi?
  const [documentFile, setDocumentFile] = useState<File | null>(null) // PDF belgesi
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'receivable' as TransactionType,
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'other',
    currency: 'TRY',
    customer_id: '',
    supplier_id: ''
  })

  // Edit form state
  const [editForm, setEditForm] = useState({
    amount: '',
    description: '',
    transaction_date: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'other',
    currency: 'TRY',
    customer_id: '',
    supplier_id: ''
  })

  useEffect(() => {
    initializeData()
    fetchExchangeRates()
  }, [])

  useEffect(() => {
    if (companyId) loadData()
  }, [companyId])

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/TRY')
      const data = await response.json()

      if (data && data.rates) {
        setExchangeRates({
          'TRY': 1,
          'USD': 1 / data.rates.USD,
          'EUR': 1 / data.rates.EUR,
          'GBP': 1 / data.rates.GBP
        })
      }
    } catch (error) {
      console.warn('Döviz kurları yüklenemedi, varsayılan değerler kullanılıyor:', error)
    }
  }

  const initializeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profile?.company_id) {
        setCompanyId(profile.company_id)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    if (!companyId) return

    try {
      // Kasa işlemlerini yükle
      const { data: cashTxns } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false })

      setAllCashTransactions(cashTxns || [])
      setRecentCashTransactions(cashTxns?.slice(0, 10) || [])

      // Kasa bakiyesini hesapla (sadece ödemelerden)
      const cashByCurrency: Record<string, number> = {}
      cashTxns?.forEach(t => {
        const currency = t.currency || 'TRY'
        const amount = parseFloat(t.amount)
        if (t.transaction_type === 'income') {
          cashByCurrency[currency] = (cashByCurrency[currency] || 0) + amount
        } else {
          cashByCurrency[currency] = (cashByCurrency[currency] || 0) - amount
        }
      })
      setCashBalances(cashByCurrency)

      // Tüm alacak kayıtlarını yükle
      const { data: receivables, error: recError } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('transaction_type', 'receivable')
        .order('transaction_date', { ascending: false })

      if (recError) console.error('Receivables error:', recError)

      setUnpaidReceivables(receivables || [])

      // Alacak toplamını hesapla (Tüm receivable işlemler)
      const receivableByCurrency: Record<string, number> = {}
      receivables?.forEach(r => {
        const currency = r.currency || 'TRY'
        const amount = parseFloat(r.amount)
        receivableByCurrency[currency] = (receivableByCurrency[currency] || 0) + amount
      })

      // Her müşteri için tahsilatları çıkar
      const receivablePaymentsByCurrency: Record<string, number> = {}
      cashTxns?.forEach(t => {
        if (t.transaction_type === 'income' && t.customer_id) {
          const currency = t.currency || 'TRY'
          const amount = parseFloat(t.amount)
          receivablePaymentsByCurrency[currency] = (receivablePaymentsByCurrency[currency] || 0) + amount
        }
      })

      // Net alacak = Toplam Alacak - Toplam Tahsilat
      Object.keys(receivablePaymentsByCurrency).forEach(currency => {
        receivableByCurrency[currency] = (receivableByCurrency[currency] || 0) - receivablePaymentsByCurrency[currency]
      })

      setTotalReceivables(receivableByCurrency)

      // Tüm borç kayıtlarını yükle
      const { data: payables, error: payError } = await supabase
        .from('current_account_transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('transaction_type', 'payable')
        .order('transaction_date', { ascending: false })

      if (payError) console.error('Payables error:', payError)

      setUnpaidPayables(payables || [])

      // Borç toplamını hesapla (Tüm payable işlemler)
      const payableByCurrency: Record<string, number> = {}
      payables?.forEach(p => {
        const currency = p.currency || 'TRY'
        const amount = parseFloat(p.amount)
        payableByCurrency[currency] = (payableByCurrency[currency] || 0) + amount
      })

      // Her tedarikçi için ödemeleri çıkar
      const payablePaymentsByCurrency: Record<string, number> = {}
      cashTxns?.forEach(t => {
        if (t.transaction_type === 'expense' && t.supplier_id) {
          const currency = t.currency || 'TRY'
          const amount = parseFloat(t.amount)
          payablePaymentsByCurrency[currency] = (payablePaymentsByCurrency[currency] || 0) + amount
        }
      })

      // Net borç = Toplam Borç - Toplam Ödeme
      Object.keys(payablePaymentsByCurrency).forEach(currency => {
        payableByCurrency[currency] = (payableByCurrency[currency] || 0) - payablePaymentsByCurrency[currency]
      })

      setTotalPayables(payableByCurrency)

      // Müşterileri ve tedarikçileri yükle
      const { data: customersData } = await supabase
        .from('customer_companies')
        .select('id, customer_name')
        .eq('company_id', companyId)
        .order('customer_name')

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('company_name')

      setCustomers(customersData || [])
      setSuppliers(suppliersData || [])

      // Bu ayki gelir/gider hesapla
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const monthlyIncomeByCurrency: Record<string, number> = {}
      const monthlyExpenseByCurrency: Record<string, number> = {}

      cashTxns?.forEach(t => {
        const txDate = new Date(t.transaction_date)
        if (txDate >= firstDayOfMonth && txDate <= lastDayOfMonth) {
          const currency = t.currency || 'TRY'
          const amount = parseFloat(t.amount)

          if (t.transaction_type === 'income') {
            monthlyIncomeByCurrency[currency] = (monthlyIncomeByCurrency[currency] || 0) + amount
          } else {
            monthlyExpenseByCurrency[currency] = (monthlyExpenseByCurrency[currency] || 0) + amount
          }
        }
      })

      setMonthlyIncome(monthlyIncomeByCurrency)
      setMonthlyExpense(monthlyExpenseByCurrency)

      // Çekleri yükle
      const { data: checksData } = await supabase
        .from('checks')
        .select('*')
        .eq('company_id', companyId)
        .order('due_date', { ascending: true })

      // Müşteri ve tedarikçi bilgilerini manuel olarak yükle
      const checksWithNames = await Promise.all((checksData || []).map(async (check) => {
        let customer_name = null
        let supplier_name = null

        if (check.customer_id) {
          const { data: customerData } = await supabase
            .from('customer_companies')
            .select('customer_name')
            .eq('id', check.customer_id)
            .single()
          customer_name = customerData?.customer_name
        }

        if (check.supplier_id) {
          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('company_name')
            .eq('id', check.supplier_id)
            .single()
          supplier_name = supplierData?.company_name
        }

        return {
          ...check,
          customer_name,
          supplier_name
        }
      }))

      setChecks(checksWithNames)

    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleSaveTransaction = async () => {
    if (!transactionForm.amount || !companyId) {
      return alert('Tutar zorunludur!')
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Dosya yükleme işlemi (varsa)
      let documentUrl: string | null = null
      if (documentFile) {
        const fileExt = documentFile.name.split('.').pop()
        const fileName = `${companyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('accounting-documents')
          .upload(fileName, documentFile)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          return alert('Belge yüklenirken hata oluştu: ' + uploadError.message)
        }

        // Dosya yolunu kaydet (signed URL indirme sırasında oluşturulacak)
        documentUrl = fileName
      }

      if (formMode === 'account') {
        // CARİ KAYIT (ALACAK veya BORÇ)
        if (!transactionForm.customer_id && !transactionForm.supplier_id) {
          return alert('Müşteri veya tedarikçi seçimi zorunludur!')
        }

        const isReceivable = !!transactionForm.customer_id

        // Tarihe şu anki saati ekle
        const transactionDate = new Date(transactionForm.transaction_date)
        const now = new Date()
        transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())

        await supabase.from('current_account_transactions').insert({
          company_id: companyId,
          transaction_type: isReceivable ? 'receivable' : 'payable',
          customer_id: isReceivable ? transactionForm.customer_id : null,
          supplier_id: !isReceivable ? transactionForm.supplier_id : null,
          amount: parseFloat(transactionForm.amount),
          paid_amount: 0,
          currency: transactionForm.currency,
          status: 'unpaid',
          transaction_date: transactionDate.toISOString(),
          due_date: null,
          description: transactionForm.description,
          reference_number: `${isReceivable ? 'RCV' : 'PAY'}-${Date.now()}`,
          document_url: documentUrl,
          created_by: user?.id
        })

      } else if (formMode === 'payment') {
        // ÖDEME KAYDI (Kasa işlemi)
        const amount = parseFloat(transactionForm.amount)

        // Validasyon: Müşteri veya tedarikçi seçilmeli
        if (!transactionForm.customer_id && !transactionForm.supplier_id) {
          return alert('Müşteri veya tedarikçi seçimi zorunludur!')
        }

        // Tarihe şu anki saati ekle
        const cashTransactionDate = new Date(transactionForm.transaction_date)
        const nowCash = new Date()
        cashTransactionDate.setHours(nowCash.getHours(), nowCash.getMinutes(), nowCash.getSeconds(), nowCash.getMilliseconds())

        // Kasa kaydı oluştur
        const cashData: any = {
          company_id: companyId,
          transaction_type: transactionForm.customer_id ? 'income' : 'expense',
          amount: amount,
          currency: transactionForm.currency,
          payment_method: transactionForm.payment_method,
          transaction_date: cashTransactionDate.toISOString(),
          description: transactionForm.description,
          reference_number: `CASH-${Date.now()}`,
          document_url: documentUrl,
          created_by: user?.id
        }

        if (transactionForm.customer_id) {
          cashData.customer_id = transactionForm.customer_id
        }
        if (transactionForm.supplier_id) {
          cashData.supplier_id = transactionForm.supplier_id
        }

        await supabase.from('cash_transactions').insert(cashData)
      }

      alert('İşlem başarıyla kaydedildi!')
      setShowTransactionModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error:', error)
      alert('Hata oluştu!')
    }
  }

  const resetForm = () => {
    setFormMode('account')
    setDocumentFile(null)
    setTransactionForm({
      transaction_type: 'receivable',
      amount: '',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      currency: 'TRY',
      customer_id: '',
      supplier_id: ''
    })
  }

  const resetCheckForm = () => {
    setCheckDocumentFile(null)
    setCheckForm({
      check_number: '',
      check_type: 'incoming',
      amount: '',
      currency: 'TRY',
      check_date: new Date().toISOString().split('T')[0],
      due_date: '',
      customer_id: '',
      supplier_id: '',
      description: '',
      status: 'pending'
    })
  }

  const handleSaveCheck = async () => {
    if (!checkForm.check_number || !checkForm.amount || !checkForm.due_date || !companyId) {
      return alert('Çek no, tutar ve vade tarihi zorunludur!')
    }

    if (checkForm.check_type === 'incoming' && !checkForm.customer_id) {
      return alert('Gelen çek için müşteri seçimi zorunludur!')
    }

    if (checkForm.check_type === 'outgoing' && !checkForm.supplier_id) {
      return alert('Giden çek için tedarikçi seçimi zorunludur!')
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // PDF dosyası yükleme (varsa)
      let documentUrl = null
      if (checkDocumentFile) {
        const fileExt = checkDocumentFile.name.split('.').pop()
        const fileName = `${companyId}/${Date.now()}_${checkForm.check_number}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('check-documents')
          .upload(fileName, checkDocumentFile)

        if (uploadError) {
          console.error('File upload error:', uploadError)
          return alert('Dosya yüklenirken hata oluştu: ' + uploadError.message)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('check-documents')
          .getPublicUrl(fileName)

        documentUrl = publicUrl
      }

      const { error } = await supabase
        .from('checks')
        .insert({
          company_id: companyId,
          check_number: checkForm.check_number,
          check_type: checkForm.check_type,
          amount: parseFloat(checkForm.amount),
          currency: checkForm.currency,
          check_date: checkForm.check_date,
          due_date: checkForm.due_date,
          customer_id: checkForm.check_type === 'incoming' ? checkForm.customer_id : null,
          supplier_id: checkForm.check_type === 'outgoing' ? checkForm.supplier_id : null,
          document_url: documentUrl,
          description: checkForm.description,
          status: checkForm.status,
          created_by: user?.id
        })

      if (error) throw error

      alert('Çek başarıyla kaydedildi!')
      setShowCheckModal(false)
      resetCheckForm()
      loadData()
    } catch (error: any) {
      console.error('Error saving check:', error)
      alert('Çek kaydedilirken hata oluştu: ' + error.message)
    }
  }

  const handleUpdateCheckStatus = async (check: any) => {
    const newStatus = prompt(`Çek durumunu güncelleyin:\n1: Beklemede\n2: Tahsil Edildi\n3: Ödendi\n4: Karşılıksız\n5: İptal`, '1')

    if (!newStatus) return

    const statusMap: Record<string, string> = {
      '1': 'pending',
      '2': 'collected',
      '3': 'paid',
      '4': 'bounced',
      '5': 'cancelled'
    }

    const status = statusMap[newStatus]
    if (!status) {
      return alert('Geçersiz seçim!')
    }

    try {
      const { error } = await supabase
        .from('checks')
        .update({ status })
        .eq('id', check.id)

      if (error) throw error

      alert('Çek durumu güncellendi!')
      loadData()
    } catch (error: any) {
      console.error('Error updating check:', error)
      alert('Çek güncellenirken hata oluştu: ' + error.message)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(amount)
  }

  const calculateTotalInTRY = (balances: Record<string, number>) => {
    let total = 0
    Object.entries(balances).forEach(([currency, amount]) => {
      const rate = exchangeRates[currency] || 1
      total += amount * rate
    })
    return total
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  const handleDownloadDocument = async (documentPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('accounting-documents')
        .createSignedUrl(documentPath, 60) // 60 saniye geçerli URL

      if (error) {
        console.error('Download error:', error)
        alert('Belge indirme hatası: ' + error.message)
        return
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      console.error('Download error:', err)
      alert('Belge indirilemedi!')
    }
  }

  // Kasa İşlemi Düzenleme
  const handleEditCashTransaction = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditingTransactionType('cash')
    setEditForm({
      amount: transaction.amount.toString(),
      description: transaction.description || '',
      transaction_date: new Date(transaction.transaction_date).toISOString().split('T')[0],
      payment_method: transaction.payment_method || 'cash',
      currency: transaction.currency || 'TRY',
      customer_id: transaction.customer_id || '',
      supplier_id: transaction.supplier_id || ''
    })
    setShowEditModal(true)
  }

  // Cari İşlemi Düzenleme
  const handleEditAccountTransaction = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditingTransactionType('account')
    setEditForm({
      amount: transaction.amount.toString(),
      description: transaction.description || '',
      transaction_date: new Date(transaction.transaction_date).toISOString().split('T')[0],
      payment_method: 'cash',
      currency: transaction.currency || 'TRY',
      customer_id: transaction.customer_id || '',
      supplier_id: transaction.supplier_id || ''
    })
    setShowEditModal(true)
  }

  // Düzenleme Kaydet
  const handleSaveEdit = async () => {
    if (!editingTransaction || !companyId || isSubmitting) return
    if (!editForm.amount) {
      return alert('Tutar zorunludur!')
    }

    setIsSubmitting(true)

    try {
      const oldAmount = parseFloat(editingTransaction.amount)
      const newAmount = parseFloat(editForm.amount)
      const oldCurrency = editingTransaction.currency || 'TRY'
      const newCurrency = editForm.currency

      if (editingTransactionType === 'cash') {
        // KASA İŞLEMİ DÜZENLEME
        const oldType = editingTransaction.transaction_type

        // Güncellemeyi yap
        const { error } = await supabase
          .from('cash_transactions')
          .update({
            amount: newAmount,
            description: editForm.description,
            transaction_date: new Date(editForm.transaction_date).toISOString(),
            payment_method: editForm.payment_method,
            currency: newCurrency,
            customer_id: editForm.customer_id || null,
            supplier_id: editForm.supplier_id || null
          })
          .eq('id', editingTransaction.id)
          .eq('company_id', companyId)

        if (error) throw error

        alert('İşlem başarıyla güncellendi!')
        setShowEditModal(false)
        setEditingTransaction(null)
        setEditingTransactionType(null)
        loadData()

      } else if (editingTransactionType === 'account') {
        // CARİ İŞLEMİ DÜZENLEME
        // Güncellemeyi yap
        const { error } = await supabase
          .from('current_account_transactions')
          .update({
            amount: newAmount,
            description: editForm.description,
            transaction_date: new Date(editForm.transaction_date).toISOString(),
            currency: newCurrency,
            customer_id: editForm.customer_id || null,
            supplier_id: editForm.supplier_id || null
          })
          .eq('id', editingTransaction.id)
          .eq('company_id', companyId)

        if (error) throw error

        alert('İşlem başarıyla güncellendi!')
        setShowEditModal(false)
        setEditingTransaction(null)
        setEditingTransactionType(null)
        loadData()
      }
    } catch (error: any) {
      console.error('Edit error:', error)
      alert('İşlem güncellenirken hata oluştu: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Silme modalını aç
  const handleDeleteCashTransaction = (transaction: any) => {
    setDeletingTransaction(transaction)
    setDeletingTransactionType('cash')
    setShowDeleteModal(true)
  }

  const handleDeleteAccountTransaction = (transaction: any) => {
    setDeletingTransaction(transaction)
    setDeletingTransactionType('account')
    setShowDeleteModal(true)
  }

  // Silme işlemi
  const handleConfirmDelete = async () => {
    if (!deletingTransaction || !companyId || isSubmitting) return

    setIsSubmitting(true)

    try {
      if (deletingTransactionType === 'cash') {
        // KASA İŞLEMİ SİLME
        // Kasa işlemini sil
        const { error } = await supabase
          .from('cash_transactions')
          .delete()
          .eq('id', deletingTransaction.id)
          .eq('company_id', companyId)

        if (error) throw error

        alert('İşlem başarıyla silindi!')
        setShowDeleteModal(false)
        setDeletingTransaction(null)
        setDeletingTransactionType(null)
        loadData()

      } else if (deletingTransactionType === 'account') {
        // CARİ İŞLEMİ SİLME
        // Cari işlemi sil
        const { error } = await supabase
          .from('current_account_transactions')
          .delete()
          .eq('id', deletingTransaction.id)
          .eq('company_id', companyId)

        if (error) throw error

        alert('İşlem başarıyla silindi!')
        setShowDeleteModal(false)
        setDeletingTransaction(null)
        setDeletingTransactionType(null)
        loadData()
      }
    } catch (error: any) {
      console.error('Delete error:', error)
      alert('İşlem silinirken hata oluştu: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Kasa geçmişi filtreleme
  const getFilteredCashTransactions = () => {
    return allCashTransactions.filter(transaction => {
      // Arama filtresi (açıklama veya referans)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesDescription = transaction.description?.toLowerCase().includes(query)
        const matchesReference = transaction.reference_number?.toLowerCase().includes(query)
        if (!matchesDescription && !matchesReference) {
          return false
        }
      }

      // Tarih filtreleri
      const txDate = new Date(transaction.transaction_date)
      if (startDate) {
        const start = new Date(startDate)
        if (txDate < start) return false
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // Günün sonuna ayarla
        if (txDate > end) return false
      }

      return true
    })
  }

  const filteredCashTransactions = getFilteredCashTransactions()

  // Yaklaşan çekleri filtrele (belirtilen tarih aralığında vadesi dolacak çekler)
  const getUpcomingChecks = (checkType: 'incoming' | 'outgoing') => {
    const startDate = new Date(upcomingChecksStartDate)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(upcomingChecksEndDate)
    endDate.setHours(23, 59, 59, 999)

    return checks.filter(check => {
      if (check.check_type !== checkType) return false
      if (check.status !== 'pending') return false // Sadece bekleyen çekler

      const dueDate = new Date(check.due_date)
      return dueDate >= startDate && dueDate <= endDate
    }).sort((a, b) => {
      const dateA = new Date(a.due_date).getTime()
      const dateB = new Date(b.due_date).getTime()
      return dateA - dateB // En yakın vade tarihi önce
    })
  }

  const upcomingIncomingChecks = getUpcomingChecks('incoming')
  const upcomingOutgoingChecks = getUpcomingChecks('outgoing')

  // Geçmiş çekleri getir (ödenmiş/tahsil edilmiş)
  const getPastChecks = (checkType: 'incoming' | 'outgoing') => {
    return checks.filter(check => {
      if (check.check_type !== checkType) return false
      // Tahsil edilmiş veya ödenmiş durumda olanlar
      return check.status === 'collected' || check.status === 'paid'
    }).sort((a, b) => {
      const dateA = new Date(a.due_date).getTime()
      const dateB = new Date(b.due_date).getTime()
      return dateB - dateA // En yeni önce
    })
  }

  const pastIncomingChecks = getPastChecks('incoming')
  const pastOutgoingChecks = getPastChecks('outgoing')

  return (
    <PermissionGuard module="accounting" permission="view">
      <div className="min-h-screen bg-gray-50 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Muhasebe</h1>
              <p className="text-gray-600">Alacak, borç ve kasa yönetimi</p>
            </div>
            {canCreate('accounting') && (
              <button
                onClick={() => setShowTransactionModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Yeni İşlem
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="w-4 h-4" />
              Kasa Geçmişi
            </button>
            <button
              onClick={() => setActiveTab('checks')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'checks'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              Çek Takip
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {/* Kasa Bakiyesi */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">Kasa Bakiyesi</div>
                {Object.keys(cashBalances).length === 0 ? (
                  <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {Object.entries(cashBalances).map(([currency, amount]) => (
                        <div key={currency} className="text-lg font-bold text-gray-900">
                          {formatCurrency(amount, currency)}
                        </div>
                      ))}
                    </div>
                    {Object.keys(cashBalances).length > 0 && Object.keys(cashBalances).some(c => c !== 'TRY') && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Toplam TL Karşılığı</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(calculateTotalInTRY(cashBalances))}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Toplam Alacak */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">Toplam Alacak</div>
                {Object.keys(totalReceivables).length === 0 ? (
                  <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {Object.entries(totalReceivables).map(([currency, amount]) => (
                        <div key={currency} className="text-lg font-bold text-green-600">
                          {formatCurrency(amount, currency)}
                        </div>
                      ))}
                    </div>
                    {Object.keys(totalReceivables).length > 0 && Object.keys(totalReceivables).some(c => c !== 'TRY') && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Toplam TL Karşılığı</p>
                        <p className="text-sm font-semibold text-green-600">{formatCurrency(calculateTotalInTRY(totalReceivables))}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Toplam Borç */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">Toplam Borç</div>
                {Object.keys(totalPayables).length === 0 ? (
                  <div className="text-xl font-bold text-gray-400">0.00 TRY</div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {Object.entries(totalPayables).map(([currency, amount]) => (
                        <div key={currency} className="text-lg font-bold text-red-600">
                          {formatCurrency(amount, currency)}
                        </div>
                      ))}
                    </div>
                    {Object.keys(totalPayables).length > 0 && Object.keys(totalPayables).some(c => c !== 'TRY') && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Toplam TL Karşılığı</p>
                        <p className="text-sm font-semibold text-red-600">{formatCurrency(calculateTotalInTRY(totalPayables))}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bu Ayki Gelir */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-sm text-emerald-100 mb-2">Bu Ayki Gelir</div>
                {Object.keys(monthlyIncome).length === 0 ? (
                  <div className="text-xl font-bold">0.00 TRY</div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {Object.entries(monthlyIncome).map(([currency, amount]) => (
                        <div key={currency} className="text-lg font-bold">
                          {formatCurrency(amount, currency)}
                        </div>
                      ))}
                    </div>
                    {Object.keys(monthlyIncome).length > 0 && Object.keys(monthlyIncome).some(c => c !== 'TRY') && (
                      <div className="mt-2 pt-2 border-t border-emerald-400/30">
                        <p className="text-emerald-100 text-xs opacity-75">Toplam TL Karşılığı</p>
                        <p className="text-sm font-semibold">{formatCurrency(calculateTotalInTRY(monthlyIncome))}</p>
                      </div>
                    )}
                  </>
                )}
                <p className="text-emerald-100 text-xs mt-2">
                  {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Bu Ayki Gider */}
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-sm text-rose-100 mb-2">Bu Ayki Gider</div>
                {Object.keys(monthlyExpense).length === 0 ? (
                  <div className="text-xl font-bold">0.00 TRY</div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {Object.entries(monthlyExpense).map(([currency, amount]) => (
                        <div key={currency} className="text-lg font-bold">
                          {formatCurrency(amount, currency)}
                        </div>
                      ))}
                    </div>
                    {Object.keys(monthlyExpense).length > 0 && Object.keys(monthlyExpense).some(c => c !== 'TRY') && (
                      <div className="mt-2 pt-2 border-t border-rose-400/30">
                        <p className="text-rose-100 text-xs opacity-75">Toplam TL Karşılığı</p>
                        <p className="text-sm font-semibold">{formatCurrency(calculateTotalInTRY(monthlyExpense))}</p>
                      </div>
                    )}
                  </>
                )}
                <p className="text-rose-100 text-xs mt-2">
                  {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bekleyen Alacaklar */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">Bekleyen Alacaklar</h3>
                </div>
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {unpaidReceivables.slice(0, 10).map((rec) => {
                    const amount = parseFloat(rec.amount)
                    const customer = customers.find(c => c.id === rec.customer_id)
                    return (
                      <div key={rec.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">
                            {customer?.customer_name || 'Müşteri'}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditAccountTransaction(rec)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Düzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAccountTransaction(rec)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {formatDate(rec.transaction_date)}
                          </div>
                          <div className="text-lg font-semibold text-green-600">
                            {formatCurrency(amount, rec.currency || 'TRY')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {unpaidReceivables.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      Bekleyen alacak yok
                    </div>
                  )}
                </div>
              </div>

              {/* Bekleyen Borçlar */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">Bekleyen Borçlar</h3>
                </div>
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {unpaidPayables.slice(0, 10).map((pay) => {
                    const amount = parseFloat(pay.amount)
                    const supplier = suppliers.find(s => s.id === pay.supplier_id)
                    return (
                      <div key={pay.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">
                            {supplier?.company_name || 'Tedarikçi'}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditAccountTransaction(pay)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Düzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAccountTransaction(pay)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {formatDate(pay.transaction_date)}
                          </div>
                          <div className="text-lg font-semibold text-red-600">
                            {formatCurrency(amount, pay.currency || 'TRY')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {unpaidPayables.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      Bekleyen borç yok
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'history' ? (
          // Kasa Geçmişi
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Kasa Hareketleri</h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredCashTransactions.length} işlem gösteriliyor
                {filteredCashTransactions.length !== allCashTransactions.length && (
                  <span className="text-gray-500"> (Toplam {allCashTransactions.length})</span>
                )}
              </p>
            </div>

            {/* Filtreleme Alanları */}
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Arama */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Arama
                  </label>
                  <input
                    type="text"
                    placeholder="Açıklama veya referans ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Başlangıç Tarihi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Bitiş Tarihi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bitiş
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Temizle Butonu */}
              {(searchQuery || startDate || endDate) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setStartDate('')
                      setEndDate('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Filtreleri Temizle
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tür</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ödeme</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referans</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Belge</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCashTransactions.map((transaction) => {
                    const paymentMethodLabels = {
                      'cash': 'Nakit',
                      'transfer': 'Havale',
                      'check': 'Çek',
                      'other': 'Diğer'
                    }

                    // Firma bilgisini bul
                    let companyName = '-'
                    let companyType = ''

                    if (transaction.customer_id) {
                      const customer = customers.find(c => c.id === transaction.customer_id)
                      if (customer) {
                        companyName = customer.customer_name
                        companyType = 'Müşteri'
                      }
                    } else if (transaction.supplier_id) {
                      const supplier = suppliers.find(s => s.id === transaction.supplier_id)
                      if (supplier) {
                        companyName = supplier.company_name
                        companyType = 'Tedarikçi'
                      }
                    }

                    return (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {formatDate(transaction.transaction_date)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(transaction.transaction_date).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {companyName !== '-' ? (
                            <div>
                              <div className="font-medium text-gray-900">{companyName}</div>
                              <div className="text-xs text-gray-500">{companyType}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="line-clamp-2" title={transaction.description}>
                            {transaction.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            transaction.transaction_type === 'income'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.transaction_type === 'income' ? 'Tahsilat' : 'Ödeme'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.payment_method ? paymentMethodLabels[transaction.payment_method as keyof typeof paymentMethodLabels] || '-' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {transaction.reference_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                          <span className={transaction.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'}>
                            {transaction.transaction_type === 'income' ? '+' : '-'}
                            {formatCurrency(parseFloat(transaction.amount), transaction.currency || 'TRY')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {transaction.document_url ? (
                            <button
                              onClick={() => handleDownloadDocument(transaction.document_url)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                              title="Belgeyi İndir"
                            >
                              <FileDown className="w-3 h-3" />
                              PDF
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditCashTransaction(transaction)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCashTransaction(transaction)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredCashTransactions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        {allCashTransactions.length === 0
                          ? 'Henüz işlem bulunmuyor'
                          : 'Filtrelere uyan işlem bulunamadı. Filtreleri değiştirmeyi deneyin.'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'checks' ? (
          // Çek Takip
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Çek Takip</h3>
                  <p className="text-sm text-gray-600 mt-1">Gelen ve giden çekleri yönetin</p>
                </div>
                {canCreate('accounting') && (
                  <button
                    onClick={() => setShowCheckModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Çek
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-600 mb-1">Gelen Çekler (Beklemede)</div>
                  <div className="text-2xl font-bold text-green-700">
                    {checks.filter(c => c.check_type === 'incoming' && c.status === 'pending').length}
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-sm text-red-600 mb-1">Giden Çekler (Beklemede)</div>
                  <div className="text-2xl font-bold text-red-700">
                    {checks.filter(c => c.check_type === 'outgoing' && c.status === 'pending').length}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-600 mb-1">Toplam Çek</div>
                  <div className="text-2xl font-bold text-blue-700">{checks.length}</div>
                </div>
              </div>

              {/* Yaklaşan Çekler Bölümü */}
              <div className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-1">📅 Yaklaşan Çekler</h4>
                    <p className="text-sm text-gray-600">Vadesi yaklaşan çekleri takip edin</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Başlangıç:</label>
                      <input
                        type="date"
                        value={upcomingChecksStartDate}
                        onChange={(e) => setUpcomingChecksStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Bitiş:</label>
                      <input
                        type="date"
                        value={upcomingChecksEndDate}
                        onChange={(e) => setUpcomingChecksEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setUpcomingChecksStartDate(new Date().toISOString().split('T')[0])
                        setUpcomingChecksEndDate(getDefaultEndDate())
                      }}
                      className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Sıfırla
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Yaklaşan Gelen Çekler */}
                  <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                    <div className="bg-green-50 border-b border-green-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-green-900">💰 Yaklaşan Gelen Çekler</h5>
                        <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                          {upcomingIncomingChecks.length}
                        </span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {upcomingIncomingChecks.length > 0 ? (
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Çek No</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Müşteri</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tutar</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Vade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {upcomingIncomingChecks.map((check) => {
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              const dueDate = new Date(check.due_date)
                              const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                              const isUrgent = daysRemaining <= 7

                              return (
                                <tr key={check.id} className={`hover:bg-gray-50 ${isUrgent ? 'bg-red-50' : ''}`}>
                                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{check.check_number}</td>
                                  <td className="px-3 py-2 text-sm text-gray-700">{check.customer_name || '-'}</td>
                                  <td className="px-3 py-2 text-sm font-semibold text-green-600">
                                    {formatCurrency(check.amount, check.currency)}
                                  </td>
                                  <td className="px-3 py-2 text-sm">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-gray-700">{new Date(check.due_date).toLocaleDateString('tr-TR')}</span>
                                      <span className={`text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
                                        {daysRemaining === 0 ? 'Bugün!' : daysRemaining === 1 ? 'Yarın' : `${daysRemaining} gün`}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Yaklaşan gelen çek bulunmuyor</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Yaklaşan Giden Çekler */}
                  <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-red-900">💸 Yaklaşan Giden Çekler</h5>
                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded-full">
                          {upcomingOutgoingChecks.length}
                        </span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {upcomingOutgoingChecks.length > 0 ? (
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Çek No</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tedarikçi</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tutar</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Vade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {upcomingOutgoingChecks.map((check) => {
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              const dueDate = new Date(check.due_date)
                              const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                              const isUrgent = daysRemaining <= 7

                              return (
                                <tr key={check.id} className={`hover:bg-gray-50 ${isUrgent ? 'bg-red-50' : ''}`}>
                                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{check.check_number}</td>
                                  <td className="px-3 py-2 text-sm text-gray-700">{check.supplier_name || '-'}</td>
                                  <td className="px-3 py-2 text-sm font-semibold text-red-600">
                                    {formatCurrency(check.amount, check.currency)}
                                  </td>
                                  <td className="px-3 py-2 text-sm">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-gray-700">{new Date(check.due_date).toLocaleDateString('tr-TR')}</span>
                                      <span className={`text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
                                        {daysRemaining === 0 ? 'Bugün!' : daysRemaining === 1 ? 'Yarın' : `${daysRemaining} gün`}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Yaklaşan giden çek bulunmuyor</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Geçmiş Çekler Bölümü */}
              <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-gray-900 mb-1">📜 Geçmiş Çekler</h4>
                  <p className="text-sm text-gray-600">Tahsil edilmiş ve ödenmiş çekler</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Tahsil Edilmiş Gelen Çekler */}
                  <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                    <div className="bg-green-50 border-b border-green-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-green-900">✅ Tahsil Edilmiş Çekler</h5>
                        <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                          {pastIncomingChecks.length}
                        </span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {pastIncomingChecks.length > 0 ? (
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Çek No</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Müşteri</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tutar</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Vade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {pastIncomingChecks.map((check) => (
                              <tr key={check.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm font-medium text-gray-900">{check.check_number}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{check.customer_name || '-'}</td>
                                <td className="px-3 py-2 text-sm font-semibold text-green-600">
                                  {formatCurrency(check.amount, check.currency)}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {new Date(check.due_date).toLocaleDateString('tr-TR')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <FileCheck className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Tahsil edilmiş çek bulunmuyor</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ödenmiş Giden Çekler */}
                  <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-blue-900">✅ Ödenmiş Çekler</h5>
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                          {pastOutgoingChecks.length}
                        </span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {pastOutgoingChecks.length > 0 ? (
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Çek No</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tedarikçi</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tutar</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Vade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {pastOutgoingChecks.map((check) => (
                              <tr key={check.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm font-medium text-gray-900">{check.check_number}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{check.supplier_name || '-'}</td>
                                <td className="px-3 py-2 text-sm font-semibold text-blue-600">
                                  {formatCurrency(check.amount, check.currency)}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {new Date(check.due_date).toLocaleDateString('tr-TR')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <FileCheck className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Ödenmiş çek bulunmuyor</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tüm Çekler Tablosu */}
              <h4 className="text-lg font-bold text-gray-900 mb-4">📋 Tüm Çekler</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Çek No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tür</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tutar</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Müşteri/Tedarikçi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Çek Tarihi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vade Tarihi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Durum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Belge</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {checks.map((check) => (
                      <tr key={check.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{check.check_number}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            check.check_type === 'incoming'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {check.check_type === 'incoming' ? 'Gelen' : 'Giden'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatCurrency(check.amount, check.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {check.customer_name || check.supplier_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(check.check_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(check.due_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            check.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            check.status === 'collected' ? 'bg-green-100 text-green-700' :
                            check.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                            check.status === 'bounced' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {check.status === 'pending' ? 'Beklemede' :
                             check.status === 'collected' ? 'Tahsil Edildi' :
                             check.status === 'paid' ? 'Ödendi' :
                             check.status === 'bounced' ? 'Karşılıksız' :
                             'İptal'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {check.document_url ? (
                            <a
                              href={check.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                            >
                              <FileDown className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleUpdateCheckStatus(check)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Düzenle
                          </button>
                        </td>
                      </tr>
                    ))}
                    {checks.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                          Henüz çek kaydı bulunmuyor
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {/* Transaction Modal */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Yeni İşlem</h3>
                  <button onClick={() => { setShowTransactionModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {/* İşlem Modu */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">İşlem Türü *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setFormMode('account')
                        setTransactionForm({...transactionForm, customer_id: '', supplier_id: ''})
                      }}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        formMode === 'account'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Cari Kayıt (Alacak/Borç)
                    </button>
                    <button
                      onClick={() => {
                        setFormMode('payment')
                        setTransactionForm({...transactionForm, customer_id: '', supplier_id: ''})
                      }}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        formMode === 'payment'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Ödeme/Tahsilat
                    </button>
                  </div>
                </div>

                {/* CARİ KAYIT FORMU */}
                {formMode === 'account' && (
                  <>
                    {/* Müşteri veya Tedarikçi Seçimi */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri (Alacak)</label>
                        <select
                          value={transactionForm.customer_id}
                          onChange={(e) => setTransactionForm({...transactionForm, customer_id: e.target.value, supplier_id: '', transaction_type: 'receivable'})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.customer_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi (Borç)</label>
                        <select
                          value={transactionForm.supplier_id}
                          onChange={(e) => setTransactionForm({...transactionForm, supplier_id: e.target.value, customer_id: '', transaction_type: 'payable'})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {suppliers.map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.company_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tutar *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={transactionForm.amount}
                          onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Para Birimi *</label>
                        <select
                          value={transactionForm.currency}
                          onChange={(e) => setTransactionForm({...transactionForm, currency: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="TRY">TRY - Türk Lirası</option>
                          <option value="USD">USD - Amerikan Doları</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="GBP">GBP - İngiliz Sterlini</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tarih *</label>
                      <input
                        type="date"
                        value={transactionForm.transaction_date}
                        onChange={(e) => setTransactionForm({...transactionForm, transaction_date: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      />
                    </div>
                  </>
                )}

                {/* ÖDEME FORMU */}
                {formMode === 'payment' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri (Tahsilat)</label>
                        <select
                          value={transactionForm.customer_id}
                          onChange={(e) => setTransactionForm({...transactionForm, customer_id: e.target.value, supplier_id: ''})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.customer_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi (Ödeme)</label>
                        <select
                          value={transactionForm.supplier_id}
                          onChange={(e) => setTransactionForm({...transactionForm, supplier_id: e.target.value, customer_id: ''})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="">Seçiniz...</option>
                          {suppliers.map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.company_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tutar *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={transactionForm.amount}
                          onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Para Birimi *</label>
                        <select
                          value={transactionForm.currency}
                          onChange={(e) => setTransactionForm({...transactionForm, currency: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="TRY">TRY - Türk Lirası</option>
                          <option value="USD">USD - Amerikan Doları</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="GBP">GBP - İngiliz Sterlini</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Yöntemi *</label>
                        <select
                          value={transactionForm.payment_method}
                          onChange={(e) => setTransactionForm({...transactionForm, payment_method: e.target.value as any})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        >
                          <option value="cash">Nakit</option>
                          <option value="transfer">Havale</option>
                          <option value="check">Çek</option>
                          <option value="other">Diğer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tarih *</label>
                        <input
                          type="date"
                          value={transactionForm.transaction_date}
                          onChange={(e) => setTransactionForm({...transactionForm, transaction_date: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Ortak Alanlar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    rows={3}
                    placeholder="İşlem açıklaması..."
                  />
                </div>

                {/* Belge Yükleme */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📄 Belge Yükle (Opsiyonel)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (file.type !== 'application/pdf') {
                            alert('Sadece PDF dosyaları yüklenebilir!')
                            e.target.value = ''
                            return
                          }
                          if (file.size > 5 * 1024 * 1024) { // 5MB limit
                            alert('Dosya boyutu 5MB\'dan küçük olmalıdır!')
                            e.target.value = ''
                            return
                          }
                          setDocumentFile(file)
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {documentFile && (
                      <div className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Upload className="w-4 h-4 text-green-600" />
                          <span>{documentFile.name}</span>
                          <span className="text-gray-500">({(documentFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDocumentFile(null)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      ℹ️ Fatura, makbuz veya sözleşme gibi belgeleri PDF formatında yükleyebilirsiniz. (Maks. 5MB)
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => { setShowTransactionModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTransaction}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Check Modal */}
        {showCheckModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Yeni Çek</h3>
                  <button onClick={() => { setShowCheckModal(false); resetCheckForm(); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Çek Türü */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Çek Türü *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCheckForm({...checkForm, check_type: 'incoming', supplier_id: ''})}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        checkForm.check_type === 'incoming'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Gelen Çek
                    </button>
                    <button
                      onClick={() => setCheckForm({...checkForm, check_type: 'outgoing', customer_id: ''})}
                      className={`px-4 py-2 rounded-lg font-medium border ${
                        checkForm.check_type === 'outgoing'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      Giden Çek
                    </button>
                  </div>
                </div>

                {/* Müşteri/Tedarikçi */}
                <div>
                  {checkForm.check_type === 'incoming' ? (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri *</label>
                      <select
                        value={checkForm.customer_id}
                        onChange={(e) => setCheckForm({...checkForm, customer_id: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      >
                        <option value="">Müşteri Seçiniz...</option>
                        {customers.map(customer => (
                          <option key={customer.id} value={customer.id}>
                            {customer.customer_name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi *</label>
                      <select
                        value={checkForm.supplier_id}
                        onChange={(e) => setCheckForm({...checkForm, supplier_id: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      >
                        <option value="">Tedarikçi Seçiniz...</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.company_name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {/* Çek No ve Tutar */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Çek No *</label>
                    <input
                      type="text"
                      value={checkForm.check_number}
                      onChange={(e) => setCheckForm({...checkForm, check_number: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      placeholder="Çek numarası"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tutar *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={checkForm.amount}
                      onChange={(e) => setCheckForm({...checkForm, amount: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Para Birimi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Para Birimi *</label>
                  <select
                    value={checkForm.currency}
                    onChange={(e) => setCheckForm({...checkForm, currency: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                  >
                    <option value="TRY">TRY - Türk Lirası</option>
                    <option value="USD">USD - Amerikan Doları</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - İngiliz Sterlini</option>
                  </select>
                </div>

                {/* Tarihler */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Çek Tarihi *</label>
                    <input
                      type="date"
                      value={checkForm.check_date}
                      onChange={(e) => setCheckForm({...checkForm, check_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vade Tarihi *</label>
                    <input
                      type="date"
                      value={checkForm.due_date}
                      onChange={(e) => setCheckForm({...checkForm, due_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                </div>

                {/* PDF Yükleme */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Çek Belgesi (PDF)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setCheckDocumentFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="check-document-upload"
                    />
                    <label
                      htmlFor="check-document-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {checkDocumentFile ? checkDocumentFile.name : 'PDF dosyası seçin veya sürükleyin'}
                      </span>
                      <span className="text-xs text-gray-500">Maksimum 5MB</span>
                    </label>
                  </div>
                  {checkDocumentFile && (
                    <div className="mt-2 flex items-center justify-between bg-blue-50 p-2 rounded">
                      <span className="text-sm text-blue-700">{checkDocumentFile.name}</span>
                      <button
                        onClick={() => setCheckDocumentFile(null)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Açıklama */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={checkForm.description}
                    onChange={(e) => setCheckForm({...checkForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    rows={3}
                    placeholder="Ek açıklama..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => { setShowCheckModal(false); resetCheckForm(); }}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveCheck}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Düzenleme Modalı */}
        {showEditModal && editingTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  İşlemi Düzenle
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {editingTransactionType === 'cash' ? 'Kasa İşlemi' : 'Cari Hesap İşlemi'}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Müşteri/Tedarikçi Seçimi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {editingTransaction.customer_id ? 'Müşteri' : 'Tedarikçi'} *
                  </label>
                  {editingTransaction.customer_id ? (
                    <select
                      value={editForm.customer_id}
                      onChange={(e) => setEditForm({...editForm, customer_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Seçiniz...</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.customer_name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={editForm.supplier_id}
                      onChange={(e) => setEditForm({...editForm, supplier_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Seçiniz...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.company_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Tutar ve Para Birimi */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tutar *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Para Birimi *</label>
                    <select
                      value={editForm.currency}
                      onChange={(e) => setEditForm({...editForm, currency: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="TRY">TRY - Türk Lirası</option>
                      <option value="USD">USD - Amerikan Doları</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - İngiliz Sterlini</option>
                    </select>
                  </div>
                </div>

                {/* Tarih ve Ödeme Yöntemi */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">İşlem Tarihi *</label>
                    <input
                      type="date"
                      value={editForm.transaction_date}
                      onChange={(e) => setEditForm({...editForm, transaction_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  {editingTransactionType === 'cash' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Yöntemi *</label>
                      <select
                        value={editForm.payment_method}
                        onChange={(e) => setEditForm({...editForm, payment_method: e.target.value as any})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                      >
                        <option value="cash">Nakit</option>
                        <option value="transfer">Havale</option>
                        <option value="check">Çek</option>
                        <option value="other">Diğer</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Açıklama */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                    rows={3}
                    placeholder="İşlem açıklaması..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingTransaction(null)
                    setEditingTransactionType(null)
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Kaydediliyor...' : 'Güncelle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Silme Onay Modalı */}
        {showDeleteModal && deletingTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  İşlemi Sil
                </h2>
              </div>

              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Bu işlemi silmek istediğinizden emin misiniz?
                </p>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    Silme işlemi geri alınamaz!
                  </p>
                  <div className="text-sm text-red-700 space-y-1">
                    <p><strong>Tutar:</strong> {formatCurrency(parseFloat(deletingTransaction.amount), deletingTransaction.currency)}</p>
                    <p><strong>Tarih:</strong> {formatDate(deletingTransaction.transaction_date)}</p>
                    {deletingTransaction.description && (
                      <p><strong>Açıklama:</strong> {deletingTransaction.description}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeletingTransaction(null)
                    setDeletingTransactionType(null)
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {isSubmitting ? 'Siliniyor...' : 'Sil'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  )
}
