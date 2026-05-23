from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

admin_bp = Blueprint('admin', __name__)

def verify_is_admin():
    from app import User
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or not user.is_admin:
        return False
    return True

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    if not verify_is_admin():
        return jsonify({'error': 'Unauthorized. Admin access required.'}), 403
        
    from app import User, EmailAccount, Lead
    total_users = User.query.count()
    active_accounts = EmailAccount.query.filter_by(is_active=True).count()
    total_sent = Lead.query.filter(Lead.status.in_(['sent', 'sent_followup_pending', 'replied'])).count()
    
    return jsonify({
        'totalUsers': total_users,
        'activeAccounts': active_accounts,
        'emailsSent': total_sent
    }), 200

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    if not verify_is_admin():
        return jsonify({'error': 'Unauthorized. Admin access required.'}), 403
        
    from app import User
    users = User.query.order_by(User.id.desc()).all()
    user_list = [{
        'id': u.id,
        'name': u.name,
        'email': u.email,
        'plan': u.plan,
        'is_active': u.is_active,
        'is_admin': u.is_admin,
        'created_at': u.created_at.strftime('%Y-%m-%d') if u.created_at else ''
    } for u in users]
    
    return jsonify({'users': user_list}), 200

@admin_bp.route('/users/<int:id>/toggle', methods=['POST'])
@jwt_required()
def toggle_user(id):
    if not verify_is_admin():
        return jsonify({'error': 'Unauthorized. Admin access required.'}), 403
        
    from app import db, User
    u = User.query.get_or_404(id)
    u.is_active = not u.is_active
    db.session.commit()
    
    return jsonify({
        'success': True,
        'is_active': u.is_active
    }), 200
