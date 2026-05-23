from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

campaigns_bp = Blueprint('campaigns', __name__)

@campaigns_bp.route('', methods=['GET'])
@jwt_required()
def get_campaigns():
    from app import db, Campaign, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    campaigns = Campaign.query.filter_by(user_id=user_id, workspace_id=active_ws_id).order_by(Campaign.created_at.desc()).all()
    
    result = []
    for c in campaigns:
        # Calculate open rate and reply rate safely
        open_rate = (c.open_count / c.sent_count * 100) if c.sent_count > 0 else 0
        reply_rate = (c.reply_count / c.sent_count * 100) if c.sent_count > 0 else 0
        
        result.append({
            'id': c.id,
            'name': c.name,
            'status': c.status,
            'sent': c.sent_count,
            'openRate': round(open_rate, 1),
            'replyRate': round(reply_rate, 1),
            'lastActive': c.created_at.strftime("%b %d, %Y") if c.created_at else "Outreach"
        })
        
    return jsonify({'campaigns': result}), 200

@campaigns_bp.route('', methods=['POST'])
@jwt_required()
def create_campaign():
    from app import db, Campaign, FollowUp, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    data = request.get_json() or {}
    
    if not data.get('name'):
        return jsonify({'error': 'Campaign name is required'}), 400
        
    scheduled_val = data.get('scheduled_at')
    scheduled_dt = None
    if scheduled_val:
        try:
            # Handle possible datetime strings safely
            scheduled_dt = datetime.fromisoformat(scheduled_val.replace('Z', '+00:00'))
        except Exception:
            scheduled_dt = None

    new_camp = Campaign(
        user_id=user_id,
        workspace_id=active_ws_id,
        name=data['name'],
        subject_a=data.get('subject_a', 'Outreach'),
        body_a=data.get('body_a', ''),
        subject_b=data.get('subject_b', ''),
        body_b=data.get('body_b', ''),
        ab_enabled=data.get('ab_enabled', False),
        ab_split=int(data.get('ab_split', 50)),
        delay_min=int(data.get('delay_min', 1)),
        delay_max=int(data.get('delay_max', 3)),
        working_hours=data.get('working_hours', False),
        work_start=int(data.get('work_start', 9)),
        work_end=int(data.get('work_end', 18)),
        work_days=data.get('work_days', '0,1,2,3,4'),
        account_ids=data.get('account_ids', ''),
        scheduled_at=scheduled_dt,
        status='draft'
    )
    db.session.add(new_camp)
    db.session.commit()
    
    # Add follow-ups if provided
    followups = data.get('followups', [])
    for i, fu in enumerate(followups):
        db.session.add(FollowUp(
            campaign_id=new_camp.id,
            step=i + 1,
            subject=fu.get('subject', ''),
            body=fu.get('body', ''),
            wait_days=int(fu.get('delay', 2))
        ))
    db.session.commit()
    
    return jsonify({'message': 'Campaign created', 'id': new_camp.id}), 201

@campaigns_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_campaign(id):
    from app import db, Campaign, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    c = Campaign.query.filter_by(id=id, user_id=user_id, workspace_id=active_ws_id).first()
    
    if not c:
        return jsonify({'error': 'Campaign not found'}), 404
        
    steps = [{
        'id': 0,
        'type': 'email',
        'subject': c.subject_a,
        'body': c.body_a,
        'delay': 0
    }]
    
    for fu in c.followups:
        steps.append({
            'id': fu.id,
            'type': 'email',
            'subject': fu.subject,
            'body': fu.body,
            'delay': fu.wait_days
        })
        
    # Calculate open rate and reply rate safely
    open_rate = (c.open_count / c.sent_count * 100) if c.sent_count > 0 else 0
    reply_rate = (c.reply_count / c.sent_count * 100) if c.sent_count > 0 else 0
        
    return jsonify({
        'id': c.id,
        'name': c.name,
        'status': c.status,
        'sent': c.sent_count,
        'opens': c.open_count,
        'replies': c.reply_count,
        'openRate': round(open_rate, 1),
        'replyRate': round(reply_rate, 1),
        'subject_a': c.subject_a,
        'body_a': c.body_a,
        'subject_b': c.subject_b,
        'body_b': c.body_b,
        'ab_enabled': c.ab_enabled,
        'ab_split': c.ab_split,
        'delay_min': c.delay_min,
        'delay_max': c.delay_max,
        'working_hours': c.working_hours,
        'work_start': c.work_start,
        'work_end': c.work_end,
        'work_days': c.work_days,
        'account_ids': c.account_ids,
        'scheduled_at': c.scheduled_at.isoformat() if (c.scheduled_at and hasattr(c.scheduled_at, 'isoformat')) else c.scheduled_at,
        'steps': steps
    }), 200

