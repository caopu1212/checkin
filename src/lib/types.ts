export interface CheckIn {
  id: string
  categoryId: string
  checkedAt: string // ISO timestamp
  note: string | null
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  deleted: boolean
  /** true when this record has local edits not yet pushed to Supabase */
  dirty: boolean
}

export interface Category {
  id: string
  name: string
  order: number
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  deleted: boolean
  dirty: boolean
}
