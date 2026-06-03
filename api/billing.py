import os
import stripe
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

billing_bp = Blueprint('billing', __name__)

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_12345')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_12345')

@billing_bp.route('/checkout', methods=['POST'])
@jwt_required()
def create_checkout_session():
    from app import db, Workspace
    data = request.json
    plan_id = data.get('plan_id') # e.g., price_1XYZ
    workspace_id = data.get('workspace_id')
    
    current_user_id = int(get_jwt_identity())
    
    workspace = Workspace.query.get(workspace_id)
    if not workspace or workspace.owner_id != current_user_id:
        return jsonify({"msg": "Unauthorized"}), 403
        
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': plan_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=os.environ.get('FRONTEND_URL', 'http://localhost:3000') + '/dashboard?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=os.environ.get('FRONTEND_URL', 'http://localhost:3000') + '/billing',
            client_reference_id=str(workspace.id), # Track which workspace this is for
            customer=workspace.stripe_customer_id if workspace.stripe_customer_id else None
        )
        return jsonify({"url": session.url})
    except Exception as e:
        return jsonify(error=str(e)), 403

@billing_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    from app import db, Workspace
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        return 'Invalid payload', 400
    except stripe.error.SignatureVerificationError as e:
        return 'Invalid signature', 400

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        workspace_id = session.get('client_reference_id')
        customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        
        if workspace_id:
            workspace = Workspace.query.get(int(workspace_id))
            if workspace:
                workspace.stripe_customer_id = customer_id
                workspace.stripe_subscription_id = subscription_id
                workspace.plan = 'pro' # Determine based on session/price
                workspace.billing_status = 'active'
                db.session.commit()

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        workspace = Workspace.query.filter_by(stripe_subscription_id=subscription.id).first()
        if workspace:
            workspace.plan = 'free'
            workspace.billing_status = 'canceled'
            db.session.commit()

    return jsonify(success=True), 200