@campaigns_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_campaign(id):
    from app import db, Campaign, FollowUp, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    c = Campaign.query.filter_by(id=id, user_id=user_id, workspace_id=active_ws_id).first_or_404()
    data = request.get_json() or {}
    
    scheduled_val = data.get('scheduled_at')
    scheduled_dt = None
    if scheduled_val:
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_val.replace('Z', '+00:00'))
        except Exception:
            scheduled_dt = None

    c.name = data.get('name', c.name)
    c.subject_a = data.get('subject_a', c.subject_a)
    c.body_a = data.get('body_a', c.body_a)
    c.subject_b = data.get('subject_b', c.subject_b)
    c.body_b = data.get('body_b', c.body_b)
    c.ab_enabled = data.get('ab_enabled', c.ab_enabled)
    c.ab_split = int(data.get('ab_split', c.ab_split))
    c.delay_min = int(data.get('delay_min', c.delay_min))
    c.delay_max = int(data.get('delay_max', c.delay_max))
    c.working_hours = data.get('working_hours', c.working_hours)
    c.work_start = int(data.get('work_start', c.work_start))
    c.work_end = int(data.get('work_end', c.work_end))
    c.work_days = data.get('work_days', c.work_days)
    c.account_ids = data.get('account_ids', c.account_ids)
    c.scheduled_at = scheduled_dt
    
    # Delete existing followups and re-insert
    FollowUp.query.filter_by(campaign_id=id).delete()
    
    followups = data.get('followups', [])
    for i, fu in enumerate(followups):
        db.session.add(FollowUp(
            campaign_id=id,
            step=i + 1,
            subject=fu.get('subject', ''),
            body=fu.get('body', ''),
            wait_days=int(fu.get('delay', 2))
        ))
    db.session.commit()
    
    return jsonify({'message': 'Campaign updated'}), 200

@campaigns_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_campaign(id):
    from app import db, Campaign, FollowUp, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    c = Campaign.query.filter_by(id=id, user_id=user_id, workspace_id=active_ws_id).first()
    if not c:
        return jsonify({'error': 'Not found'}), 404
        
    # Delete followups first to avoid constraint failures
    FollowUp.query.filter_by(campaign_id=id).delete()
    db.session.delete(c)
    db.session.commit()
    return jsonify({'message': 'Campaign deleted'}), 200

@campaigns_bp.route('/<int:id>/start', methods=['POST'])
@jwt_required()
def start_campaign(id):
    from app import db, Campaign, EmailAccount, Lead, running_campaigns, run_campaign, get_active_workspace_id
    import threading
    
    uid = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(uid)
    campaign = Campaign.query.filter_by(id=id, user_id=uid, workspace_id=active_ws_id).first_or_404()
    if campaign.status == 'running':
        return jsonify({'error': 'Campaign is already running'}), 400
        
    if not EmailAccount.query.filter_by(user_id=uid, workspace_id=active_ws_id, is_active=True).first():
        return jsonify({'error': 'Please connect an active email account first'}), 400
        
    pending = Lead.query.filter_by(campaign_id=id, status='pending', user_id=uid, workspace_id=active_ws_id).count()
    if pending == 0:
        return jsonify({'error': 'No pending leads in this campaign. Please import some leads first!'}), 400
        
    running_campaigns[id] = True
    campaign.status = 'running'
    db.session.commit()
    
    threading.Thread(target=run_campaign, args=(id, uid), daemon=True).start()
    return jsonify({'message': f'Campaign started! {pending} leads queued.'}), 200

@campaigns_bp.route('/<int:id>/pause', methods=['POST'])
@jwt_required()
def pause_campaign(id):
    from app import db, Campaign, running_campaigns, get_active_workspace_id
    uid = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(uid)
    campaign = Campaign.query.filter_by(id=id, user_id=uid, workspace_id=active_ws_id).first_or_404()
    running_campaigns[id] = False
    campaign.status = 'paused'
    db.session.commit()
    return jsonify({'message': 'Campaign paused successfully'}), 200
