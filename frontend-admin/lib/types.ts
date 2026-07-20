// ── Pagination ────────────────────────────────────────────────────────────────
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: "superadmin" | "admin" | "customer"
  is_active: boolean
  company_name?: string
  phone?: string
  vat_number?: string
  business_type?: string
  trade_status?: "pending" | "approved" | "rejected" | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

// ── Menu ──────────────────────────────────────────────────────────────────────
export interface MenuItem {
  label: string
  path: string
}

export interface PluginMenu {
  plugin: string
  label: string
  icon: string
  items: MenuItem[]
}

// ── Categories ────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  parent_id?: string
  image_url?: string
  sort_order: number
  is_active: boolean
  children?: Category[]
}

// ── Products ──────────────────────────────────────────────────────────────────
export interface ProductImage {
  id: string
  url: string
  alt_text?: string
  is_primary?: boolean
  sort_order: number
  variant_id?: string | null
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  sku?: string
  barcode?: string
  price: string
  sale_price?: string
  stock_quantity: number
  is_active: boolean
  is_featured?: boolean
  category_id?: string
  primary_image?: string | null
  images: ProductImage[]
  variants?: ProductVariantSummary[]
}

export interface ProductCreate {
  name: string
  description?: string
  sku?: string
  price: string
  sale_price?: string
  stock_quantity?: number
  is_active?: boolean
  category_id?: string
}

// ── Orders ────────────────────────────────────────────────────────────────────
export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded"
export type PaymentMethod = "cash" | "credit_limit" | "stripe"

export interface OrderItem {
  id: string
  product_id?: string
  product_name: string
  product_sku?: string
  unit_price: string
  quantity: number
  subtotal: string
}

export interface Order {
  id: string
  order_number: string
  user_id?: string
  guest_email?: string
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  subtotal: string
  discount_amount: string
  tax_amount: string
  shipping_cost: string
  total: string
  shipping_address?: string
  notes?: string
  tracking_number?: string
  shipped_at?: string
  items: OrderItem[]
  created_at: string
}

export interface PaginatedOrders {
  items: Order[]
  total: number
  page: number
  limit: number
  pages: number
}

// ── Coupons ───────────────────────────────────────────────────────────────────
export interface Coupon {
  id: string
  code: string
  name: string
  description?: string
  discount_type: "percentage" | "fixed"
  discount_value: string
  min_order_value?: string
  max_uses?: number
  used_count: number
  is_active: boolean
  expires_at?: string
  show_on_homepage: boolean
}

// ── Discount Rules ────────────────────────────────────────────────────────────
export interface DiscountRule {
  id: string
  name: string
  description?: string
  discount_type: "percentage" | "fixed"
  discount_value: string
  min_order_value?: string
  is_active: boolean
  priority: number
  created_at?: string
}

// ── Loyalty ───────────────────────────────────────────────────────────────────
export interface LoyaltyConfig {
  points_per_dollar: string
  redemption_rate: string
  min_redemption: number
  is_active: boolean
}

export interface LoyaltyAccount {
  id: string
  user_id: string
  points_balance: number
  total_earned: number
  total_redeemed: number
}

// ── Newsletter ────────────────────────────────────────────────────────────────
export interface Subscriber {
  id: string
  email: string
  first_name?: string
  is_active: boolean
}

// ── RFQ ───────────────────────────────────────────────────────────────────────
export type RFQStatus = "draft" | "submitted" | "under_review" | "quoted" | "accepted" | "rejected" | "expired"

export interface RFQItem {
  id: string
  product_name?: string
  product_sku?: string
  requested_quantity: number
  quoted_price?: string
  notes?: string
}

export interface RFQ {
  id: string
  rfq_number: string
  user_id: string
  status: RFQStatus
  notes?: string
  admin_notes?: string
  valid_until?: string
  items: RFQItem[]
  created_at: string
}

export interface PaginatedRFQs {
  items: RFQ[]
  total: number
  page: number
  limit: number
  pages: number
}

// ── GDPR deletion requests ──────────────────────────────────────────────────
export type DeletionRequestStatus = "pending" | "approved" | "rejected" | "completed"

export interface DeletionRequest {
  id: string
  user_id?: string
  user_email_snapshot: string
  status: DeletionRequestStatus
  reviewed_at?: string
  reviewed_by?: string
  admin_notes?: string
  created_at: string
}

export interface PaginatedDeletionRequests {
  items: DeletionRequest[]
  total: number
  page: number
  limit: number
  pages: number
}

