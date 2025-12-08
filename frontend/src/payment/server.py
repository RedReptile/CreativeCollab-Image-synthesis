#! /usr/bin/env python3.6

"""
server.py
Stripe Sample.
Python 3.6 or newer required.
"""
from flask import Flask, jsonify, request

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

YOUR_DOMAIN = 'http://localhost:3000'

@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        session = stripe.checkout.Session.create(
            ui_mode = 'custom',
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
            mode='payment',
            return_url=YOUR_DOMAIN + '/complete?session_id={CHECKOUT_SESSION_ID}',
        )
    except Exception as e:
        return str(e)

    return jsonify(clientSecret=session.client_secret)

@app.route('/session-status', methods=['GET'])
def session_status():
  session = stripe.checkout.Session.retrieve(request.args.get('session_id'), expand=["payment_intent"])

  return jsonify(status=session.status, payment_status=session.payment_status, payment_intent_id=session.payment_intent.id, payment_intent_status=session.payment_intent.status)

if __name__ == '__main__':
    app.run(port=4242)