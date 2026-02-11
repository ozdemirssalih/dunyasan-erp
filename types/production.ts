// Proje-Tezgah İlişkisi ve Üretim Takibi için Type'lar

export interface ProjectMachine {
  id: string
  company_id: string
  project_id: string
  machine_id: string
  sequence_order: number
  daily_capacity_target?: number
  notes?: string
  created_at: string
  updated_at: string
  machine?: Machine
}

export interface Machine {
  id: string
  company_id: string
  machine_code: string
  machine_name: string
  machine_type?: string
  model?: string
  status: 'active' | 'maintenance' | 'offline'
}

export interface MachineDailyProduction {
  id: string
  company_id: string
  project_id: string
  machine_id: string
  production_date: string
  capacity_target: number
  actual_production: number
  defect_count: number
  efficiency_rate: number
  shift?: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
  machine?: Machine
  project?: Project
}

export interface Project {
  id: string
  company_id: string
  project_code: string
  project_name: string
  customer_company_id?: string
  entry_machine_id?: string
  exit_machine_id?: string
  target_quantity?: number
  start_date?: string
  end_date?: string
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  entry_machine?: Machine
  exit_machine?: Machine
}

export interface ProjectMachineWithStats extends ProjectMachine {
  totalGiven?: number
  totalProduced?: number
  efficiency?: number
  avgEfficiency?: number
  totalDefects?: number
}

export interface DailyProductionSummary {
  date: string
  totalProduction: number
  totalDefects: number
  avgEfficiency: number
  machineCount: number
}
