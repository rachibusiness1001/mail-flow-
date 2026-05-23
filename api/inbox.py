from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta

inbox_bp = Blueprint('inbox', __name__)

@inbox_bp.route('', methods=['GET'])
@jwt_required()
def get_threads():
    from app import db, InboxReply, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    # We join on Lead to filter by workspace ID
    replies = db.session.query(InboxReply)\
        .join(Lead, InboxReply.lead_id == Lead.id)\
        .filter(Lead.user_id == user_id, Lead.workspace_id == active_ws_id)\
        .order_by(InboxReply.received_at.desc())\
        .limit(50)\
        .all()
        
    result = []
    for r in replies:
        result.append({
            'id': r.id,
            'lead_id': r.lead_id,
            'name': r.lead.name if r.lead else r.from_email,
            'email': r.from_email,
            'subject': r.subject,
            'snippet': r.body[:100] + '...' if r.body else '',
            'time': r.received_at.strftime("%b %d"),
            'unread': not r.is_read
        })
        
    return jsonify({'threads': result}), 200

@inbox_bp.route('/<int:id>/read', methods=['POST'])
@jwt_required()
def mark_read(id):
    from app import db, InboxReply, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    reply = InboxReply.query.join(Lead).filter(InboxReply.id == id, Lead.user_id == user_id, Lead.workspace_id == active_ws_id).first_or_404()
    reply.is_read = True
    db.session.commit()
    return jsonify({'success': True}), 200

@inbox_bp.route('/thread/<int:lead_id>', methods=['GET'])
@jwt_required()
def get_thread_messages(lead_id):
    from app import db, InboxReply, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    # Ensure user owns the lead and lead belongs to workspace
    lead = Lead.query.filter_by(id=lead_id, user_id=user_id, workspace_id=active_ws_id).first_or_404()
    
    # Get all replies (sent and received) for this lead, ordered chronologically
    messages = InboxReply.query.filter_by(user_id=user_id, lead_id=lead.id).order_by(InboxReply.received_at.asc()).all()
    
    thread_data = []
    for msg in messages:
        thread_data.append({
            'id': msg.id,
            'from': msg.from_email,
            'subject': msg.subject,
            'body': msg.body,
            'received': msg.received_at.strftime('%b %d, %Y %I:%M %p'),
            'is_sent': msg.is_sent,
            'is_read': msg.is_read
        })
        
    return jsonify({'success': True, 'thread': thread_data}), 200

@inbox_bp.route('/<int:id>/reply', methods=['POST'])
@jwt_required()
def send_reply(id):
    from app import db, InboxReply, EmailAccount, Lead, send_email_smtp, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    reply = InboxReply.query.join(Lead).filter(InboxReply.id == id, Lead.user_id == user_id, Lead.workspace_id == active_ws_id).first_or_404()
    
    data = request.get_json() or {}
    body = (data.get('body') or request.form.get('body') or '').strip()
    
    if not body:
        return jsonify({'error': 'Reply body is required'}), 400
        
    if not reply.account_id:
        return jsonify({'error': 'Cannot reply: Original email account is unknown.'}), 400
        
    account = EmailAccount.query.filter_by(id=reply.account_id, user_id=user_id, workspace_id=active_ws_id, is_active=True).first()
    if not account:
        return jsonify({'error': 'The email account that received this is disconnected or inactive.'}), 400
        
    actual_thread_id = reply.thread_id
    actual_message_id = reply.message_id or reply.thread_id
    
    subject = ('Re: ' + reply.subject) if not reply.subject.lower().startswith('re:') else reply.subject
    success, err_msg, _, new_msg_id = send_email_smtp(
        account, 
        reply.from_email, 
        subject, 
        body, 
        thread_id=actual_thread_id, 
        message_id=actual_message_id,
        references=reply.msg_references
    )
    
    if success:
        new_refs = (reply.msg_references + " " + actual_message_id) if reply.msg_references else actual_message_id
        reply.msg_references = new_refs
        if reply.lead:
            reply.lead.msg_references = new_refs
            reply.lead.message_id = new_msg_id
            
        new_reply = InboxReply(
            user_id=user_id,
            lead_id=reply.lead_id,
            account_id=account.id,
            from_email=account.email,
            subject=subject,
            body=body,
            is_read=True,
            is_sent=True,
            thread_id=actual_thread_id,
            message_id=new_msg_id,
            msg_references=new_refs
        )
        db.session.add(new_reply)
        account.sent_today += 1
        reply.is_read = True
        
        if reply.lead:
            reply.lead.replied_at = datetime.utcnow()
            reply.lead.status = 'replied'
            
        db.session.commit()
        return jsonify({'success': True, 'message': 'Reply sent successfully'}), 200
    else:
        return jsonify({'error': f'Failed to send SMTP reply: {err_msg}'}), 500

@inbox_bp.route('/<int:id>/move-tag', methods=['POST'])
@jwt_required()
def move_tag(id):
    from app import db, InboxReply, InboxTag, Lead, Campaign, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    reply = InboxReply.query.join(Lead).filter(InboxReply.id == id, Lead.user_id == user_id, Lead.workspace_id == active_ws_id).first_or_404()
    data = request.get_json() or {}
    tag_id = data.get('tag_id')
    
    reply.tag_id = int(tag_id) if tag_id else None
    reply.is_read = True
    
    if tag_id:
        tag = InboxTag.query.filter_by(id=int(tag_id), user_id=user_id).first()
        if tag:
            name_lower = tag.name.lower()
            if name_lower == 'interested':
                reply.category = 'interested'
            elif name_lower in ['not interested', 'not_interested']:
                reply.category = 'not_interested'
            elif name_lower in ['out of office', 'ooo']:
                reply.category = 'ooo'
                
            if name_lower in ['interested', 'meeting booked'] and reply.lead:
                reply.lead.next_followup_at = None
                if reply.lead.status != 'replied':
                    reply.lead.status = 'replied'
                    reply.lead.replied_at = datetime.utcnow()
                    if reply.lead.campaign_id:
                        c = Campaign.query.get(reply.lead.campaign_id)
                        if c:
                            c.reply_count += 1
    else:
        reply.category = 'uncategorized'
        
    db.session.commit()
    return jsonify({'success': True}), 200

@inbox_bp.route('/<int:id>/snooze', methods=['POST'])
@jwt_required()
def snooze_reply(id):
    from app import db, InboxReply, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    reply = InboxReply.query.join(Lead).filter(InboxReply.id == id, Lead.user_id == user_id, Lead.workspace_id == active_ws_id).first_or_404()
    data = request.get_json() or {}
    days = int(data.get('days', 1))
    
    reply.snoozed_until = datetime.utcnow() + timedelta(days=days)
    reply.is_read = True
    db.session.commit()
    return jsonify({'success': True}), 200

@inbox_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_reply(id):
    from app import db, InboxReply, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    reply = InboxReply.query.join(Lead).filter(InboxReply.id == id, Lead.user_id == user_id, Lead.workspace_id == active_ws_id).first_or_404()
    db.session.delete(reply)
    db.session.commit()
    return jsonify({'success': True}), 200
