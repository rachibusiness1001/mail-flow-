from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import csv
import io
import json

campaigns_bp = Blueprint('campaigns', __name__)

def _campaign_query_for_user(campaign_id, user_id, active_ws_id):
    from app import Campaign
    from sqlalchemy import or_
    return Campaign.query.filter(
        Campaign.id == campaign_id,
        Campaign.user_id == user_id,
        or_(Campaign.workspace_id == active_ws_id, Campaign.workspace_id.is_(None))
    ).first()

def _ensure_campaign_workspace(campaign, active_ws_id):
    if campaign.workspace_id is None:
        campaign.workspace_id = active_ws_id

@campaigns_bp.route('', methods=['GET'])
@jwt_required()
def get_campaigns():
    from app import db, Campaign, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    from sqlalchemy import or_
    campaigns = Campaign.query.filter(
        Campaign.user_id == user_id,
        or_(Campaign.workspace_id == active_ws_id, Campaign.workspace_id.is_(None))
    ).order_by(Campaign.created_at.desc()).all()
    
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
            'send_limit': c.send_limit,
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
        send_limit=int(data.get('send_limit') or 0),
        scheduled_at=scheduled_dt,
        status='draft'
    )
    db.session.add(new_camp)
    db.session.commit()
    
    # Add follow-ups if provided
    followups = data.get('followups', [])
    for i, fu in enumerate(followups):
        target_date_val = fu.get('target_date')
        target_dt = None
        if target_date_val:
            try:
                target_dt = datetime.fromisoformat(target_date_val.replace('Z', '+00:00'))
            except Exception:
                pass
        db.session.add(FollowUp(
            campaign_id=new_camp.id,
            step=i + 1,
            subject=fu.get('subject', ''),
            body=fu.get('body', ''),
            wait_days=int(fu.get('delay', 2)),
            target_date=target_dt
        ))
    db.session.commit()
    
    return jsonify({'message': 'Campaign created', 'id': new_camp.id}), 201

