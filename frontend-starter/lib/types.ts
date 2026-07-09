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
  stripe_publishable_key?: string
  ga4_measurement_id?: string | null
  meta_pixel_id?: string | null
  theme_colors?: { core?: Record<string, string>; overrides?: Record<string, string> }
}

// ── Landing page ──────────────────────────────────────────────────────────────
export type SectionType = "hero" | "features" | "testimonials" | "cta" | "html" | "products" | "block"

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
  description?: string
  image_url?: string
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

export interface VariantOptionValue {
  option_type_name: string
  option_value_label: string
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  is_default: boolean
  is_active: boolean
  option_values: VariantOptionValue[]
  label: string
  price_adjustment?: string | null
}

export interface ProductOptionTypeValue {
  id: string
  label: string
  sort_order: number
}

export interface ProductOptionType {
  id: string
  name: string
  sort_order: number
  values: ProductOptionTypeValue[]
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
  primary_image?: string
  option_types?: ProductOptionType[]
  variants?: ProductVariant[]
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
  variant_id: string
  variant_label?: string
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
  shipping_cost: string
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
  tax_amount: string
  shipping_cost: string
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

// Landing page config types
export interface LandingConfigSection {
  __block: string
  requiredPlugin?: string
  [key: string]: unknown
}

export interface LandingConfig {
  sections: LandingConfigSection[]
}

// Config-driven brand and store types
export interface BrandConfig {
  primary?: string
  primaryHover?: string
  dark?: string
  secondary?: string
  background?: string
  text?: string
  alert?: string
  muted?: string
  border?: string
  cardBg?: string
  font?: string
}

export interface StoreConfig {
  name?: string
  tagline?: string
  logo_url?: string
  contact_email?: string
  contact_phone?: string
}

// ── Addresses ─────────────────────────────────────────────────────────────────
export interface Address {
  id: string
  user_id: string
  label?: string
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
  country: string
  is_default: boolean
}

// ── Wishlist ──────────────────────────────────────────────────────────────────
export interface WishlistItem {
  id: string
  user_id: string
  product_id: string
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export interface Review {
  id: string
  product_id: string
  user_id: string
  rating: number
  title?: string
  body?: string
  is_approved: boolean
  reviewer_name?: string
  created_at: string
}

export interface ReviewSummary {
  average_rating: number
  total_reviews: number
}

// ── Scheduling / Booking ──────────────────────────────────────────────────────
export interface SchedulingConfig {
  terms: Record<string, string>
  note_template: {
    name: string
    label: string
    fields: { key: string; label: string; type: string }[]
  }
  intake_schema: { key: string; label: string; type: string }[]
}

export interface BookableService {
  id: string
  name: string
  duration_minutes: number
  description?: string
  price?: string | number
  is_active: boolean
}

export interface BookableProvider {
  id: string
  display_name: string
  title?: string
  specialty?: string
  is_active: boolean
}

export interface AvailabilitySlots {
  slots: string[]
}

export interface BookingConfirmation {
  id: string
  start_at: string
  end_at: string
  status: string
  provider_name?: string
  appointment_type_name?: string
  client_name?: string
}

export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show"

export interface MyAppointment {
  id: string
  start_at: string
  end_at: string
  status: AppointmentStatus
  provider_name?: string
  client_name?: string
  appointment_type_name?: string
}

export interface MyAppointmentDetail extends MyAppointment {
  provider_id: string
  appointment_type_id: string
  reason?: string
  cancellation_reason?: string
}