// ── Credit ────────────────────────────────────────────────────────────────────
export interface CreditAccount {
  id: string
  user_id: string
  credit_limit: string
  used_credit: string
  available_credit: string
  is_active: boolean
  notes?: string
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export interface WarehouseStock {
  id: string
  warehouse_id: string
  variant_id: string
  variant_label: string
  quantity: number
  reserved_quantity: number
  available_quantity: number
  low_stock_threshold: number
}

export interface ProductVariantSummary {
  id: string
  product_id: string
  sku: string
  is_default: boolean
  is_active: boolean
  label: string
  stock_quantity: number
}

export interface Warehouse {
  id: string
  name: string
  code: string
  address?: string
  is_active: boolean
  is_default: boolean
  stock_items: WarehouseStock[]
}

// ── Branding ──────────────────────────────────────────────────────────────────
export interface BrandingConfig {
  id: string
  store_name: string
  tagline?: string
  logo_url?: string
  favicon_url?: string
  primary_color: string
  secondary_color: string
  font_family: string
  custom_css?: string
  contact_email?: string
  contact_phone?: string
  social_links?: string
  stripe_publishable_key?: string
  ga4_measurement_id?: string | null
  meta_pixel_id?: string | null
  theme_colors?: { core?: Record<string, string>; overrides?: Record<string, string> }
}

// ── Enquiries ─────────────────────────────────────────────────────────────────
export type EnquiryType = "general" | "bespoke"

export interface Enquiry {
  id: string
  enquiry_type: EnquiryType
  name: string
  email: string
  phone?: string
  company?: string
  subject?: string
  message: string
  material_type?: string
  quantity_description?: string
  size_spec?: string
  deadline?: string
  is_read: boolean
  created_at: string
}

// ── Page Content ──────────────────────────────────────────────────────────────
export interface EditableField {
  name: string
  label: string
  type: "text" | "image" | "link"
  value: string
}

export interface EditableSection {
  section_key: string
  is_hidden: boolean
  fields: EditableField[]
}

// ── Bulk Variant CSV Import ────────────────────────────────────────────────────
export interface VariantCsvImportError {
  row: number
  field: string
  message: string
}

export interface VariantCsvImportResult {
  rows_processed: number
  variants_created: number
  variants_updated: number
  stock_records_set: number
  stock_records_incremented: number
  warnings: string[]
  errors: VariantCsvImportError[]
}

export interface StockTransferResult {
  from_stock: WarehouseStock
  to_stock: WarehouseStock
}

// ── Scheduling ────────────────────────────────────────────────────────────────
export interface SchedulingProviderList {
  id: string
  display_name: string
  title?: string
  specialty?: string
  is_active: boolean
}

export interface SchedulingProvider {
  id: string
  display_name: string
  title?: string
  specialty?: string
  bio?: string
  color?: string
  user_id?: string
  can_view_all_clients: boolean
  is_active: boolean
  created_at?: string
}

export interface SchedulingAppointmentTypeList {
  id: string
  name: string
  duration_minutes: number
  price?: string
  is_active: boolean
}

export interface SchedulingAppointmentType {
  id: string
  name: string
  duration_minutes: number
  description?: string
  price?: string
  color?: string
  is_active: boolean
  providers: { id: string; display_name: string }[]
}

export interface SchedulingAvailability {
  id: string
  provider_id: string
  weekday: number
  start_time: string
  end_time: string
}

export interface SchedulingException {
  id: string
  provider_id: string
  date: string
  is_available: boolean
  start_time?: string
  end_time?: string
}

export type SchedulingAppointmentStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"

export interface SchedulingAppointmentList {
  id: string
  start_at: string
  end_at: string
  status: SchedulingAppointmentStatus
  provider_name: string
  client_name: string
  appointment_type_name: string
}

export interface SchedulingAppointment {
  id: string
  provider_id: string
  client_id: string
  appointment_type_id: string
  start_at: string
  end_at: string
  status: SchedulingAppointmentStatus
  reason?: string
  booked_by?: string
  cancellation_reason?: string
  provider_name: string
  client_name: string
  appointment_type_name: string
  created_at: string
}

export interface SchedulingClientList {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  is_active: boolean
}

export interface SchedulingClient {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  user_id?: string
  custom_fields: Record<string, unknown>
  is_active: boolean
  created_at: string
}

export interface SchedulingJournalEntryList {
  id: string
  client_id: string
  provider_id: string
  template: string
  created_by: string
  created_at: string
}

export interface SchedulingJournalEntry extends SchedulingJournalEntryList {
  appointment_id?: string
  content: Record<string, unknown>
}

export interface SchedulingConfigField {
  key: string
  label: string
  type: string
}

export interface SchedulingConfig {
  terms: Record<string, string>
  note_template: {
    name: string
    label: string
    fields: SchedulingConfigField[]
  }
  intake_schema: SchedulingConfigField[]
}
