from flask import Blueprint

api_bp = Blueprint('api_v1', __name__, url_prefix='/api/v1')

from .auth import auth_bp
from .workspaces import workspaces_bp
from .billing import billing_bp
from .campaigns import campaigns_bp
from .leads import leads_bp
from .inbox import inbox_bp
from .admin import admin_bp
from .email_accounts import email_accounts_bp

api_bp.register_blueprint(auth_bp, url_prefix='/auth')
api_bp.register_blueprint(workspaces_bp, url_prefix='/workspaces')
api_bp.register_blueprint(billing_bp, url_prefix='/billing')
api_bp.register_blueprint(campaigns_bp, url_prefix='/campaigns')
api_bp.register_blueprint(leads_bp, url_prefix='/leads')
api_bp.register_blueprint(inbox_bp, url_prefix='/inbox')
api_bp.register_blueprint(admin_bp, url_prefix='/admin')
api_bp.register_blueprint(email_accounts_bp, url_prefix='/email-accounts')
