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
        
    campaign = Campaign.query.filter_by(id=data['campaign_id'], user_id=user_id, workspace_id=active_ws_id).first()
    if not campaign:
        return jsonify({'error': 'Campaign not found'}), 404
        
    leads_created = 0
    for l_data in data['leads']:
        if not l_data.get('email'):
            continue
            
        new_lead = Lead(
            user_id=user_id,
            workspace_id=active_ws_id,
            email=l_data['email'],
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
