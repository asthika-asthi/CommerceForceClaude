// Kept in sync with frontend-starter/lib/block-defaults.ts.
// If you add or rename a block, update both files.
export const BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
  'scroll-expand-hero': {
    mediaType: 'image',
    mediaSrc: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1280&auto=format&fit=crop',
    bgImageSrc: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&auto=format&fit=crop',
    title: 'Your Headline Here',
    date: 'Premium Quality',
    scrollToExpand: 'Scroll to explore',
  },
  'featured-products-grid': {
    title: 'Featured Products',
    subtitle: 'Handpicked for you',
    maxProducts: 8,
  },
  'testimonials-carousel': {
    title: 'What our customers say',
    testimonials: [
      { name: 'Jane Smith', role: 'Verified Buyer', quote: 'Outstanding quality and fast delivery. Highly recommend!' },
      { name: 'John Doe', role: 'Regular Customer', quote: 'Best value for money I have found. Will order again.' },
    ],
    autoAdvanceMs: 4000,
  },
  'newsletter-section': {
    title: 'Stay in the loop',
    subtitle: 'Get the latest offers and exclusive deals delivered to your inbox.',
    backgroundImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&auto=format&fit=crop',
    buttonText: 'Subscribe',
  },
  'loyalty-widget': {
    title: 'Earn rewards with every order',
    subtitle: 'Join our loyalty program and start earning points today.',
    joinCtaText: 'Create an account to start earning',
    joinCtaUrl: '/register',
  },
  'cta-banner': {
    title: 'Ready to get started?',
    subtitle: 'Explore our full range of products and find exactly what you need.',
    ctaText: 'Shop Now',
    ctaUrl: '/products',
    backgroundImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&auto=format&fit=crop',
  },
  'button-group': {
    alignment: 'center',
    buttons: [
      { label: 'Shop Now', url: '/products', variant: 'primary' },
      { label: 'Learn More', url: '/about', variant: 'outline' },
    ],
  },
  'navbar': {
    logoText: 'My Store',
    logoUrl: '/',
    links: [
      { label: 'Home', url: '/' },
      { label: 'Products', url: '/products' },
      { label: 'About', url: '/about' },
    ],
    ctaLabel: 'Shop Now',
    ctaUrl: '/products',
  },
  'footer': {
    logoText: 'My Store',
    tagline: 'Quality products delivered to your door.',
    columns: [
      {
        heading: 'Shop',
        links: [
          { label: 'All Products', url: '/products' },
          { label: 'New Arrivals', url: '/products?sort=newest' },
        ],
      },
      {
        heading: 'Help',
        links: [
          { label: 'Contact Us', url: '/contact' },
          { label: 'FAQ', url: '/faq' },
        ],
      },
    ],
    copyrightText: '© 2026 My Store. All rights reserved.',
  },
  'shiny-button': {
    children: 'Register',
  },
  'glowing-shadow': {
    children: 'Glowing Shadow',
  },
  'tubelight-navbar': {
    items: [
      { name: 'Home',     url: '/',         icon: 'Home' },
      { name: 'Products', url: '/products', icon: 'ShoppingCart' },
      { name: 'About',    url: '/about',    icon: 'User' },
      { name: 'Contact',  url: '/contact',  icon: 'FileText' },
    ],
  },
  'menu': {
    title: 'Browse',
    layout: 'horizontal',
    items: [
      { label: 'All Products', url: '/products' },
      { label: 'New Arrivals', url: '/products?sort=newest' },
      { label: 'Sale', url: '/products?sale=true' },
      {
        label: 'Categories',
        url: '/categories',
        children: [
          { label: 'Category A', url: '/products?category=a' },
          { label: 'Category B', url: '/products?category=b' },
        ],
      },
    ],
  },
}
