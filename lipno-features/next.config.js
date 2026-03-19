// next.config.js  ← přidejte/nahraďte v rootu projektu
// Bezpečnostní konfigurace Next.js

/** @type {import('next').NextConfig} */
const nextConfig = {

  // ─── Security Headers (fallback pokud middleware selže) ──
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',                   value: 'DENY' },
          { key: 'X-Content-Type-Options',            value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control',            value: 'off' },
          { key: 'Referrer-Policy',                   value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',                value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
          { key: 'Strict-Transport-Security',         value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Cross-Origin-Opener-Policy',        value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy',      value: 'same-origin' },
        ],
      },
      // Webhook endpoint: accept od Comgate (nutné pro cross-origin POST)
      {
        source: '/api/payment/webhook',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: 'https://payments.comgate.cz' },
          { key: 'Access-Control-Allow-Methods', value: 'POST' },
        ],
      },
    ]
  },

  // ─── Server-side ENV protection ──────────────────────────
  // Tyto proměnné se NIKDY nepošlou na klienta
  serverRuntimeConfig: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    COMGATE_SECRET:            process.env.COMGATE_SECRET,
    COMGATE_MERCHANT_ID:       process.env.COMGATE_MERCHANT_ID,
    RESEND_API_KEY:            process.env.RESEND_API_KEY,
    ANTHROPIC_API_KEY:         process.env.ANTHROPIC_API_KEY,
    CSRF_SECRET:               process.env.CSRF_SECRET,
    ADMIN_EMAIL:               process.env.ADMIN_EMAIL,
  },

  // ─── Public ENV (pouze tyto jdou na klienta) ─────────────
  publicRuntimeConfig: {
    NEXT_PUBLIC_URL:               process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // ─── Image domains ────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    // Zabrání SSRF přes next/image
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ─── Vypni x-powered-by header ───────────────────────────
  poweredByHeader: false,

  // ─── Strict mode ─────────────────────────────────────────
  reactStrictMode: true,

  // ─── Produkční optimalizace ───────────────────────────────
  compress: true,

  // ─── Zakáž source maps v produkci ────────────────────────
  // (útočník by mohl číst zdrojový kód)
  productionBrowserSourceMaps: false,
}

module.exports = nextConfig
