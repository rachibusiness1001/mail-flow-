from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

email_accounts_bp = Blueprint('email_accounts', __name__)

@email_accounts_bp.route('', methods=['GET'])
@jwt_required()
def get_accounts():
    uid = int(get_jwt_identity())
    from app import EmailAccount, get_active_workspace_id
    active_ws_id = get_active_workspace_id(uid)
    accounts = EmailAccount.query.filter_by(user_id=uid, workspace_id=active_ws_id).all()
    
    return jsonify([{
        'id': a.id,
        'name': a.name,
        'email': a.email,
        'smtp_host': a.smtp_host,
        'smtp_port': a.smtp_port,
        'imap_host': a.imap_host,
        'auth_type': a.auth_type,
        'daily_limit': a.daily_limit,
        'sent_today': a.sent_today,
        'is_active': a.is_active,
        'warmup_enabled': a.warmup_enabled,
        'warmup_day': a.warmup_day,
        'warmup_limit': a.warmup_limit
    } for a in accounts]), 200

@email_accounts_bp.route('', methods=['POST'])
@jwt_required()
def add_account():
    uid = int(get_jwt_identity())
    from app import db, EmailAccount, get_active_workspace_id
    active_ws_id = get_active_workspace_id(uid)
    data = request.get_json() or {}
    
    if not data.get('name') or not data.get('email'):
        return jsonify({'error': 'Name and Email are required'}), 400
        
    existing = EmailAccount.query.filter_by(email=data['email'], user_id=uid, workspace_id=active_ws_id).first()
    if existing:
        return jsonify({'error': 'An account with this email is already connected.'}), 409
        
    acc = EmailAccount(
        user_id=uid,
        workspace_id=active_ws_id,
        name=data['name'],
        email=data['email'],
        password=data.get('password', ''),
        smtp_host=data.get('smtp_host', 'smtp.gmail.com'),
        smtp_port=int(data.get('smtp_port', 587)),
        imap_host=data.get('imap_host', 'imap.gmail.com'),
        auth_type='password',
        daily_limit=int(data.get('daily_limit', 50)),
        is_active=True
    )
    db.session.add(acc)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'id': acc.id
    }), 201

@email_accounts_bp.route('/<int:id>/toggle-warmup', methods=['POST'])
@jwt_required()
def toggle_warmup(id):
    uid = int(get_jwt_identity())
    from app import db, EmailAccount, get_active_workspace_id
    active_ws_id = get_active_workspace_id(uid)
    acc = EmailAccount.query.filter_by(id=id, user_id=uid, workspace_id=active_ws_id).first_or_404()
    acc.warmup_enabled = not acc.warmup_enabled
    db.session.commit()
    
    return jsonify({
        'success': True,
        'warmup_enabled': acc.warmup_enabled
    }), 200

@email_accounts_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_account(id):
    uid = int(get_jwt_identity())
    from app import db, EmailAccount, get_active_workspace_id
    active_ws_id = get_active_workspace_id(uid)
    acc = EmailAccount.query.filter_by(id=id, user_id=uid, workspace_id=active_ws_id).first_or_404()
    db.session.delete(acc)
    db.session.commit()
    
    return jsonify({'success': True}), 200

@email_accounts_bp.route('/<int:id>/limit', methods=['PATCH'])
@jwt_required()
def update_limit(id):
    uid = int(get_jwt_identity())
    from app import db, EmailAccount, get_active_workspace_id
    active_ws_id = get_active_workspace_id(uid)
    acc = EmailAccount.query.filter_by(id=id, user_id=uid, workspace_id=active_ws_id).first_or_404()
    data = request.get_json() or {}
    new_limit = data.get('daily_limit')
    if new_limit is not None:
        acc.daily_limit = max(1, min(500, int(new_limit)))
        db.session.commit()
    return jsonify({'success': True, 'daily_limit': acc.daily_limit}), 200
