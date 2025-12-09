#! /usr/bin/env python3.6

"""
server.py
Stripe Sample.
Python 3.6 or newer required.
"""
from flask import Flask, jsonify, request
from flask_cors import CORS

import os
from pathlib import Path

import stripe


def _load_env_file():
    """Lightweight .env loader to keep secrets out of source control."""
    project_root = Path(__file__).resolve().parents[2]
    env_path = project_root / '.env'
    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()

# Pull the secret key from environment so it isn't committed.
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

if not stripe.api_key:
    raise RuntimeError('STRIPE_SECRET_KEY is not set. Add it to your environment or .env file.')
stripe.api_version = '2025-11-17.clover'

app = Flask(__name__,
            static_url_path='',
            static_folder='public')
CORS(app)

YOUR_DOMAIN = 'http://localhost:3000'

@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    """
    Create a Checkout session for a recurring subscription.
    """
    try:
        session = stripe.checkout.Session.create(
            # Use hosted mode so we can redirect to Stripe-hosted checkout and get a URL.
            ui_mode='hosted',
            line_items=[
                {
                    'price_data': {
                        'product_data': {
                            'name': 'Premium Plan',
                        },
                        'currency': 'USD',
                        'unit_amount': 500,
                        'recurring': {
                            'interval': 'month',
                            'interval_count': 1,
                        },
                    },
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=YOUR_DOMAIN + '/payment/complete?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=YOUR_DOMAIN + '/payment/checkout',
        )
    except Exception as e:
        return jsonify(error=str(e)), 400

    return jsonify(
        clientSecret=session.client_secret,
        sessionId=session.id,
        url=session.url,
    )

@app.route('/session-status', methods=['GET'])
def session_status():
    """
    Lookup Checkout session status. Works for subscription mode by falling back to
    latest_invoice.payment_intent when session.payment_intent is not set.
    """
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify(error='session_id is required'), 400

    try:
        session = stripe.checkout.Session.retrieve(
            session_id,
            expand=[
                "payment_intent",
                "subscription",
                "subscription.latest_invoice",
                "subscription.latest_invoice.payment_intent",
            ],
        )

        # Try to get payment_intent from session first
        payment_intent = None
        if hasattr(session, 'payment_intent') and session.payment_intent:
            if isinstance(session.payment_intent, str):
                # If it's just an ID, retrieve it
                payment_intent = stripe.PaymentIntent.retrieve(session.payment_intent)
            else:
                payment_intent = session.payment_intent
        
        # Fallback: try subscription -> latest_invoice -> payment_intent
        if not payment_intent and hasattr(session, 'subscription') and session.subscription:
            subscription = session.subscription
            if isinstance(subscription, str):
                subscription = stripe.Subscription.retrieve(subscription, expand=['latest_invoice.payment_intent'])
            
            if hasattr(subscription, 'latest_invoice') and subscription.latest_invoice:
                latest_invoice = subscription.latest_invoice
                if isinstance(latest_invoice, str):
                    latest_invoice = stripe.Invoice.retrieve(latest_invoice, expand=['payment_intent'])
                
                if hasattr(latest_invoice, 'payment_intent') and latest_invoice.payment_intent:
                    if isinstance(latest_invoice.payment_intent, str):
                        payment_intent = stripe.PaymentIntent.retrieve(latest_invoice.payment_intent)
                    else:
                        payment_intent = latest_invoice.payment_intent

        # Return response with or without payment_intent
        response_data = {
            'status': getattr(session, 'status', None),
            'payment_status': getattr(session, 'payment_status', None),
            'payment_intent_id': payment_intent.id if payment_intent else None,
            'payment_intent_status': payment_intent.status if payment_intent else None,
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Error in session_status: {error_msg}")  # Debug print
        return jsonify(error=str(e)), 500

if __name__ == '__main__':
    app.run(port=4242)