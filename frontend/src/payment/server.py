#! /usr/bin/env python3.6

"""
server.py
Stripe Sample.
Python 3.6 or newer required.
"""
from flask import Flask, jsonify, request

import stripe
# This test secret API key is a placeholder. Don't include personal details in requests with this key.
# To see your test secret API key embedded in code samples, sign in to your Stripe account.
# You can also find your test secret API key at https://dashboard.stripe.com/test/apikeys.
stripe.api_key = 'sk_test_51Sc2PZAUGvw6c2mChftPrMFzBUH5JXwVYIjINqGleNysBXzQaBcey4GcQQVROE0oDdGgo6myoDpkAvFHeexbbHk300ZEsaWb4n'
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