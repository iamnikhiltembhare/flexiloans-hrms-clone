// Public demo builds swap FlexiLoans branding for a neutral placeholder and
// show a banner, so a deployed demo is never mistaken for the real portal.
// Controlled by VITE_PUBLIC_DEMO at build time; local builds are unaffected.

export const IS_PUBLIC_DEMO = String(import.meta.env?.VITE_PUBLIC_DEMO) === 'true'

export const BRAND = IS_PUBLIC_DEMO
  ? {
      word1: 'NORTH',
      word2: 'BRIDGE',
      tagline: 'Human Resources',
      company: 'Northbridge Financial',
      legalEntity: 'Northbridge Financial Services Pvt Ltd',
      emailDomain: 'northbridge.example',
      poweredBy: 'Demo build',
    }
  : {
      word1: 'FLEXI',
      word2: 'LOANS',
      tagline: 'Human Resources',
      company: 'FlexiLoans',
      legalEntity: 'Epimoney Private Limited',
      emailDomain: 'flexiloans.com',
      poweredBy: 'Powered by uKnowva',
    }

/** Rewrite a seeded email onto the demo domain when in public-demo mode. */
export const brandEmail = (email) =>
  IS_PUBLIC_DEMO ? String(email).replace(/@[^@]+$/, '@' + BRAND.emailDomain) : email
