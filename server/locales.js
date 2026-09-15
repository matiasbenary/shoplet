// Shared by the API and the frontend: the select's options live here, and each one
// carries what SerpApi needs plus the local words a small shop actually uses.
// ponytail: a plain object, not a database. Adding a country is one entry.
export const LOCALES = {
  ar: {
    label: 'Argentina',
    hl: 'es', gl: 'ar', google_domain: 'google.com.ar',
    shopTerms: '(tienda OR emprendimiento)',
    buyTerm: 'comprar',
  },
  mx: {
    label: 'México',
    hl: 'es', gl: 'mx', google_domain: 'google.com.mx',
    shopTerms: '(tienda OR emprendimiento)',
    buyTerm: 'comprar',
  },
  es: {
    label: 'España',
    hl: 'es', gl: 'es', google_domain: 'google.es',
    shopTerms: '(tienda OR "pequeño comercio")',
    buyTerm: 'comprar',
  },
  us: {
    label: 'United States',
    hl: 'en', gl: 'us', google_domain: 'google.com',
    shopTerms: '(shop OR "small business" OR boutique)',
    buyTerm: 'buy',
  },
  gb: {
    label: 'United Kingdom',
    hl: 'en', gl: 'uk', google_domain: 'google.co.uk',
    shopTerms: '(shop OR "independent store")',
    buyTerm: 'buy',
  },
  br: {
    label: 'Brasil',
    hl: 'pt', gl: 'br', google_domain: 'google.com.br',
    shopTerms: '(loja OR empreendedorismo)',
    buyTerm: 'comprar',
  },
}

export const DEFAULT_LOCALE = 'ar'
