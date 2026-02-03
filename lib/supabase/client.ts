// lib/supabase/client.ts
// Supabase Client - Browser tarafında kullanılır

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl === 'undefined' || supabaseUrl.trim() === '') {
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl)
  throw new Error('❌ NEXT_PUBLIC_SUPABASE_URL tanımlanmamış! Vercel Environment Variables kontrol edin.')
}

if (!supabaseAnonKey || supabaseAnonKey === 'undefined' || supabaseAnonKey.trim() === '') {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey)
  throw new Error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlanmamış! Vercel Environment Variables kontrol edin.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          tax_number: string | null
          address: string | null
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          tax_number?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
        }
        Update: {
          name?: string
          tax_number?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          company_id: string | null
          full_name: string
          role: 'admin' | 'operator' | 'accountant' | 'planner' | 'guest'
          avatar_url: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
      }
      production_orders: {
        Row: {
          id: string
          company_id: string
          order_number: string
          project_name: string
          quantity: number
          produced_quantity: number
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          start_date: string | null
          end_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          company_id: string
          order_number: string
          project_name: string
          quantity: number
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
        }
      }
      machines: {
        Row: {
          id: string
          company_id: string
          machine_code: string
          machine_name: string
          machine_type: string | null
          model: string | null
          status: 'active' | 'maintenance' | 'offline'
          daily_capacity: number | null
          efficiency_rate: number
          working_hours: number
          created_at: string
          updated_at: string
        }
      }
      inventory: {
        Row: {
          id: string
          company_id: string
          product_code: string
          product_name: string
          category: 'hammadde' | 'yarimamul' | 'mamul' | 'takim' | 'sarf'
          quantity: number
          unit: string
          min_stock_level: number
          unit_cost: number | null
          location: string | null
          created_at: string
          updated_at: string
        }
      }
    }
  }
}
