from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

leads_bp = Blueprint('leads', __name__)

@leads_bp.route('', methods=['GET'])
@jwt_required()
def get_leads():
    from app import db, Lead, Campaign, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    # Simple pagination or limit for now
    leads = Lead.query.filter_by(user_id=user_id, workspace_id=active_ws_id).order_by(Lead.id.desc()).limit(100).all()
    
    result = []
    for l in leads:
        result.append({
            'id': l.id,
            'name': l.name,
            'email': l.email,
            'company': l.company,
            'status': l.status,
            'campaign': l.campaign.name if l.campaign else 'None'
        })
        
    return jsonify({'leads': result}), 200

@leads_bp.route('/uploads', methods=['GET'])
@jwt_required()
def get_uploads():
    from app import db, UploadHistory, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    
    # Get all uploads for this user, ordered by most recent first
    uploads = UploadHistory.query.filter_by(user_id=user_id).order_by(UploadHistory.uploaded_at.desc()).all()
    
    result = []
    for u in uploads:
        result.append({
            'id': u.id,
            'filename': u.filename,
            'total': u.total,
            'invalid': u.invalid,
            'valid': u.total - u.invalid,
            'uploaded_at': u.uploaded_at.strftime('%b %d, %Y %I:%M %p') if u.uploaded_at else '',
            'campaign_id': u.campaign_id,
            'campaign': u.campaign.name if u.campaign else 'Uncampaigned'
        })
    
    return jsonify({'uploads': result}), 200

@leads_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_lead(id):
    from app import db, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    lead = Lead.query.filter_by(id=id, user_id=user_id, workspace_id=active_ws_id).first()
    
    if not lead:
        return jsonify({'error': 'Lead not found'}), 404
    db.session.delete(lead)
    db.session.commit()
    return jsonify({'message': 'Lead deleted'}), 200

@leads_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_leads():
    from app import db, Lead, Campaign, get_active_workspace_id
    user_id = int(get_jwt_identity())
    active_ws_id = get_active_workspace_id(user_id)
    data = request.get_json()
    
    # Expected data: { campaign_id: 1, leads: [{email, first_name, last_name, company}, ...] }
    if not data or not data.get('campaign_id') or not data.get('leads'):
        return jsonify({'error': 'Missing campaign_id or leads data'}), 400
        
    from sqlalchemy import or_
    campaign = Campaign.query.filter(
        Campaign.id == data['campaign_id'],
        Campaign.user_id == user_id,
        or_(Campaign.workspace_id == active_ws_id, Campaign.workspace_id.is_(None))
    ).first()
    if not campaign:
        return jsonify({'error': 'Campaign not found'}), 404
    if campaign.workspace_id is None:
        campaign.workspace_id = active_ws_id
        
    leads_created = 0
    duplicate_count = 0
    for l_data in data['leads']:
        if not l_data.get('email'):
            continue
            
        email_val = l_data['email'].strip().lower()
        
        # Check for duplicates across ALL campaigns for this user
        if Lead.query.filter_by(email=email_val, user_id=user_id).first():
            duplicate_count += 1
            continue
            
        new_lead = Lead(
            user_id=user_id,
            workspace_id=active_ws_id,
            email=email_val,
            name=l_data.get('name', f"{l_data.get('first_name', '')} {l_data.get('last_name', '')}".strip()),
            company=l_data.get('company', ''),
            campaign_id=campaign.id,
            status='pending'
        )
        db.session.add(new_lead)
        leads_created += 1
        
    campaign.total_leads += leads_created
    db.session.commit()
    
    return jsonify({'message': f'Successfully imported {leads_created} leads.'}), 201

@leads_bp.route('/uploads/<int:upload_id>', methods=['DELETE'])
@jwt_required()
def delete_upload(upload_id):
    from app import db, UploadHistory, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    
    upload = UploadHistory.query.filter_by(id=upload_id, user_id=user_id).first()
    
    if not upload:
        return jsonify({'error': 'Upload not found'}), 404
    
    # Delete all leads associated with this upload
    leads_to_delete = Lead.query.filter_by(upload_id=upload_id).all()
    for lead in leads_to_delete:
        db.session.delete(lead)
    
    # Delete the upload record
    db.session.delete(upload)
    db.session.commit()
    
    return jsonify({'message': 'Upload and associated leads deleted'}), 200

@leads_bp.route('/uploads/<int:upload_id>/export', methods=['GET'])
@jwt_required()
def export_upload(upload_id):
    from app import db, Lead, get_active_workspace_id
    user_id = int(get_jwt_identity())
    
    # Verify user owns this upload by checking the leads
    leads = Lead.query.filter_by(upload_id=upload_id).all()
    
    if not leads:
        return jsonify({'error': 'Upload not found or no leads to export'}), 404
    
    # Verify user owns these leads
    if leads and leads[0].user_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    result = []
    for lead in leads:
        result.append({
            'id': lead.id,
            'name': lead.name,
            'email': lead.email,
            'company': lead.company,
            'status': lead.status,
            'campaign': lead.campaign.name if lead.campaign else 'None'
        })
    
    return jsonify({'leads': result}), 200

