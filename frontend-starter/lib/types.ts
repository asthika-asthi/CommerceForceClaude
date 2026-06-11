// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
  phone?: string
  company_name?: string
  is_email_verified?: boolean
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

// ── Landing page ──────────────────────────────────────────────────────────────
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

// ── Categories ────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  slug: string
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

export interface ProductsResponse {
  items: Product[]
  total: number
  page: number
  limit: number
  pages: number
}

// ── Generic pagination ────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

// ── Cart ──────────────────────────────────────────────────────────────────────
export interface CartItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  product_slug: string
  unit_price: string
  quantity: number
  line_total: string
  primary_image?: string
  in_stock: boolean
  stock_quantity: number
}

export interface Cart {
  id: string
  user_id?: string
  items: CartItem[]
  item_count: number
  subtotal: string
}

// ── Orders ────────────────────────────────────────────────────────────────────
export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded"

export interface OrderItem {
  id: string
  product_id?: string
  product_name: string
  product_sku: string
  unit_price: string
  quantity: number
  subtotal: string
}

export interface Order {
  id: string
  order_number: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  shipping_address?: string
  notes?: string
  items: OrderItem[]
  created_at?: string
}

// ── Checkout ──────────────────────────────────────────────────────────────────
export interface CheckoutSummary {
  order_id: string
  order_number: string
  subtotal: string
  discount_amount: string
  total: string
  payment_method: string
  payment_status: string
  status: string
}

// ── Loyalty ───────────────────────────────────────────────────────────────────
export interface LoyaltyAccount {
  id: string
  user_id: string
  points_balance: number
  total_earned: number
  total_redeemed: number
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}
