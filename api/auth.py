from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import datetime

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400

    from app import db, User
    user = User.query.filter_by(email=data['email']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    user.last_login = datetime.datetime.utcnow()
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    from app import WorkspaceMember
    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    role = member.role if member else 'owner'
    return jsonify({
        'token': access_token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'plan': user.plan,
            'is_admin': user.is_admin or False,
            'role': role
        }
    }), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    from app import User
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    from app import WorkspaceMember
    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    role = member.role if member else 'owner'
    return jsonify({
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'plan': user.plan,
            'is_admin': user.is_admin or False,
            'role': role
        }
    }), 200

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Name, email and password required'}), 400

    from app import db, User
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 409

    new_user = User(
        name=data['name'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        last_login=datetime.datetime.utcnow()
    )
    db.session.add(new_user)
    db.session.commit()

    access_token = create_access_token(identity=str(new_user.id))
    from app import WorkspaceMember
    member = WorkspaceMember.query.filter_by(user_id=new_user.id).first()
    role = member.role if member else 'owner'
    return jsonify({
        'token': access_token,
        'user': {
            'id': new_user.id,
            'name': new_user.name,
            'email': new_user.email,
            'plan': new_user.plan,
            'is_admin': new_user.is_admin or False,
            'role': role
        }
    }), 201

@auth_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = get_jwt_identity()
    from app import db, Campaign, Lead, InboxReply, get_active_workspace_id
    active_ws_id = get_active_workspace_id(user_id)
    
    campaigns = Campaign.query.filter_by(user_id=user_id, workspace_id=active_ws_id).all()
    total_sent = sum(c.sent_count for c in campaigns)
    total_opens = sum(c.open_count for c in campaigns)
    total_replies = sum(c.reply_count for c in campaigns)
    
    open_rate = (total_opens / total_sent * 100) if total_sent > 0 else 0
    reply_rate = (total_replies / total_sent * 100) if total_sent > 0 else 0
    
    # Active campaigns count (running status)
    active_campaigns = sum(1 for c in campaigns if c.status == 'running')
    
    # Unread inbox count
    unread_replies = db.session.query(db.func.count(InboxReply.id))\
        .join(Lead, InboxReply.lead_id == Lead.id)\
        .join(Campaign, Lead.campaign_id == Campaign.id)\
        .filter(Campaign.user_id == user_id, Campaign.workspace_id == active_ws_id, InboxReply.is_read == False)\
        .scalar() or 0

    # Recent Leads
    recent_leads = Lead.query.filter_by(user_id=user_id, workspace_id=active_ws_id).order_by(Lead.id.desc()).limit(5).all()
    recent_leads_list = [{
        'id': l.id,
        'name': l.name,
        'email': l.email,
        'status': l.status,
        'campaign': l.campaign.name if l.campaign else 'None'
    } for l in recent_leads]

    return jsonify({
        'emailsSent': total_sent,
        'openRate': round(open_rate, 1),
        'replyRate': round(reply_rate, 1),
        'activeCampaigns': active_campaigns,
        'unreadInboxCount': unread_replies,
        'recentLeads': recent_leads_list
    }), 200

@auth_bp.route('/spam-check', methods=['POST'])
@jwt_required()
def spam_check():
    from app import check_spam_score
    data = request.get_json() or {}
    score, found = check_spam_score(data.get('subject',''), data.get('body',''))
    return jsonify({'score': score, 'words': found}), 200

@auth_bp.route('/spintax-preview', methods=['POST'])
@jwt_required()
def spintax_preview():
    from app import process_spintax
    data = request.get_json() or {}
    text = data.get('text','')
    return jsonify({'previews': [process_spintax(text) for _ in range(3)]}), 200

@auth_bp.route('/profile/update-info', methods=['POST'])
@jwt_required()
def profile_update_info():
    from app import db, User
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name cannot be empty!'}), 400
        
    user.name = name
    db.session.commit()
    return jsonify({'success': True, 'name': name}), 200

@auth_bp.route('/profile/change-password', methods=['POST'])
@jwt_required()
def profile_change_password():
    from app import db, User
    from werkzeug.security import generate_password_hash, check_password_hash
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    
    data = request.get_json() or {}
    current_pass = data.get('current_password', '')
    new_pass = data.get('new_password', '')
    
    if user.password_hash and not check_password_hash(user.password_hash, current_pass):
        return jsonify({'error': 'Current password is incorrect!'}), 400
        
    if len(new_pass) < 8:
        return jsonify({'error': 'New password must be at least 8 characters!'}), 400
        
    user.password_hash = generate_password_hash(new_pass)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Password changed successfully!'}), 200