@campaigns_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_campaign(id):
    from app import db, Campaign, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    c = _campaign_query_for_user(id, user_id, active_ws_id)
    
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
            'step': fu.step,
            'subject': fu.subject,
            'body': fu.body,
            'delay': fu.wait_days,
            'target_date': fu.target_date.isoformat() if hasattr(fu.target_date, 'isoformat') else fu.target_date
        })
        
    # Calculate open rate and reply rate safely
    open_rate = (c.open_count / c.sent_count * 100) if c.sent_count > 0 else 0
    reply_rate = (c.reply_count / c.sent_count * 100) if c.sent_count > 0 else 0
    
    from app import Lead
    from datetime import datetime
    followups_pending = Lead.query.filter_by(campaign_id=c.id, status='sent_followup_pending').count()
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    sent_today = Lead.query.filter(
        Lead.campaign_id == c.id,
        Lead.sent_at >= today_start
    ).count()
    
    followups_today = Lead.query.filter(
        Lead.campaign_id == c.id, 
        Lead.status == 'sent_followup_pending',
        Lead.next_followup_at <= datetime.utcnow()
    ).count()
        
    return jsonify({
        'id': c.id,
        'name': c.name,
        'status': c.status,
        'sent': c.sent_count,
        'sent_today': sent_today,
        'failed': c.failed_count,
        'total_leads': c.total_leads,
        'pending': c.total_leads - c.sent_count - c.failed_count,
        'followups_pending': followups_pending,
        'followups_today': followups_today,
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
        'send_limit': c.send_limit,
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
    if 'send_limit' in data:
        c.send_limit = int(data.get('send_limit') or 0)
    c.scheduled_at = scheduled_dt
    
    # Delete existing followups and re-insert
    FollowUp.query.filter_by(campaign_id=id).delete()
    
    followups = data.get('followups', [])
    for i, fu in enumerate(followups):
        target_date_val = fu.get('target_date')
        target_dt = None
        if target_date_val:
            try:
                target_dt = datetime.fromisoformat(target_date_val.replace('Z', '+00:00'))
            except Exception:
                pass
        db.session.add(FollowUp(
            campaign_id=id,
            step=i + 1,
            subject=fu.get('subject', ''),
            body=fu.get('body', ''),
            wait_days=int(fu.get('delay', 2)),
            target_date=target_dt
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
        
    # Delete leads and upload history first to avoid constraint failures
    from app import Lead, UploadHistory, InboxReply
    UploadHistory.query.filter_by(campaign_id=id).delete(synchronize_session=False)
    FollowUp.query.filter_by(campaign_id=id).delete(synchronize_session=False)
    
    lead_ids = [l.id for l in Lead.query.filter_by(campaign_id=id).all()]
    if lead_ids:
        InboxReply.query.filter(InboxReply.lead_id.in_(lead_ids)).update({'lead_id': None}, synchronize_session=False)
        
    Lead.query.filter_by(campaign_id=id).delete(synchronize_session=False)
    
    db.session.delete(c)
    db.session.commit()
    return jsonify({'message': 'Campaign deleted'}), 200

@campaigns_bp.route('/<int:id>/leads', methods=['POST'])
@jwt_required()
def upload_campaign_leads(id):
    from app import db, Lead, UploadHistory, get_active_workspace_id

    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    campaign = _campaign_query_for_user(id, user_id, active_ws_id)

    if not campaign:
        return jsonify({'error': 'Campaign not found'}), 404

    _ensure_campaign_workspace(campaign, active_ws_id)

    leads_created = 0
    upload_history = None

    if 'file' in request.files and request.files['file'].filename:
        file = request.files['file']
        upload_history = UploadHistory(
            user_id=user_id,
            campaign_id=campaign.id,
            filename=file.filename,
            total=0,
            invalid=0
        )
        db.session.add(upload_history)
        db.session.flush()

        stream = io.StringIO(file.stream.read().decode('utf-8', errors='ignore'))
        reader = csv.DictReader(stream)
        reader.fieldnames = [f.lower().strip() for f in (reader.fieldnames or [])]

        for row in reader:
            email_val = (
                row.get('email')
                or row.get('emails')
                or row.get('email address')
                or row.get('mail')
                or ''
            ).strip()
            if not email_val or '@' not in email_val:
                continue

            first_name = (row.get('first_name') or row.get('first name') or '').strip()
            last_name = (row.get('last_name') or row.get('last name') or '').strip()
            name = (row.get('name') or f'{first_name} {last_name}'.strip()).strip()
            company = (row.get('company') or row.get('organization') or '').strip()

            db.session.add(Lead(
                user_id=user_id,
                workspace_id=active_ws_id,
                email=email_val,
                name=name,
                company=company,
                campaign_id=campaign.id,
                upload_id=upload_history.id,
                status='pending'
            ))
            leads_created += 1

        upload_history.total = leads_created
    elif request.form.get('leads'):
        try:
            leads_data = json.loads(request.form.get('leads'))
        except (TypeError, json.JSONDecodeError):
            return jsonify({'error': 'Invalid leads data'}), 400

        if not isinstance(leads_data, list) or len(leads_data) == 0:
            return jsonify({'error': 'Missing leads data'}), 400

        for l_data in leads_data:
            if not l_data.get('email'):
                continue

            db.session.add(Lead(
                user_id=user_id,
                workspace_id=active_ws_id,
                email=l_data['email'],
                name=l_data.get('name', f"{l_data.get('first_name', '')} {l_data.get('last_name', '')}".strip()),
                company=l_data.get('company', ''),
                campaign_id=campaign.id,
                status='pending'
            ))
            leads_created += 1
    else:
        return jsonify({'error': 'Missing file or leads data'}), 400

    if leads_created == 0:
        if upload_history:
            db.session.rollback()
        return jsonify({'error': 'No valid leads found in upload'}), 400

    campaign.total_leads += leads_created
    db.session.commit()

    return jsonify({'message': f'Successfully imported {leads_created} leads.'}), 201

@campaigns_bp.route('/<int:id>/start', methods=['POST'])
@jwt_required()
def start_campaign(id):
    from app import db, Campaign, EmailAccount, Lead, running_campaigns, run_campaign, get_active_workspace_id
    import threading
    
    uid = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(uid)
    campaign = _campaign_query_for_user(id, uid, active_ws_id)
    if not campaign:
        return jsonify({'error': 'Campaign not found'}), 404
    _ensure_campaign_workspace(campaign, active_ws_id)
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
    campaign = _campaign_query_for_user(id, uid, active_ws_id)
    if not campaign:
        return jsonify({'error': 'Campaign not found'}), 404
    _ensure_campaign_workspace(campaign, active_ws_id)
    running_campaigns[id] = False
    campaign.status = 'paused'
    db.session.commit()
    return jsonify({'message': 'Campaign paused successfully'}), 200

@campaigns_bp.route('/instant_send', methods=['POST'])
@jwt_required()
def instant_send():
    from app import EmailAccount, send_email_smtp, db, get_active_workspace_id
    user_id = int(get_jwt_identity())
    data = request.json
    account_id = data.get('account_id')
    to_email = data.get('to_email')
    subject = data.get('subject')
    body = data.get('body')

    # Use the same workspace resolution as other routes (falls back to default if header missing)
    active_ws_id = get_active_workspace_id(user_id)
    if not active_ws_id:
        return jsonify({'success': False, 'error': 'No workspace found for user'}), 400

    try:
        account_id = int(account_id)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Invalid account ID'}), 400

    account = EmailAccount.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        return jsonify({'success': False, 'error': 'Account not found or unauthorized'}), 403

    success, error, thread_id, msg_id = send_email_smtp(account, to_email, subject, body)
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'error': error}), 400
