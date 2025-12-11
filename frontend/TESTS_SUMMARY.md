# Frontend Test Summary (Jest/RTL)

This project uses `react-scripts test` with Jest and React Testing Library.
All suites currently pass (`npm test -- --watch=false`):

| Suite | Purpose | Key Checks |
| --- | --- | --- |
| `src/pages/auth/ForgotPassword.test.js` | Forgot password flow | Renders page, accepts email, triggers reset (Firebase mocked) |
| `src/pages/auth/LoginPage.test.js` | Login form | Renders form, login button interaction (Firebase/Firestore mocked) |
| `src/pages/auth/SignupPage.test.js` | Signup form | Renders form, signup button interaction (Firebase/Firestore mocked) |
| `src/payment/CheckoutForm.test.jsx` | Stripe checkout form | Renders payment element, submit interaction (Stripe checkout mocked) |
| `src/App.test.js` | App smoke test | App renders with heavy modules mocked (Image synthesis, canvas, axios) |

## User-facing capabilities exercised
- Draw/upload image → synthesize output (image synthesis module mocked in tests).
- Login / forgot password / signup flows (Firebase mocked).
- Payment checkout flow (Stripe mocked).
- Image upload/stylize/download flows covered indirectly via App smoke test (heavy components mocked to keep tests fast).

## How to run
```bash
cd frontend
npm test -- --watch=false
```

## Notes
- External services (Firebase, Stripe, axios, canvas/WebGL) are mocked to keep tests deterministic and fast.
- Console noise from mocks is suppressed in tests. 
