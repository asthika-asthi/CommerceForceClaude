// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: "superadmin" | "admin" | "customer"
  is_active: boolean
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
  name: string
  label: string
  icon: string
  admin_menu: MenuItem[]
}

// ── Categories ────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  parent_id?: string
  is_active: boolean
  children?: Category[]
}

// ── Products ──────────────────────────────────────────────────────────────────
export interface ProductImage {
  id: string
  url: string
  alt_text?: string
  sort_order: number
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  sku?: string
  price: string
  sale_price?: string
  stock_quantity: number
  is_active: boolean
  category_id?: string
  images: ProductImage[]
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
  total: string
  shipping_address?: string
  notes?: string
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
  product_id: string
  quantity: number
  reserved_quantity: number
  available_quantity: number
  low_stock_threshold?: number
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
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export type SectionType = "hero" | "features" | "testimonials" | "cta" | "html" | "products"

export interface LandingSection {
  id: string
  section_type: SectionType
  title?: string
  subtitle?: string
  content?: string
  image_url?: string
  cta_text?: string
  cta_url?: string
  sort_order: number
  is_active: boolean
  background_color?: string
}
