/**
 * Stripe Checkout - Web only
 *
 * Redirects to Stripe Checkout for subscription purchase on web.
 * RevenueCat will sync subscription status via webhook.
 */

import { loadStripe } from '@stripe/stripe-js';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

let stripePromise: ReturnType<typeof loadStripe> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

/**
 * Redirect to Stripe Checkout for subscription purchase
 */
export const redirectToCheckout = async (priceId: string): Promise<void> => {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe not loaded');
  }

  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    successUrl: `${window.location.origin}/subscription/success`,
    cancelUrl: `${window.location.origin}/subscription`,
    // RevenueCat customer ID will be passed via metadata
    clientReferenceId: 'USER_ID_HERE', // Replace with actual user ID
  });

  if (error) {
    console.error('Stripe checkout error:', error);
    throw error;
  }
};

/**
 * Create Stripe Checkout Session via backend API
 * (Recommended approach for better security and RevenueCat integration)
 */
export const createCheckoutSession = async (
  priceId: string,
  userId: string,
  email: string,
): Promise<{ sessionId: string }> => {
  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, userId, email }),
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  return response.json();
};
