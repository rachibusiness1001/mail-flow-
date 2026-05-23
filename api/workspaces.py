from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

workspaces_bp = Blueprint('workspaces', __name__)

@workspaces_bp.route('/', methods=['GET'])
@jwt_required()
def get_workspaces():
    from app import Workspace, WorkspaceMember, db
    
    current_user_id = int(get_jwt_identity())
    
    # Get workspaces where the user is a member
    memberships = WorkspaceMember.query.filter_by(user_id=current_user_id).all()
    workspace_ids = [m.workspace_id for m in memberships]
    
    workspaces = Workspace.query.filter(Workspace.id.in_(workspace_ids)).all()
    
    # If no workspace exists (legacy user), create a default one
    if not workspaces:
        default_ws = Workspace(name="My Workspace", owner_id=current_user_id)
        db.session.add(default_ws)
        db.session.flush()
        
        member = WorkspaceMember(workspace_id=default_ws.id, user_id=current_user_id, role='owner')
        db.session.add(member)
        db.session.commit()
        
        workspaces = [default_ws]
        memberships = WorkspaceMember.query.filter_by(user_id=current_user_id).all()
        
    return jsonify({
        "workspaces": [
            {
                "id": ws.id,
                "name": ws.name,
                "plan": ws.plan,
                "role": next((m.role for m in memberships if m.workspace_id == ws.id), 'owner') if memberships else 'owner'
            } for ws in workspaces
        ]
    }), 200

@workspaces_bp.route('/', methods=['POST'])
@jwt_required()
def create_workspace():
    from app import Workspace, WorkspaceMember, db
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    if not data.get('name'):
        return jsonify({'error': 'Project name is required'}), 400
        
    ws = Workspace(name=data['name'], owner_id=current_user_id)
    db.session.add(ws)
    db.session.flush()
    
    member = WorkspaceMember(workspace_id=ws.id, user_id=current_user_id, role='owner')
    db.session.add(member)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "id": ws.id,
        "name": ws.name,
        "role": "owner"
    }), 201

@workspaces_bp.route('/<int:workspace_id>', methods=['GET'])
@jwt_required()
def get_workspace(workspace_id):
    from app import Workspace, WorkspaceMember
    
    current_user_id = int(get_jwt_identity())
    
    # Ensure user has access
    member = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=current_user_id).first()
    if not member:
        return jsonify({"msg": "Workspace not found or access denied"}), 404
        
    ws = Workspace.query.get(workspace_id)
    
    return jsonify({
        "id": ws.id,
        "name": ws.name,
        "plan": ws.plan,
        "role": member.role,
        "billing_status": ws.billing_status
    }), 200

@workspaces_bp.route('/<int:workspace_id>/members', methods=['GET'])
@jwt_required()
def get_workspace_members(workspace_id):
    from app import db, WorkspaceMember, User
    current_user_id = int(get_jwt_identity())
    
    # Ensure requester is member of this workspace
    requester = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=current_user_id).first()
    if not requester:
        return jsonify({"error": "Unauthorized"}), 403
        
    members = db.session.query(WorkspaceMember, User)\
        .join(User, WorkspaceMember.user_id == User.id)\
        .filter(WorkspaceMember.workspace_id == workspace_id)\
        .all()
        
    result = []
    for member, user in members:
        result.append({
            'id': member.id,
            'user_id': user.id,
            'name': user.name,
            'email': user.email,
            'role': member.role,
            'joined_at': member.joined_at.strftime('%Y-%m-%d') if member.joined_at else ''
        })
        
    return jsonify(result), 200

@workspaces_bp.route('/<int:workspace_id>/members', methods=['POST'])
@jwt_required()
def invite_workspace_member(workspace_id):
    from app import db, WorkspaceMember, User
    current_user_id = int(get_jwt_identity())
    
    # Ensure requester is owner or admin
    requester = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=current_user_id).first()
    if not requester or requester.role not in ['owner', 'admin']:
        return jsonify({"error": "Unauthorized. Workspace admin permissions required."}), 403
        
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    role = data.get('role', 'member')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User with this email is not registered on the platform."}), 404
        
    existing = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user.id).first()
    if existing:
        return jsonify({"error": "User is already a member of this workspace."}), 409
        
    member = WorkspaceMember(workspace_id=workspace_id, user_id=user.id, role=role)
    db.session.add(member)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Successfully invited {user.name or email} to the workspace."
    }), 201
