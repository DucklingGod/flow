import type { Appearance } from '@clerk/shared/types'

/**
 * Maps Clerk's hosted components onto the Flow design tokens from App.css so
 * the sign-in card is indistinguishable from the rest of the product: forest
 * green primary, lime focus ring, cream paper, asymmetric card radius.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#183f31',
    colorText: '#15382c',
    colorTextSecondary: '#52635b',
    colorBackground: '#fffffc',
    colorInputBackground: '#ffffff',
    colorInputText: '#15382c',
    colorDanger: '#8a4741',
    colorSuccess: '#4d6e2b',
    colorWarning: '#8a6a2f',
    borderRadius: '13px',
    fontFamily: "'Noto Sans Thai', 'Noto Sans', sans-serif",
    fontSize: '15px',
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: '0 20px 50px rgba(41, 56, 45, .08)', border: '1px solid rgba(25, 59, 46, .12)', borderRadius: '26px 26px 8px 26px' },
    card: { backgroundColor: 'rgba(255, 255, 252, .96)', padding: '30px 28px' },
    headerTitle: { fontSize: '22px', letterSpacing: '-.4px', color: '#15382c' },
    headerSubtitle: { color: '#52635b', fontSize: '15px' },
    socialButtonsBlockButton: {
      border: '1px solid rgba(25, 59, 46, .16)', borderRadius: '13px', backgroundColor: '#ffffff',
      minHeight: '46px', fontWeight: 600,
      '&:hover': { backgroundColor: '#f7f9f4', borderColor: 'rgba(25, 59, 46, .3)' },
    },
    dividerLine: { backgroundColor: 'rgba(25, 59, 46, .12)' },
    dividerText: { color: '#6a796f', fontSize: '12.5px' },
    formFieldLabel: { color: '#3f5449', fontWeight: 600, fontSize: '13.5px' },
    formFieldInput: {
      border: '1px solid rgba(25, 59, 46, .16)', borderRadius: '12px', minHeight: '46px',
      '&:focus': { borderColor: '#183f31', boxShadow: '0 0 0 3px rgba(215, 255, 115, .55)' },
    },
    formButtonPrimary: {
      backgroundColor: '#183f31', color: '#f2f8ec', borderRadius: '12px', minHeight: '46px',
      fontSize: '15px', fontWeight: 650, textTransform: 'none', boxShadow: 'none',
      '&:hover': { backgroundColor: '#245944' },
      '&:focus': { boxShadow: '0 0 0 3px rgba(215, 255, 115, .7)' },
    },
    footerActionLink: { color: '#4f6d3c', fontWeight: 650, '&:hover': { color: '#183f31' } },
    identityPreviewEditButton: { color: '#4f6d3c' },
    formResendCodeLink: { color: '#4f6d3c' },
    userButtonPopoverCard: { borderRadius: '20px 20px 8px 20px' },
  },
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false,
    logoPlacement: 'none',
  },
}
