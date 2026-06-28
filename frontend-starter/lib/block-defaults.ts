// Kept in sync with frontend-admin/lib/block-defaults.ts.
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
  'promotions-banner': {},
  'announcement-bar': {},
  'coupon-spotlight': {},
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
  'glassmorphism-hero': {
    backgroundImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&auto=format&fit=crop',
    title: 'Built for your business',
    subtitle: 'Premium quality, delivered fast.',
    ctaText: 'Shop Now',
    ctaUrl: '/products',
    overlayOpacity: 0.4,
  },
  'parallax-banner': {
    backgroundImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&auto=format&fit=crop',
    title: 'Quality you can count on',
    subtitle: 'Trusted by businesses across the UK.',
    ctaText: 'Get a quote',
    ctaUrl: '/contact',
    overlayOpacity: 0.5,
    minHeight: '400px',
  },
  'marquee-ticker': {
    items: [
      'Free delivery over £150',
      'UK-stocked products',
      '30-day returns',
      'Rated 4.9 ★ by 2,000+ customers',
      'Trade accounts welcome',
    ],
    speed: 40,
  },
  'gradient-text-section': {
    title: 'Where quality meets value',
    subtitle: 'Trusted by trade professionals across the UK since 1995.',
    ctaText: 'Explore our range',
    ctaUrl: '/products',
  },
  'image-mosaic': {
    title: 'Our products in action',
    images: [
      { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop', alt: 'Product 1' },
      { src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop', alt: 'Product 2' },
      { src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop', alt: 'Product 3' },
      { src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop', alt: 'Product 4' },
      { src: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&auto=format&fit=crop', alt: 'Product 5' },
      { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop', alt: 'Product 6' },
    ],
  },
  'split-image-text': {
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop',
    imageAlt: 'Our products',
    title: 'Trusted by trade professionals',
    body: 'For over 30 years we have supplied quality products to businesses across the UK. Our team is on hand to help you find exactly what you need.',
    ctaText: 'Learn more',
    ctaUrl: '/about',
    imagePosition: 'left',
  },
  'animated-counter': {
    title: 'By the numbers',
    stats: [
      { value: 30, label: 'Years in business', suffix: '+' },
      { value: 2000, label: 'Happy customers', suffix: '+' },
      { value: 500, label: 'Products in range', suffix: '+' },
      { value: 99, label: 'Satisfaction rate', suffix: '%' },
    ],
  },
  'bento-grid': {
    title: 'Why choose us',
    cards: [
      {
        size: 'large',
        title: 'Trade prices, direct to you',
        body: 'We import directly and pass the savings on. No middlemen, no markups — just quality products at the price you deserve.',
        linkUrl: '/products',
        linkText: 'Browse our range',
      },
      {
        size: 'small',
        title: 'Fast dispatch',
        body: 'Orders placed before 2pm ship the same day.',
      },
      {
        size: 'small',
        title: '30-day returns',
        body: 'Not happy? Return it, no questions asked.',
      },
    ],
  },
}
