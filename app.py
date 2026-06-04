import sys
if __name__ == '__main__':
    sys.modules['app'] = sys.modules['__main__']

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, Response, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import smtplib, imaplib, email as email_lib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import csv, io, threading, time, random, uuid, re, socket, json, secrets, os
import urllib.request, urllib.parse, urllib.error
from functools import wraps
from dotenv import load_dotenv
load_dotenv()  # .env file se variables load karo

from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Allow cross-origin for Next.js frontend

# ─── CONFIG (env variables se load hoga, warna default use karega) ───
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
# Render PostgreSQL URL fix (postgres:// → postgresql://)
_db_url = os.environ.get('DATABASE_URL', 'sqlite:///mailflow.db')
if _db_url.startswith('postgres://'):
    _db_url = _db_url.replace('postgres://', 'postgresql://', 1)

# Dynamic fallback to SQLite if remote server is unreachable (sandbox/offline environment)
if 'sqlite' not in _db_url:
    try:
        import urllib.parse
        import socket
        parsed = urllib.parse.urlparse(_db_url)
        # Try quick connection check (2 second timeout)
        s = socket.create_connection((parsed.hostname, parsed.port or 5432), timeout=2)
        s.close()
    except Exception:
        print("[WARNING] Remote database is unreachable. Falling back to local SQLite database.")
        _db_url = 'sqlite:///mailflow.db'

app.config['SQLALCHEMY_DATABASE_URI'] = _db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', app.config['SECRET_KEY'])
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

jwt = JWTManager(app)

# ─── GOOGLE OAUTH CONFIG (env se load hoga) ───
GOOGLE_CLIENT_ID     = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
APP_BASE_URL         = os.environ.get('APP_BASE_URL', 'http://localhost:5000').strip().rstrip('/')
FRONTEND_URL         = os.environ.get('FRONTEND_URL', 'http://localhost:3000').strip().rstrip('/')
GOOGLE_REDIRECT_URI  = APP_BASE_URL + '/auth/google/callback'
GMAIL_REDIRECT_URI   = APP_BASE_URL + '/accounts/google/callback'
print(f"[OAUTH DEBUG] APP_BASE_URL={APP_BASE_URL!r}")
print(f"[OAUTH DEBUG] GOOGLE_REDIRECT_URI={GOOGLE_REDIRECT_URI!r}")
print(f"[OAUTH DEBUG] GMAIL_REDIRECT_URI={GMAIL_REDIRECT_URI!r}")

db = SQLAlchemy(app)

# ─────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────

class User(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(200), default='')
    email        = db.Column(db.String(200), unique=True, nullable=False)
    password_hash= db.Column(db.String(500), default='')
    google_id    = db.Column(db.String(200), default='')
    avatar       = db.Column(db.String(500), default='')
    plan         = db.Column(db.String(50), default='free')
    is_admin     = db.Column(db.Boolean, default=False)
    is_active    = db.Column(db.Boolean, default=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    last_login   = db.Column(db.DateTime, nullable=True)
    # Default workspace relation can be queried via WorkspaceMember

class Workspace(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(200), nullable=False)
    owner_id     = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    # Stripe Billing fields
    stripe_customer_id   = db.Column(db.String(100), default='')
    stripe_subscription_id = db.Column(db.String(100), default='')
    plan         = db.Column(db.String(50), default='free') # free, pro, agency
    billing_status = db.Column(db.String(50), default='active')
    billing_cycle_end = db.Column(db.DateTime, nullable=True)

class WorkspaceMember(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey('workspace.id'), nullable=False)
    user_id      = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role         = db.Column(db.String(50), default='member') # owner, admin, member
    joined_at    = db.Column(db.DateTime, default=datetime.utcnow)

class EmailAccount(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)   # Legacy, to be migrated
    workspace_id  = db.Column(db.Integer, db.ForeignKey('workspace.id'), nullable=True)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(200), nullable=False)
    password      = db.Column(db.String(200), default='')
    smtp_host     = db.Column(db.String(200), default='smtp.gmail.com')
    smtp_port     = db.Column(db.Integer, default=587)
    imap_host     = db.Column(db.String(200), default='imap.gmail.com')
    auth_type     = db.Column(db.String(20), default='password')
    access_token  = db.Column(db.Text, default='')
    refresh_token = db.Column(db.Text, default='')
    token_expiry  = db.Column(db.DateTime, nullable=True)
    daily_limit   = db.Column(db.Integer, default=50)
    sent_today    = db.Column(db.Integer, default=0)
    is_active     = db.Column(db.Boolean, default=True)
    last_reset    = db.Column(db.Date, default=datetime.today)
    warmup_enabled= db.Column(db.Boolean, default=False)
    warmup_day    = db.Column(db.Integer, default=1)
    warmup_limit  = db.Column(db.Integer, default=5)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

class Campaign(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)    # Legacy, to be migrated
    workspace_id = db.Column(db.Integer, db.ForeignKey('workspace.id'), nullable=True)
    name         = db.Column(db.String(200), nullable=False)
    subject_a    = db.Column(db.String(500), nullable=False)
    body_a       = db.Column(db.Text, nullable=False)
    subject_b    = db.Column(db.String(500), default='')
    body_b       = db.Column(db.Text, default='')
    ab_enabled   = db.Column(db.Boolean, default=False)
    ab_split     = db.Column(db.Integer, default=50)
    sent_a       = db.Column(db.Integer, default=0)
    sent_b       = db.Column(db.Integer, default=0)
    open_a       = db.Column(db.Integer, default=0)
    open_b       = db.Column(db.Integer, default=0)
    reply_a      = db.Column(db.Integer, default=0)
    reply_b      = db.Column(db.Integer, default=0)
    status       = db.Column(db.String(50), default='draft')
    delay_min    = db.Column(db.Integer, default=1)
    delay_max    = db.Column(db.Integer, default=3)
    total_leads  = db.Column(db.Integer, default=0)
    sent_count   = db.Column(db.Integer, default=0)
    failed_count = db.Column(db.Integer, default=0)
    open_count   = db.Column(db.Integer, default=0)
    reply_count  = db.Column(db.Integer, default=0)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    # Working hours
    working_hours   = db.Column(db.Boolean, default=False)
    work_start      = db.Column(db.Integer, default=9)   # 9 AM
    work_end        = db.Column(db.Integer, default=18)  # 6 PM
    # Scheduled start
    scheduled_at    = db.Column(db.DateTime, nullable=True)
    # Working days (comma separated: 0=Mon,1=Tue,...,6=Sun)
    work_days       = db.Column(db.String(20), default='0,1,2,3,4')  # Mon-Fri default
    # Account to use (comma separated IDs for rotation)
    account_ids     = db.Column(db.String(500), default='')
    leads           = db.relationship('Lead', backref='campaign', lazy=True)
    followups    = db.relationship('FollowUp', backref='campaign', lazy=True, order_by='FollowUp.step')

class FollowUp(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=False)
    step        = db.Column(db.Integer, default=1)
    subject     = db.Column(db.String(500), nullable=False)
    body        = db.Column(db.Text, nullable=False)
    wait_days   = db.Column(db.Integer, default=2)

class Lead(db.Model):
    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Legacy, to be migrated
    workspace_id     = db.Column(db.Integer, db.ForeignKey('workspace.id'), nullable=True)
    email            = db.Column(db.String(200), nullable=False)
    name             = db.Column(db.String(200), default='')
    company          = db.Column(db.String(200), default='')
    phone            = db.Column(db.String(50), default='')
    campaign_id      = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=True)
    upload_id        = db.Column(db.Integer, db.ForeignKey('upload_history.id'), nullable=True)
    account_id       = db.Column(db.Integer, db.ForeignKey('email_account.id'), nullable=True)
    status           = db.Column(db.String(50), default='pending')
    ab_variant       = db.Column(db.String(1), default='')
    current_step     = db.Column(db.Integer, default=0)
    next_followup_at = db.Column(db.DateTime, nullable=True)
    sent_at          = db.Column(db.DateTime, nullable=True)
    opened_at        = db.Column(db.DateTime, nullable=True)
    replied_at       = db.Column(db.DateTime, nullable=True)
    open_count       = db.Column(db.Integer, default=0)
    thread_id        = db.Column(db.String(200), default='')
    message_id       = db.Column(db.String(200), default='')
    msg_references   = db.Column(db.Text, default='')
    error_msg        = db.Column(db.String(500), default='')
    tracking_id      = db.Column(db.String(100), default='')
    email_valid      = db.Column(db.Boolean, default=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

class InboxTag(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    user_id  = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name     = db.Column(db.String(100), nullable=False)
    color    = db.Column(db.String(20), default='#6366f1')
    position = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class InboxReply(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lead_id     = db.Column(db.Integer, db.ForeignKey('lead.id'), nullable=True)
    account_id  = db.Column(db.Integer, db.ForeignKey('email_account.id'), nullable=True)
    tag_id      = db.Column(db.Integer, db.ForeignKey('inbox_tag.id'), nullable=True)
    from_email  = db.Column(db.String(200), default='')
    subject     = db.Column(db.String(500), default='')
    body        = db.Column(db.Text, default='')
    category    = db.Column(db.String(50), default='uncategorized')
    is_read     = db.Column(db.Boolean, default=False)
    received_at = db.Column(db.DateTime, default=datetime.utcnow)
    thread_id   = db.Column(db.String(200), default='')
    message_id  = db.Column(db.String(200), default='')
    msg_references = db.Column(db.Text, default='')
    is_sent     = db.Column(db.Boolean, default=False)
    
    draft_body  = db.Column(db.Text, default='')
    snoozed_until = db.Column(db.DateTime, nullable=True)
    
    lead        = db.relationship('Lead', backref='replies')
    account     = db.relationship('EmailAccount', backref='replies')
    tag         = db.relationship('InboxTag', backref='replies')

class Attachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reply_id = db.Column(db.Integer, db.ForeignKey('inbox_reply.id'))
    filename = db.Column(db.String(255))
    filepath = db.Column(db.String(500))
    mime_type = db.Column(db.String(100))
    size = db.Column(db.Integer)
    
    reply = db.relationship('InboxReply', backref=db.backref('attachments', lazy=True, cascade="all, delete-orphan"))

class Settings(db.Model):
    id    = db.Column(db.Integer, primary_key=True)
    key   = db.Column(db.String(100), unique=True)
    value = db.Column(db.String(500))

class UploadHistory(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaign.id"), nullable=True)
    filename    = db.Column(db.String(300), default="")
    total       = db.Column(db.Integer, default=0)
    invalid     = db.Column(db.Integer, default=0)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    campaign    = db.relationship("Campaign", backref="uploads")

running_campaigns = {}

SPAM_WORDS = ['free','winner','won','prize','click here','buy now','order now','limited time',
              'act now','urgent','congratulations','guaranteed','no obligation','risk free',
              'earn money','make money','cash','cheap','discount','save big','amazing',
              'incredible','100% free','bonus','double your','extra income','get paid',
              'million dollars','opportunity','dear friend','promotion','special offer',
              'clearance','lowest price']
DISPOSABLE_DOMAINS = ['mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
                      'yopmail.com','trashmail.com','dispostable.com','maildrop.cc',
                      'spam4.me','tempr.email']

# ─────────────────────────────────────────
# API BLUEPRINT REGISTRATION
# ─────────────────────────────────────────
from api import api_bp
app.register_blueprint(api_bp)

# ─────────────────────────────────────────
def get_active_workspace_id(user_id):
    ws_id = request.headers.get('X-Workspace-ID')
    if ws_id:
        try:
            ws_id_int = int(ws_id)
            # Verify membership
            member = WorkspaceMember.query.filter_by(workspace_id=ws_id_int, user_id=user_id).first()
            if member:
                return ws_id_int
        except Exception:
            pass
            
    # Fallback to the user's first/default workspace
    first_member = WorkspaceMember.query.filter_by(user_id=user_id).first()
    if first_member:
        return first_member.workspace_id
        
    # If no membership exists, create a default one
    default_ws = Workspace(name="My Workspace", owner_id=user_id)
    db.session.add(default_ws)
    db.session.flush()
    
    member = WorkspaceMember(workspace_id=default_ws.id, user_id=user_id, role='owner')
    db.session.add(member)
    db.session.commit()
    return default_ws.id

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login_page'))
        user = User.query.get(session['user_id'])
        if not user or not user.is_admin:
            flash('Admin access required!', 'error')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated

def current_user_id():
    return session.get('user_id')

# ─────────────────────────────────────────
# GOOGLE OAUTH HELPERS
# ─────────────────────────────────────────

def google_get_tokens(code, redirect_uri):
    data = urllib.parse.urlencode({
        'code': code, 'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': redirect_uri, 'grant_type': 'authorization_code'
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def google_get_userinfo(access_token):
    req = urllib.request.Request('https://www.googleapis.com/oauth2/v2/userinfo')
    req.add_header('Authorization', f'Bearer {access_token}')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def refresh_access_token(refresh_token):
    data = urllib.parse.urlencode({
        'client_id': GOOGLE_CLIENT_ID, 'client_secret': GOOGLE_CLIENT_SECRET,
        'refresh_token': refresh_token, 'grant_type': 'refresh_token'
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def get_valid_token(account):
    if account.auth_type != 'oauth':
        return None
    if account.token_expiry and datetime.utcnow() >= account.token_expiry - timedelta(minutes=5):
        try:
            tokens = refresh_access_token(account.refresh_token)
            account.access_token = tokens.get('access_token', account.access_token)
            if 'expires_in' in tokens:
                account.token_expiry = datetime.utcnow() + timedelta(seconds=tokens['expires_in'])
            db.session.commit()
        except:
            pass
    return account.access_token

# ─────────────────────────────────────────
# EMAIL HELPERS
# ─────────────────────────────────────────

def get_setting(key, default=''):
    s = Settings.query.filter_by(key=key).first()
    return s.value if s else default

def set_setting(key, value):
    s = Settings.query.filter_by(key=key).first()
    if s:
        s.value = str(value)
    else:
        db.session.add(Settings(key=key, value=str(value)))
    db.session.commit()

def get_available_account(user_id):
    today = datetime.today().date()
    for acc in EmailAccount.query.filter_by(is_active=True, user_id=user_id).all():
        if acc.last_reset != today:
            acc.sent_today = 0
            acc.last_reset = today
            db.session.commit()
        limit = acc.warmup_limit if acc.warmup_enabled else acc.daily_limit
        if acc.sent_today < limit:
            return acc
    return None

def send_via_gmail_api(access_token, to_email, subject, body, thread_id=None, message_id=None, tracking_id=None, references=None):
    try:
        import base64
        from email.mime.text import MIMEText as _MIMEText
        # Build raw email
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['To']      = to_email
        msg['From']    = 'me'
        generated_msg_id = email_lib.utils.make_msgid()
        msg['Message-ID'] = generated_msg_id
        
        if message_id:
            msg['In-Reply-To'] = message_id
            if references:
                msg['References'] = f"{references} {message_id}".strip()
            else:
                msg['References'] = message_id
        elif thread_id:
            # Fallback for old records
            msg['In-Reply-To'] = thread_id
            msg['References']  = thread_id
            
        if tracking_id:
            pixel     = f'<img src="{APP_BASE_URL}/track/open/{tracking_id}" width="1" height="1" style="display:none"/>'
            html_body = body.replace("\n", "<br>") + pixel
            msg.attach(MIMEText(body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
        else:
            msg.attach(MIMEText(body, 'plain'))
        raw     = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        payload = {'raw': raw}
        if thread_id:
            payload['threadId'] = thread_id
        req = urllib.request.Request(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            data=json.dumps(payload).encode('utf-8'),
            method='POST'
        )
        req.add_header('Authorization', f'Bearer {access_token}')
        req.add_header('Content-Type', 'application/json; charset=utf-8')
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
        return True, '', result.get('threadId', ''), generated_msg_id
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        return False, f'HTTP {e.code}: {error_body}', '', ''
    except Exception as e:
        return False, str(e), '', ''

def send_email_smtp(account, to_email, subject, body, thread_id=None, message_id=None, tracking_id=None, references=None):
    if account.auth_type == 'oauth':
        token = get_valid_token(account)
        if token:
            return send_via_gmail_api(token, to_email, subject, body, thread_id, message_id, tracking_id, references)
        return False, 'OAuth token expired', '', ''
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = account.email
        msg['To']      = to_email
        generated_msg_id = email_lib.utils.make_msgid()
        msg['Message-ID'] = generated_msg_id
        
        if message_id:
            msg['In-Reply-To'] = message_id
            if references:
                msg['References'] = f"{references} {message_id}".strip()
            else:
                msg['References'] = message_id
        elif thread_id:
            msg['In-Reply-To'] = thread_id
            msg['References']  = thread_id
            
        if tracking_id:
            pixel = f'<img src="{APP_BASE_URL}/track/open/{tracking_id}" width="1" height="1" style="display:none"/>'
            html_body = body.replace('\n', '<br>') + pixel
            msg.attach(MIMEText(body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
        else:
            msg.attach(MIMEText(body, 'plain'))
        with smtplib.SMTP(account.smtp_host, account.smtp_port) as server:
            server.ehlo(); server.starttls()
            server.login(account.email, account.password)
            server.sendmail(account.email, to_email, msg.as_string())
        return True, '', '', generated_msg_id
    except Exception as e:
        return False, str(e), '', ''

def process_spintax(text):
    pattern = re.compile(r'\{([^{}]+)\}')
    while pattern.search(text):
        text = pattern.sub(lambda m: random.choice(m.group(1).split('|')), text)
    return text

def personalize(text, lead):
    text = process_spintax(text)
    name_parts = (lead.name or '').strip().split()
    first_name = name_parts[0] if name_parts else 'there'
    last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
    
    text = text.replace('{{name}}', lead.name or 'there')
    text = text.replace('{{first_name}}', first_name)
    text = text.replace('{{last_name}}', last_name)
    text = text.replace('{{email}}', lead.email or '')
    text = text.replace('{{company}}', lead.company or '')
    return text

def check_spam_score(subject, body):
    text = (subject + ' ' + body).lower()
    found = [w for w in SPAM_WORDS if w.lower() in text]
    return min(len(found) * 10, 100), found

def verify_email(email_addr):
    try:
        if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email_addr):
            return False, 'Invalid format'
        domain = email_addr.split('@')[1].lower()
        if domain in DISPOSABLE_DOMAINS:
            return False, 'Disposable email'
        socket.gethostbyname(domain)
        return True, 'Valid'
    except:
        return False, 'Domain not found'

def categorize_reply(body):
    b = body.lower()
    if any(w in b for w in ['interested','sounds good','tell me more','lets connect',"let's connect",'schedule','meeting','call','yes','absolutely','would love']):
        return 'interested'
    if any(w in b for w in ['out of office','on vacation','away from','annual leave','auto-reply','automatic reply']):
        return 'ooo'
    if any(w in b for w in ['not interested','unsubscribe','remove me','stop emailing','no thanks','not relevant']):
        return 'not_interested'
    return 'other'

# ─────────────────────────────────────────
# CAMPAIGN RUNNER (background thread)
# ─────────────────────────────────────────

def run_campaign(campaign_id, user_id):
    with app.app_context():
        campaign = Campaign.query.get(campaign_id)
        if not campaign: return

        # Schedule check - wait until scheduled_at
        if campaign.scheduled_at and datetime.utcnow() < campaign.scheduled_at:
            wait_secs = (campaign.scheduled_at - datetime.utcnow()).total_seconds()
            time.sleep(min(wait_secs, 3600))  # max 1 hour wait per cycle

        campaign.status = 'running'
        db.session.commit()
        leads = Lead.query.filter_by(campaign_id=campaign_id, status='pending', user_id=user_id).all()
        total = len(leads)
        for i, lead in enumerate(leads):
            if not running_campaigns.get(campaign_id, False):
                c = Campaign.query.get(campaign_id)
                if c: c.status = 'paused'
                db.session.commit()
                return
            campaign = Campaign.query.get(campaign_id)
            if campaign.status != 'running': return

            # Working hours + days check
            if campaign.working_hours:
                now_ist  = datetime.utcnow() + timedelta(hours=5, minutes=30)
                now_hour = now_ist.hour
                now_day  = now_ist.weekday()  # 0=Mon, 6=Sun
                allowed_days = [int(d) for d in (campaign.work_days or '0,1,2,3,4').split(',') if d.strip()]
                if now_day not in allowed_days:
                    time.sleep(300)
                    continue
                if now_hour < campaign.work_start or now_hour >= campaign.work_end:
                    time.sleep(300)
                    continue

            # Multi-Account Sender Rotation (Round-Robin)
            try:
                if campaign.account_ids:
                    acc_id_list = [int(x) for x in campaign.account_ids.split(',') if x.strip()]
                    if acc_id_list:
                        chosen_acc_id = acc_id_list[i % len(acc_id_list)]
                        account = EmailAccount.query.filter_by(id=chosen_acc_id, is_active=True, user_id=user_id).first()
                        if account:
                            today = datetime.today().date()
                            if account.last_reset != today:
                                account.sent_today = 0
                                account.last_reset = today
                                db.session.commit()
                            limit = account.warmup_limit if account.warmup_enabled else account.daily_limit
                            if account.sent_today >= limit:
                                account = get_available_account(user_id)
                        else:
                            account = get_available_account(user_id)
                    else:
                        account = get_available_account(user_id)
                else:
                    account = get_available_account(user_id)
            except Exception as e:
                print(f"[Rotation Error] {e}")
                account = get_available_account(user_id)
            if not account:
                campaign.status = 'paused'
                db.session.commit()
                flash('No email accounts available — campaign paused.', 'warning')
                return
            variant = 'A'
            if campaign.ab_enabled and campaign.subject_b:
                variant = 'A' if (i / total * 100) < campaign.ab_split else 'B'
            subject = personalize(campaign.subject_a if variant == 'A' else campaign.subject_b, lead)
            body    = personalize(campaign.body_a    if variant == 'A' else campaign.body_b,    lead)
            tracking_id = str(uuid.uuid4())
            
            # Check for existing thread with this recipient
            existing_thread = InboxReply.query.filter(
                InboxReply.user_id == lead.user_id,
                InboxReply.from_email == lead.email
            ).order_by(InboxReply.received_at.desc()).first()
            
            thread_id_to_use = None
            message_id_to_use = None
            if existing_thread:
                thread_id_to_use = existing_thread.thread_id
                message_id_to_use = existing_thread.message_id or existing_thread.thread_id
            
            success, error, gmail_thread_id, rfc_message_id = send_email_smtp(account, lead.email, subject, body, thread_id=thread_id_to_use, message_id=message_id_to_use, tracking_id=tracking_id)
            if success:
                lead.status      = 'sent_followup_pending' if campaign.followups else 'sent'
                lead.sent_at     = datetime.utcnow()
                lead.current_step= 1
                lead.tracking_id = tracking_id
                lead.account_id  = account.id
                # Use existing thread if available, otherwise use returned thread_id
                final_thread_id = thread_id_to_use or gmail_thread_id or str(uuid.uuid4())
                lead.thread_id   = final_thread_id
                lead.message_id  = rfc_message_id
                lead.ab_variant  = variant
                
                # Save to timeline
                db.session.add(InboxReply(
                    user_id=lead.user_id,
                    lead_id=lead.id,
                    account_id=account.id,
                    from_email=account.email,
                    subject=subject,
                    body=body,
                    is_read=True,
                    is_sent=True,
                    thread_id=final_thread_id,
                    message_id=rfc_message_id
                ))
                
                account.sent_today  += 1
                campaign.sent_count += 1
                if variant == 'A': campaign.sent_a += 1
                else:              campaign.sent_b += 1
                if campaign.followups:
                    lead.next_followup_at = datetime.utcnow() + timedelta(days=campaign.followups[0].wait_days)
                # warmup day progress
                if account.warmup_enabled:
                    account.warmup_day += 1
                    account.warmup_limit = min(account.warmup_limit + 2, account.daily_limit)
            else:
                lead.status    = 'failed'
                lead.error_msg = error
                campaign.failed_count += 1
            db.session.commit()
            time.sleep(random.randint(campaign.delay_min * 60, campaign.delay_max * 60))
        campaign.status = 'completed'
        db.session.commit()
        running_campaigns.pop(campaign_id, None)

def run_followups_bg():
    while True:
        try:
            with app.app_context():
                now = datetime.utcnow()
                pending = Lead.query.filter(
                    Lead.status == 'sent_followup_pending',
                    Lead.next_followup_at <= now
                ).all()
                for lead in pending:
                    if not lead.campaign_id: continue
                    campaign = Campaign.query.get(lead.campaign_id)
                    followups = FollowUp.query.filter_by(campaign_id=lead.campaign_id).order_by(FollowUp.step).all()
                    idx = lead.current_step - 1
                    if idx >= len(followups):
                        lead.status = 'sent'
                        db.session.commit()
                        continue
                    fu      = followups[idx]
                    if not lead.account_id or not lead.message_id:
                        print(f"[Follow-up Skipped] Lead {lead.email} missing account_id or message_id")
                        lead.status = 'failed'
                        lead.error_msg = 'Thread-Safety: Missing account_id or message_id'
                        db.session.commit()
                        continue
                        
                    account = EmailAccount.query.get(lead.account_id)
                    if not account or not account.is_active: 
                        print(f"[Follow-up Skipped] Lead {lead.email} account missing or inactive")
                        continue
                        
                    tracking_id = str(uuid.uuid4())
                    success, error, _, new_msg_id = send_email_smtp(
                        account, lead.email,
                        'Re: ' + personalize(campaign.subject_a, lead),
                        personalize(fu.body, lead),
                        thread_id=lead.thread_id, 
                        message_id=lead.message_id, 
                        tracking_id=tracking_id,
                        references=lead.msg_references
                    )
                    print(f"[Follow-up] Account: {account.email} | Thread: {lead.thread_id} | Success: {success}")
                    if success:
                        if lead.msg_references:
                            lead.msg_references += " " + lead.message_id
                        else:
                            lead.msg_references = lead.message_id
                        lead.message_id = new_msg_id
                        
                        db.session.add(InboxReply(
                            user_id=lead.user_id,
                            lead_id=lead.id,
                            account_id=account.id,
                            from_email=account.email,
                            subject='Re: ' + personalize(campaign.subject_a, lead),
                            body=personalize(fu.body, lead),
                            is_read=True,
                            is_sent=True,
                            thread_id=lead.thread_id,
                            message_id=new_msg_id,
                            msg_references=lead.msg_references
                        ))
                        
                        lead.current_step   += 1
                        account.sent_today  += 1
                        campaign.sent_count += 1
                        if lead.current_step - 1 < len(followups):
                            lead.next_followup_at = datetime.utcnow() + timedelta(days=followups[lead.current_step - 1].wait_days)
                        else:
                            lead.status           = 'sent'
                            lead.next_followup_at = None
                        db.session.commit()
        except Exception as e:
            print(f'[followup_bg error] {e}')
        time.sleep(60)

def fetch_gmail_api_replies(acc):
    """Fetch replies for OAuth Gmail accounts using Gmail API"""
    try:
        token = get_valid_token(acc)
        if not token:
            return
        import base64
        # Fetch ALL messages (read + unread) with pagination
        all_messages = []
        page_token = None
        for _ in range(3):  # max 3 pages = 60 messages
            url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=20'
            if page_token:
                url += f'&pageToken={page_token}'
            req = urllib.request.Request(url)
            req.add_header('Authorization', f'Bearer {token}')
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            all_messages.extend(data.get('messages', []))
            page_token = data.get('nextPageToken')
            if not page_token:
                break

        for msg_ref in all_messages:
            msg_id = msg_ref['id']
            # Get full message
            req2 = urllib.request.Request(
                f'https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full'
            )
            req2.add_header('Authorization', f'Bearer {token}')
            with urllib.request.urlopen(req2) as resp2:
                msg_data = json.loads(resp2.read())

            headers = {h['name'].lower(): h['value'] for h in msg_data.get('payload', {}).get('headers', [])}
            from_email = email_lib.utils.parseaddr(headers.get('from', ''))[1]
            to_email   = email_lib.utils.parseaddr(headers.get('to', ''))[1]
            subject    = headers.get('subject', '')
            rfc_message_id = headers.get('message-id', '')
            gmail_thread_id = msg_data.get('threadId', '')

            # Check if this email is a reply or a sent message from native Gmail
            is_sent = False
            target_email = from_email
            if from_email.lower() == acc.email.lower():
                is_sent = True
                target_email = to_email

            # Skip if already saved (dedup using message-id or legacy msg_id check)
            exists = False
            if rfc_message_id:
                exists = InboxReply.query.filter_by(message_id=rfc_message_id, user_id=acc.user_id).first() is not None
            if not exists:
                # Fallback to old dedup logic
                exists = InboxReply.query.filter_by(thread_id=msg_id, user_id=acc.user_id).first() is not None
            
            if exists:
                continue

            # Extract body and attachments
            payload = msg_data.get('payload', {})
            def extract_body_and_attachments(part):
                body = ''
                attachments = []
                mime_type = part.get('mimeType', '')
                if mime_type == 'text/plain' and part.get('body', {}).get('data'):
                    import base64
                    body += base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
                    
                filename = part.get('filename')
                if filename and part.get('body', {}).get('attachmentId'):
                    attachments.append({
                        'filename': filename,
                        'mime_type': mime_type,
                        'size': part.get('body', {}).get('size', 0),
                        'attachmentId': part['body']['attachmentId']
                    })
                    
                for p in part.get('parts', []):
                    b, a = extract_body_and_attachments(p)
                    if b and not body: body = b
                    attachments.extend(a)
                return body, attachments

            body, raw_attachments = extract_body_and_attachments(payload)
            if not body:
                body = msg_data.get('snippet', '')

            # ONLY fetch replies from campaign leads — skip random inbox emails
            lead = Lead.query.filter_by(email=target_email, user_id=acc.user_id).first()
            
            # Bounce Tracking (Local/Free)
            subj_lower = subject.lower()
            if not is_sent and ('mailer-daemon' in from_email.lower() or 'postmaster' in from_email.lower() or 'undeliverable' in subj_lower or 'delivery status' in subj_lower):
                bounced_email = None
                match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', body)
                if match:
                    bounced_email = match.group(0).lower()
                    lead = Lead.query.filter_by(email=bounced_email, user_id=acc.user_id).first()
                if lead:
                    lead.status = 'failed'
                    lead.error_msg = 'Bounced'
                    lead.next_followup_at = None
                    db.session.commit()
                continue
                
            if not lead:
                # Not a campaign lead — skip this email
                continue

            category = categorize_reply(body) if not is_sent else 'uncategorized'
            if lead and not is_sent:
                lead.replied_at = datetime.utcnow()
                lead.status = 'replied'
                if lead.campaign_id:
                    c = Campaign.query.get(lead.campaign_id)
                    if c:
                        c.reply_count += 1
                        if lead.ab_variant == 'A': c.reply_a += 1
                        elif lead.ab_variant == 'B': c.reply_b += 1

            reply = InboxReply(
                user_id=acc.user_id,
                lead_id=lead.id if lead else None,
                account_id=acc.id,
                from_email=from_email,
                subject=subject,
                body=body[:5000],
                category=category,
                thread_id=gmail_thread_id,
                message_id=rfc_message_id,
                is_sent=is_sent
            )
            db.session.add(reply)
            db.session.flush() # To get reply.id

            from werkzeug.utils import secure_filename
            attach_dir = os.path.join(app.root_path, 'static', 'attachments')
            os.makedirs(attach_dir, exist_ok=True)
            for raw_att in raw_attachments:
                try:
                    att_req = urllib.request.Request(f'https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}/attachments/{raw_att["attachmentId"]}')
                    att_req.add_header('Authorization', f'Bearer {token}')
                    with urllib.request.urlopen(att_req) as att_resp:
                        att_data_json = json.loads(att_resp.read())
                        import base64
                        file_data = base64.urlsafe_b64decode(att_data_json['data'])
                        
                        safe_filename = secure_filename(raw_att['filename'])
                        unique_filename = f"{reply.id}_{int(time.time())}_{safe_filename}"
                        filepath = os.path.join(attach_dir, unique_filename)
                        with open(filepath, 'wb') as f:
                            f.write(file_data)
                            
                        db.session.add(Attachment(
                            reply_id=reply.id,
                            filename=raw_att['filename'],
                            filepath=f'/static/attachments/{unique_filename}',
                            mime_type=raw_att['mime_type'],
                            size=raw_att['size']
                        ))
                except Exception as e:
                    print(f"Error downloading attachment: {e}")
            
            db.session.commit()

            # Save gmail msg_id for dedup
            # (We do NOT mark as read in Gmail — let user manage their Gmail separately)

    except Exception as e:
        print(f'[gmail_api fetch error] {acc.email}: {e}')


def fetch_replies_bg():
    while True:
        try:
            with app.app_context():
                for acc in EmailAccount.query.filter_by(is_active=True).all():
                    if acc.auth_type == 'oauth':
                        # Gmail API for OAuth accounts
                        fetch_gmail_api_replies(acc)
                    else:
                        # IMAP for App Password accounts
                        if not acc.password:
                            continue
                        try:
                            mail = imaplib.IMAP4_SSL(acc.imap_host)
                            mail.login(acc.email, acc.password)
                            mail.select('inbox')
                            _, data = mail.search(None, 'UNSEEN')
                            for num in data[0].split()[-20:]:
                                _, msg_data = mail.fetch(num, '(RFC822)')
                                msg        = email_lib.message_from_bytes(msg_data[0][1])
                                from_email = email_lib.utils.parseaddr(msg['From'])[1]
                                subject    = msg.get('Subject', '')
                                to_email = email_lib.utils.parseaddr(msg.get('To', ''))[1]
                                rfc_message_id = msg.get('Message-ID', '')
                                thread_id = msg.get('Thread-Index', '')
                                
                                is_sent = False
                                target_email = from_email
                                if from_email.lower() == acc.email.lower():
                                    is_sent = True
                                    target_email = to_email

                                exists = False
                                if rfc_message_id:
                                    exists = InboxReply.query.filter_by(message_id=rfc_message_id, user_id=acc.user_id).first() is not None
                                if not exists:
                                    exists = InboxReply.query.filter_by(from_email=from_email, subject=subject, user_id=acc.user_id).first() is not None
                                
                                if exists:
                                    continue

                                body = ''
                                attachments = []
                                if msg.is_multipart():
                                    for part in msg.walk():
                                        content_disposition = str(part.get("Content-Disposition"))
                                        if "attachment" in content_disposition or "inline" in content_disposition:
                                            filename = part.get_filename()
                                            if filename:
                                                data = part.get_payload(decode=True)
                                                if data:
                                                    attachments.append({
                                                        'filename': filename,
                                                        'mime_type': part.get_content_type(),
                                                        'data': data,
                                                        'size': len(data)
                                                    })
                                        elif part.get_content_type() == 'text/plain' and not body:
                                            body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                else:
                                    body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
                                    
                                lead = Lead.query.filter_by(email=target_email, user_id=acc.user_id).first()
                                if not lead:
                                    continue
                                    
                                category = categorize_reply(body) if not is_sent else 'uncategorized'
                                if lead and not is_sent:
                                    lead.replied_at = datetime.utcnow()
                                    lead.status = 'replied'
                                    if lead.campaign_id:
                                        c = Campaign.query.get(lead.campaign_id)
                                        if c:
                                            c.reply_count += 1
                                            if lead.ab_variant == 'A': c.reply_a += 1
                                            elif lead.ab_variant == 'B': c.reply_b += 1
                                    lead.next_followup_at = None

                                reply = InboxReply(
                                    user_id=acc.user_id,
                                    lead_id=lead.id if lead else None,
                                    account_id=acc.id,
                                    from_email=from_email,
                                    subject=subject,
                                    body=body[:5000],
                                    category=category,
                                    message_id=rfc_message_id,
                                    thread_id=thread_id,
                                    is_sent=is_sent
                                )
                                db.session.add(reply)
                                db.session.flush()

                                from werkzeug.utils import secure_filename
                                attach_dir = os.path.join(app.root_path, 'static', 'attachments')
                                os.makedirs(attach_dir, exist_ok=True)
                                for att in attachments:
                                    safe_filename = secure_filename(att['filename'])
                                    unique_filename = f"{reply.id}_{int(time.time())}_{safe_filename}"
                                    filepath = os.path.join(attach_dir, unique_filename)
                                    with open(filepath, 'wb') as f:
                                        f.write(att['data'])
                                        
                                    db.session.add(Attachment(
                                        reply_id=reply.id,
                                        filename=att['filename'],
                                        filepath=f'/static/attachments/{unique_filename}',
                                        mime_type=att['mime_type'],
                                        size=att['size']
                                    ))
                                db.session.commit()
                            mail.logout()
                        except Exception as e:
                            print(f'[imap error] {acc.email}: {e}')
        except Exception as e:
            print(f'[fetch_replies_bg error] {e}')
        time.sleep(300)  # Check every 5 minutes

# ─────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────

@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))

@app.route('/auth/login', methods=['POST'])
def auth_login():
    data     = request.json
    email    = data.get('email', '').lower().strip()
    password = data.get('password', '')
    user     = User.query.filter_by(email=email).first()
    
    # ✅ FIX: Check if user exists AND password_hash is not empty before checking
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({'success': False, 'message': 'Invalid email or password'})
    if not user.is_active:
        return jsonify({'success': False, 'message': 'Account deactivated'})
    session['user_id']    = user.id
    session['user_name']  = user.name
    session['user_email'] = user.email
    session['user_avatar']= user.avatar
    session['is_admin']   = user.is_admin
    user.last_login = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True})

@app.route('/auth/register', methods=['POST'])
def auth_register():
    data     = request.json
    name     = data.get('name', '').strip()
    email    = data.get('email', '').lower().strip()
    password = data.get('password', '')
    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'All fields required'})
    if len(password) < 8:
        return jsonify({'success': False, 'message': 'Password must be 8+ characters'})
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already registered'})
    user = User(name=name, email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    session['user_id']    = user.id
    session['user_name']  = user.name
    session['user_email'] = user.email
    session['is_admin']   = user.is_admin
    return jsonify({'success': True})

# ─── GOOGLE LOGIN OAUTH ───

@app.route('/auth/google')
def auth_google():
    if not GOOGLE_CLIENT_ID:
        flash('Google login not configured. Use email/password.', 'warning')
        return redirect(url_for('login_page'))
    state = secrets.token_urlsafe(16)
    session['oauth_state'] = state
    params = urllib.parse.urlencode({
        'client_id': GOOGLE_CLIENT_ID, 'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code', 'scope': 'openid email profile',
        'state': state, 'access_type': 'offline', 'prompt': 'select_account'
    })
    return redirect(f'https://accounts.google.com/o/oauth2/v2/auth?{params}')

@app.route('/auth/google/callback')
def auth_google_callback():
    if request.args.get('state') != session.get('oauth_state'):
        flash('Invalid state', 'error')
        return redirect(url_for('login_page'))
    code = request.args.get('code')
    if not code:
        flash('Google login cancelled', 'error')
        return redirect(url_for('login_page'))
    try:
        tokens    = google_get_tokens(code, GOOGLE_REDIRECT_URI)
        user_info = google_get_userinfo(tokens['access_token'])
        email     = user_info.get('email', '').lower()
        name      = user_info.get('name', '')
        avatar    = user_info.get('picture', '')
        google_id = user_info.get('id', '')
        user = User.query.filter_by(email=email).first()
        is_new_user = False
        if not user:
            user = User(name=name, email=email, google_id=google_id, avatar=avatar)
            db.session.add(user)
            is_new_user = True
        else:
            user.google_id = google_id
            user.avatar    = avatar
            if not user.name: user.name = name
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # ✅ ENSURE WORKSPACE IS CREATED FOR GOOGLE AUTH USERS
        member = WorkspaceMember.query.filter_by(user_id=user.id).first()
        if not member:
            # Create default workspace for new Google auth users
            ws = Workspace(name="My Workspace", owner_id=user.id)
            db.session.add(ws)
            db.session.flush()
            member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role='owner')
            db.session.add(member)
            db.session.commit()
        
        session['user_id']    = user.id
        session['user_name']  = user.name
        session['user_email'] = user.email
        session['user_avatar']= avatar
        session['is_admin']   = user.is_admin
        
        from flask_jwt_extended import create_access_token
        access_token = create_access_token(identity=str(user.id))
        
        # ✅ FIX: Send only token to avoid URL length issues
        # Frontend will fetch user info via /auth/me API
        import urllib.parse
        params = urllib.parse.urlencode({
            'token': access_token
        })
        return redirect(f'{FRONTEND_URL}/login?{params}')
    except Exception as e:
        import urllib.parse
        error_msg = urllib.parse.quote_plus(str(e))
        return redirect(f'{FRONTEND_URL}/login?error={error_msg}')

# ─── GMAIL ACCOUNT OAUTH ───

@app.route('/accounts/google/connect')
def gmail_connect():
    token = request.args.get('token')
    if token:
        try:
            from flask_jwt_extended import decode_token
            decoded = decode_token(token)
            session['user_id'] = int(decoded['sub'])
        except Exception as e:
            return redirect(f'{FRONTEND_URL}/email-accounts?error=Invalid+session+token')
            
    if 'user_id' not in session:
        return redirect(f'{FRONTEND_URL}/login')
        
    if not GOOGLE_CLIENT_ID:
        return redirect(f'{FRONTEND_URL}/email-accounts?error=Google+OAuth+not+configured')
        
    state = secrets.token_urlsafe(16)
    session['gmail_state'] = state
    params = urllib.parse.urlencode({
        'client_id': GOOGLE_CLIENT_ID, 'redirect_uri': GMAIL_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
        'state': state, 'access_type': 'offline', 'prompt': 'consent'
    })
    return redirect(f'https://accounts.google.com/o/oauth2/v2/auth?{params}')

@app.route('/accounts/google/callback')
@login_required
def gmail_callback():
    if request.args.get('state') != session.get('gmail_state'):
        return redirect(f'{FRONTEND_URL}/email-accounts?error=Invalid+state')
    code = request.args.get('code')
    if not code:
        return redirect(f'{FRONTEND_URL}/email-accounts?error=Gmail+connection+cancelled')
    try:
        tokens    = google_get_tokens(code, GMAIL_REDIRECT_URI)
        user_info = google_get_userinfo(tokens['access_token'])
        email     = user_info.get('email', '')
        name      = user_info.get('name', email)
        uid       = current_user_id()
        # Get the user's default workspace
        default_member = WorkspaceMember.query.filter_by(user_id=uid).first()
        ws_id = default_member.workspace_id if default_member else None
        existing  = EmailAccount.query.filter_by(email=email, user_id=uid).first()
        if existing:
            existing.access_token = tokens.get('access_token', '')
            existing.refresh_token= tokens.get('refresh_token', existing.refresh_token)
            existing.token_expiry = datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 3600))
            existing.auth_type    = 'oauth'
            existing.is_active    = True
            if ws_id and not existing.workspace_id:
                existing.workspace_id = ws_id
            db.session.commit()
        else:
            db.session.add(EmailAccount(
                user_id=uid, workspace_id=ws_id, name=name, email=email, auth_type='oauth',
                access_token=tokens.get('access_token', ''),
                refresh_token=tokens.get('refresh_token', ''),
                token_expiry=datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 3600)),
                daily_limit=50
            ))
            db.session.commit()
        return redirect(f'{FRONTEND_URL}/email-accounts?success=true')
    except Exception as e:
        import urllib.parse
        err_msg = urllib.parse.quote_plus(str(e))
        return redirect(f'{FRONTEND_URL}/email-accounts?error={err_msg}')

# ─────────────────────────────────────────
# MAIN ROUTES
# ─────────────────────────────────────────

@app.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/dashboard')
@login_required
def dashboard():
    uid   = current_user_id()
    camps = Campaign.query.filter_by(user_id=uid).order_by(Campaign.created_at.desc()).all()
    total_sent    = Lead.query.filter(Lead.user_id == uid, Lead.status.in_(['sent','sent_followup_pending','replied'])).count()
    total_opens   = sum(c.open_count for c in camps)
    total_replies = sum(c.reply_count for c in camps)
    open_rate  = round(total_opens  / total_sent * 100, 1) if total_sent > 0 else 0
    reply_rate = round(total_replies/ total_sent * 100, 1) if total_sent > 0 else 0
    return render_template('dashboard.html',
        total_leads   = Lead.query.filter_by(user_id=uid).count(),
        total_sent    = total_sent,
        total_pending = Lead.query.filter_by(user_id=uid, status='pending').count(),
        total_failed  = Lead.query.filter_by(user_id=uid, status='failed').count(),
        total_replied = Lead.query.filter_by(user_id=uid, status='replied').count(),
        accounts      = EmailAccount.query.filter_by(user_id=uid, is_active=True).count(),
        unread_replies= InboxReply.query.filter_by(user_id=uid, is_read=False).count(),
        recent_campaigns = camps[:5],
        open_rate=open_rate, reply_rate=reply_rate,
        user_name  = session.get('user_name', ''),
        user_avatar= session.get('user_avatar', '')
    )

# ─── LEADS ───

@app.route('/leads')
@login_required
def leads():
    uid           = current_user_id()
    page          = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', '')
    search        = request.args.get('q', '')
    query = Lead.query.filter_by(user_id=uid)
    if status_filter: query = query.filter_by(status=status_filter)
    if search:
        query = query.filter(Lead.email.contains(search) | Lead.name.contains(search) | Lead.company.contains(search))
    return render_template('leads.html',
        leads          = query.order_by(Lead.created_at.desc()).paginate(page=page, per_page=50),
        status_filter  = status_filter, search=search,
        campaigns      = Campaign.query.filter_by(user_id=uid).order_by(Campaign.created_at.desc()).all(),
        upload_history = UploadHistory.query.filter_by(user_id=uid).order_by(UploadHistory.uploaded_at.desc()).limit(10).all()
    )

@app.route('/leads/upload', methods=['POST'])
@login_required
def upload_leads():
    uid         = current_user_id()
    file        = request.files.get('file')
    campaign_id = request.form.get('campaign_id')
    verify      = request.form.get('verify_emails') == 'on'

    # File check
    if not file or file.filename == '':
        flash('Please select a CSV file!', 'error')
        return redirect(url_for('leads'))

    # Campaign mandatory check
    if not campaign_id:
        flash('Please select a campaign before importing leads!', 'error')
        return redirect(url_for('leads'))

    # Verify campaign belongs to this user
    camp = Campaign.query.filter_by(id=int(campaign_id), user_id=uid).first()
    if not camp:
        flash('Invalid campaign!', 'error')
        return redirect(url_for('leads'))

    try:
        stream = io.StringIO(file.stream.read().decode('utf-8', errors='ignore'))
        reader = csv.DictReader(stream)
        reader.fieldnames = [f.lower().strip() for f in (reader.fieldnames or [])]
        count = invalid = duplicate = 0
        
        # First, create the upload history record to get the ID
        upload_history = UploadHistory(
            user_id=uid,
            campaign_id=int(campaign_id),
            filename=file.filename,
            total=0,
            invalid=0
        )
        db.session.add(upload_history)
        db.session.commit()  # Commit to get the ID
        
        for row in reader:
            email_val = (row.get('email') or row.get('emails') or row.get('email address') or row.get('mail') or '').strip()
            if not email_val or '@' not in email_val: continue
            if Lead.query.filter_by(email=email_val, user_id=uid).first():
                duplicate += 1
                continue
            valid = True
            if verify:
                valid, _ = verify_email(email_val)
                if not valid:
                    invalid += 1
                    continue
            db.session.add(Lead(
                user_id=uid, email=email_val,
                name=row.get('name','').strip(), company=row.get('company','').strip(),
                phone=row.get('phone','').strip(),
                campaign_id=int(campaign_id),
                upload_id=upload_history.id,
                status='pending', email_valid=valid
            ))
            count += 1

        # Update campaign total
        camp.total_leads = Lead.query.filter_by(campaign_id=int(campaign_id), user_id=uid).count()
        
        # Update upload history with final counts
        upload_history.total = count
        upload_history.invalid = invalid

        db.session.commit()

        msg = f'{count} leads imported to campaign "{camp.name}"!'
        if duplicate: msg += f' ({duplicate} duplicates skipped)'
        if invalid:   msg += f' ({invalid} invalid emails removed)'
        flash(msg, 'success')
    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
    return redirect(url_for('leads'))

@app.route('/leads/delete/<int:id>')
@login_required
def delete_lead(id):
    lead = Lead.query.filter_by(id=id, user_id=current_user_id()).first_or_404()
    db.session.delete(lead)
    db.session.commit()
    return redirect(url_for('leads'))

@app.route('/leads/clear', methods=['POST'])
@login_required
def clear_leads():
    Lead.query.filter_by(user_id=current_user_id()).delete()
    db.session.commit()
    flash('All leads cleared', 'success')
    return redirect(url_for('leads'))

# ─── CAMPAIGNS ───

@app.route('/campaigns')
@login_required
def campaigns():
    uid = current_user_id()
    return render_template('campaigns.html',
        campaigns=Campaign.query.filter_by(user_id=uid).order_by(Campaign.created_at.desc()).all()
    )

@app.route('/campaigns/new', methods=['GET', 'POST'])
@login_required
def new_campaign():
    uid = current_user_id()
    if request.method == 'POST':
        scheduled_str = request.form.get('scheduled_at','').strip()
        scheduled_dt  = datetime.strptime(scheduled_str, '%Y-%m-%dT%H:%M') if scheduled_str else None
        acc_id        = request.form.get('account_id','')
        work_days_list = request.form.getlist('work_days')
        campaign = Campaign(
            user_id=uid,
            name=request.form.get('name'), subject_a=request.form.get('subject_a'),
            body_a=request.form.get('body_a'), subject_b=request.form.get('subject_b',''),
            body_b=request.form.get('body_b',''), ab_enabled='ab_enabled' in request.form,
            ab_split=int(request.form.get('ab_split',50)),
            delay_min=int(request.form.get('delay_min',1)), delay_max=int(request.form.get('delay_max',3)),
            working_hours='working_hours' in request.form,
            work_start=int(request.form.get('work_start',9)),
            work_end=int(request.form.get('work_end',18)),
            work_days=','.join(work_days_list) if work_days_list else '0,1,2,3,4',
            scheduled_at=scheduled_dt,
            account_ids=','.join(request.form.getlist('account_ids[]'))
        )
        db.session.add(campaign)
        db.session.flush()
        for i,(s,b,d) in enumerate(zip(
            request.form.getlist('fu_subject[]'),
            request.form.getlist('fu_body[]'),
            request.form.getlist('fu_days[]')
        )):
            if s.strip() and b.strip():
                db.session.add(FollowUp(campaign_id=campaign.id, step=i+1, subject=s, body=b, wait_days=int(d or 2)))
        db.session.commit()
        flash('Campaign created!', 'success')
        return redirect(url_for('campaigns'))
    return render_template('new_campaign.html',
        accounts=EmailAccount.query.filter_by(user_id=uid, is_active=True).all()
    )

@app.route('/campaigns/<int:id>')
@login_required
def view_campaign(id):
    uid      = current_user_id()
    campaign = Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    open_rate  = round(campaign.open_count / campaign.sent_count * 100, 1) if campaign.sent_count > 0 else 0
    reply_rate = round(campaign.reply_count/ campaign.sent_count * 100, 1) if campaign.sent_count > 0 else 0
    open_rate_a= round(campaign.open_a / campaign.sent_a * 100, 1) if campaign.sent_a > 0 else 0
    open_rate_b= round(campaign.open_b / campaign.sent_b * 100, 1) if campaign.sent_b > 0 else 0
    return render_template('view_campaign.html', campaign=campaign,
        leads    = Lead.query.filter_by(campaign_id=id, user_id=uid).order_by(Lead.created_at.desc()).all(),
        followups= FollowUp.query.filter_by(campaign_id=id).order_by(FollowUp.step).all(),
        open_rate=open_rate, reply_rate=reply_rate,
        open_rate_a=open_rate_a, open_rate_b=open_rate_b
    )

@app.route('/campaigns/<int:id>/start')
@login_required
def start_campaign(id):
    uid      = current_user_id()
    campaign = Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    if campaign.status == 'running':
        flash('Already running!', 'warning')
        return redirect(url_for('campaigns'))
    if not EmailAccount.query.filter_by(user_id=uid, is_active=True).first():
        flash('Please connect an email account first!', 'error')
        return redirect(url_for('accounts'))
    pending = Lead.query.filter_by(campaign_id=id, status='pending', user_id=uid).count()
    if pending == 0:
        flash('No pending leads!', 'warning')
        return redirect(url_for('campaigns'))
    running_campaigns[id] = True
    campaign.status = 'running'
    db.session.commit()
    threading.Thread(target=run_campaign, args=(id, uid), daemon=True).start()
    flash(f'Campaign started! {pending} leads queued.', 'success')
    return redirect(url_for('campaigns'))

@app.route('/campaigns/<int:id>/pause')
@login_required
def pause_campaign(id):
    uid = current_user_id()
    running_campaigns[id] = False
    c = Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    c.status = 'paused'
    db.session.commit()
    flash('Campaign paused!', 'warning')
    return redirect(url_for('campaigns'))

@app.route('/campaigns/<int:id>/delete')
@login_required
def delete_campaign(id):
    uid = current_user_id()
    c   = Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    FollowUp.query.filter_by(campaign_id=id).delete()
    Lead.query.filter_by(campaign_id=id).delete()
    db.session.delete(c)
    db.session.commit()
    flash('Deleted!', 'success')
    return redirect(url_for('campaigns'))

@app.route('/campaigns/<int:id>/status')
@login_required
def campaign_status(id):
    uid = current_user_id()
    c   = Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    return jsonify({'status':c.status,'sent':c.sent_count,'failed':c.failed_count,'total':c.total_leads,'opens':c.open_count,'replies':c.reply_count})

# ─── ANALYTICS ───

@app.route('/analytics')
@login_required
def analytics():
    uid          = current_user_id()
    camps        = Campaign.query.filter_by(user_id=uid).order_by(Campaign.created_at.desc()).all()
    total_sent   = Lead.query.filter(Lead.user_id==uid, Lead.status.in_(['sent','sent_followup_pending','replied'])).count()
    total_opens  = sum(c.open_count  for c in camps)
    total_replies= sum(c.reply_count for c in camps)
    total_failed = Lead.query.filter_by(user_id=uid, status='failed').count()
    open_rate    = round(total_opens  / total_sent * 100, 1) if total_sent > 0 else 0
    reply_rate   = round(total_replies/ total_sent * 100, 1) if total_sent > 0 else 0
    campaign_data= [{'name':c.name[:20],'sent':c.sent_count,'opens':c.open_count,'replies':c.reply_count,'failed':c.failed_count,
                     'open_rate': round(c.open_count /c.sent_count*100,1) if c.sent_count>0 else 0,
                     'reply_rate':round(c.reply_count/c.sent_count*100,1) if c.sent_count>0 else 0} for c in camps]
    return render_template('analytics.html', camps=camps,
        total_sent=total_sent, total_opens=total_opens, total_replies=total_replies,
        total_failed=total_failed, open_rate=open_rate, reply_rate=reply_rate,
        campaign_data=campaign_data
    )

# ─── INBOX ───

def get_default_tags(uid):
    """Default tags banao agar user ke koi tags nahi hain"""
    if InboxTag.query.filter_by(user_id=uid).count() == 0:
        defaults = [
            ('Interested',     '#22c55e', 0),
            ('Not Interested', '#ef4444', 1),
            ('Out of Office',  '#eab308', 2),
            ('Follow Up',      '#6366f1', 3),
            ('Meeting Booked', '#06b6d4', 4),
        ]
        for name, color, pos in defaults:
            db.session.add(InboxTag(user_id=uid, name=name, color=color, position=pos))
        db.session.commit()

@app.route('/inbox')
@login_required
def inbox():
    uid         = current_user_id()
    get_default_tags(uid)
    view        = request.args.get('view', 'kanban')
    campaign_id = request.args.get('campaign_id', '', type=str)
    tags        = InboxTag.query.filter_by(user_id=uid).order_by(InboxTag.position).all()
    campaigns   = Campaign.query.filter_by(user_id=uid).order_by(Campaign.created_at.desc()).all()

    # Auto-assign tags based on category
    for reply in InboxReply.query.filter_by(user_id=uid, tag_id=None).all():
        if reply.category == 'interested':
            t = InboxTag.query.filter_by(user_id=uid, name='Interested').first()
        elif reply.category == 'not_interested':
            t = InboxTag.query.filter_by(user_id=uid, name='Not Interested').first()
        elif reply.category == 'ooo':
            t = InboxTag.query.filter_by(user_id=uid, name='Out of Office').first()
        else:
            t = None
        if t:
            reply.tag_id = t.id
    db.session.commit()

    # Campaign filter and hide snoozed
    now = datetime.utcnow()
    query = InboxReply.query.filter(
        InboxReply.user_id == uid,
        db.or_(InboxReply.snoozed_until == None, InboxReply.snoozed_until <= now)
    )
    if campaign_id:
        # Us campaign ke leads ke replies
        lead_ids = [l.id for l in Lead.query.filter_by(campaign_id=int(campaign_id), user_id=uid).all()]
        query = query.filter(InboxReply.lead_id.in_(lead_ids))

    replies      = query.order_by(InboxReply.received_at.desc()).all()
    unread_count = InboxReply.query.filter_by(user_id=uid, is_read=False).count()
    accounts     = EmailAccount.query.filter_by(user_id=uid, is_active=True).all()

    # Stats - campaign filtered ya total
    stats_query = InboxReply.query.filter_by(user_id=uid)
    if campaign_id:
        lead_ids = [l.id for l in Lead.query.filter_by(campaign_id=int(campaign_id), user_id=uid).all()]
        stats_query = InboxReply.query.filter(InboxReply.user_id==uid, InboxReply.lead_id.in_(lead_ids))

    return render_template('inbox.html',
        replies=replies, tags=tags,
        unread_count=unread_count, view=view,
        accounts=accounts,
        campaigns=campaigns,
        selected_campaign_id=campaign_id,
        interested    = stats_query.filter_by(category='interested').count(),
        not_interested= stats_query.filter_by(category='not_interested').count(),
        ooo           = stats_query.filter_by(category='ooo').count()
    )

@app.route('/inbox/clear-non-leads')
@login_required
def clear_non_lead_replies():
    """Remove inbox replies that are not from campaign leads"""
    uid = current_user_id()
    # Get all lead emails for this user
    lead_emails = [l.email.lower() for l in Lead.query.filter_by(user_id=uid).all()]
    # Delete replies not from leads
    deleted = 0
    for reply in InboxReply.query.filter_by(user_id=uid).all():
        if reply.from_email.lower() not in lead_emails:
            db.session.delete(reply)
            deleted += 1
    db.session.commit()
    flash(f'Cleaned up {deleted} non-campaign emails from inbox!', 'success')
    return redirect(url_for('inbox'))

@app.route('/inbox/fetch-now-silent')
@login_required
def fetch_now_silent():
    """Silent background fetch — returns JSON with new count"""
    uid    = current_user_id()
    before = InboxReply.query.filter_by(user_id=uid).count()
    for acc in EmailAccount.query.filter_by(user_id=uid, is_active=True).all():
        if acc.auth_type == 'oauth':
            fetch_gmail_api_replies(acc)
    after = InboxReply.query.filter_by(user_id=uid).count()
    return jsonify({'new_count': after - before})

@app.route('/inbox/fetch-now')
@login_required
def fetch_now():
    """Manually trigger reply fetch"""
    uid = current_user_id()
    count = 0
    for acc in EmailAccount.query.filter_by(user_id=uid, is_active=True).all():
        before = InboxReply.query.filter_by(user_id=uid).count()
        if acc.auth_type == 'oauth':
            with app.app_context():
                fetch_gmail_api_replies(acc)
        after = InboxReply.query.filter_by(user_id=uid).count()
        count += after - before
    if count > 0:
        flash(f'{count} new replies fetched!', 'success')
    else:
        flash('No new replies found.', 'warning')
    return redirect(url_for('inbox'))

@app.route('/inbox/<int:id>/read')
@login_required
def mark_read(id):
    r = InboxReply.query.filter_by(id=id, user_id=current_user_id()).first_or_404()
    r.is_read = True
    db.session.commit()
    return redirect(url_for('inbox'))

@app.route('/inbox/mark-all-read')
@login_required
def mark_all_read():
    InboxReply.query.filter_by(user_id=current_user_id()).update({'is_read': True})
    db.session.commit()
    flash('All marked as read!', 'success')
    return redirect(url_for('inbox'))

@app.route('/inbox/<int:id>/draft', methods=['POST'])
@login_required
def save_draft(id):
    uid = current_user_id()
    reply = InboxReply.query.filter_by(id=id, user_id=uid).first_or_404()
    draft_body = request.json.get('draft_body', '')
    reply.draft_body = draft_body
    db.session.commit()
    return jsonify({'success': True})

@app.route('/inbox/<int:id>/snooze', methods=['POST'])
@login_required
def snooze_reply(id):
    uid = current_user_id()
    reply = InboxReply.query.filter_by(id=id, user_id=uid).first_or_404()
    days = request.json.get('days', 1)
    
    if days is None:
        reply.snoozed_until = None
    else:
        reply.snoozed_until = datetime.utcnow() + timedelta(days=int(days))
        
    db.session.commit()
    return jsonify({'success': True})

@app.route('/inbox/bulk/delete', methods=['POST'])
@login_required
def bulk_delete():
    uid = current_user_id()
    reply_ids = request.json.get('reply_ids', [])
    if reply_ids:
        InboxReply.query.filter(InboxReply.id.in_(reply_ids), InboxReply.user_id == uid).delete(synchronize_session=False)
        db.session.commit()
    return jsonify({'success': True})

@app.route('/inbox/bulk/read', methods=['POST'])
@login_required
def bulk_read():
    uid = current_user_id()
    reply_ids = request.json.get('reply_ids', [])
    if reply_ids:
        InboxReply.query.filter(InboxReply.id.in_(reply_ids), InboxReply.user_id == uid).update({'is_read': True}, synchronize_session=False)
        db.session.commit()
    return jsonify({'success': True})

@app.route('/inbox/bulk/tag', methods=['POST'])
@login_required
def bulk_tag():
    uid = current_user_id()
    reply_ids = request.json.get('reply_ids', [])
    tag_id = request.json.get('tag_id')
    if reply_ids:
        replies = InboxReply.query.filter(InboxReply.id.in_(reply_ids), InboxReply.user_id == uid).all()
        for reply in replies:
            reply.tag_id = int(tag_id) if tag_id else None
            reply.is_read = True
            if tag_id:
                tag = InboxTag.query.get(int(tag_id))
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
    return jsonify({'success': True})

@app.route('/api/thread/<int:lead_id>')
@login_required
def api_get_thread(lead_id):
    uid = current_user_id()
    # Ensure user owns the lead
    lead = Lead.query.filter_by(id=lead_id, user_id=uid).first_or_404()
    
    # Get all replies (sent and received) for this lead, ordered chronologically
    messages = InboxReply.query.filter_by(user_id=uid, lead_id=lead.id).order_by(InboxReply.received_at.asc()).all()
    
    thread_data = []
    for msg in messages:
        atts = []
        for a in msg.attachments:
            atts.append({
                'id': a.id,
                'filename': a.filename,
                'filepath': a.filepath,
                'mime_type': a.mime_type,
                'size': a.size
            })
            
        thread_data.append({
            'id': msg.id,
            'from': msg.from_email,
            'subject': msg.subject,
            'body': msg.body,
            'received': msg.received_at.strftime('%b %d, %Y %H:%M'),
            'is_sent': msg.is_sent,
            'is_read': msg.is_read,
            'attachments': atts
        })
        
    return jsonify({'success': True, 'thread': thread_data})

@app.route('/inbox/<int:id>/move-tag', methods=['POST'])
@login_required
def move_tag(id):
    uid    = current_user_id()
    reply  = InboxReply.query.filter_by(id=id, user_id=uid).first_or_404()
    tag_id = request.json.get('tag_id')
    reply.tag_id  = int(tag_id) if tag_id else None
    reply.is_read = True

    # Update category based on tag name — so stats update
    if tag_id:
        tag = InboxTag.query.get(int(tag_id))
        if tag:
            name_lower = tag.name.lower()
            if name_lower == 'interested':
                reply.category = 'interested'
            elif name_lower in ['not interested', 'not_interested']:
                reply.category = 'not_interested'
            elif name_lower in ['out of office', 'ooo']:
                reply.category = 'ooo'

            # Stop followup for interested/meeting booked
            if name_lower in ['interested', 'meeting booked']:
                if reply.lead:
                    reply.lead.next_followup_at = None
                    if reply.lead.status != 'replied':
                        reply.lead.status     = 'replied'
                        reply.lead.replied_at = datetime.utcnow()
                        if reply.lead.campaign_id:
                            c = Campaign.query.get(reply.lead.campaign_id)
                            if c:
                                c.reply_count += 1
    else:
        reply.category = 'uncategorized'

    db.session.commit()
    return jsonify({'success': True})

@app.route('/inbox/<int:id>/reply', methods=['POST'])
@login_required
def send_reply(id):
    uid   = current_user_id()
    reply = InboxReply.query.filter_by(id=id, user_id=uid).first_or_404()
    body  = request.form.get('body','').strip()
    if not body:
        flash('Reply cannot be empty!', 'error')
        return redirect(url_for('inbox'))
        
    reply.draft_body = ''
    db.session.commit()

    # Strict account enforcement
    if not reply.account_id:
        flash('Cannot reply: Original email account is unknown (Thread Safety).', 'error')
        return redirect(url_for('inbox'))
        
    account = EmailAccount.query.filter_by(id=reply.account_id, user_id=uid, is_active=True).first()
    if not account:
        flash('Cannot reply: The email account that received this is disconnected or inactive.', 'error')
        return redirect(url_for('inbox'))

    actual_thread_id = reply.thread_id
    actual_message_id = reply.message_id or reply.thread_id # fallback to thread_id if message_id is empty (old records)

    subject = ('Re: ' + reply.subject) if not reply.subject.lower().startswith('re:') else reply.subject
    success, error, _, new_msg_id = send_email_smtp(
        account, 
        reply.from_email, 
        subject, 
        body, 
        thread_id=actual_thread_id, 
        message_id=actual_message_id,
        references=reply.msg_references
    )
    print(f"[Manual Reply] Account: {account.email} | Thread: {actual_thread_id} | Success: {success}")
    if success:
        # Update references for the thread
        if reply.msg_references:
            new_refs = reply.msg_references + " " + actual_message_id
        else:
            new_refs = actual_message_id
        
        reply.msg_references = new_refs
        if reply.lead:
            reply.lead.msg_references = new_refs
            reply.lead.message_id = new_msg_id

        # Save to timeline
        db.session.add(InboxReply(
            user_id=uid,
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
        ))

        account.sent_today += 1
        reply.is_read = True
        # Lead status update
        if reply.lead:
            reply.lead.replied_at = datetime.utcnow()
            reply.lead.status     = 'replied'
        db.session.commit()
        flash(f'Reply sent to {reply.from_email} via {account.email}!', 'success')
    else:
        flash(f'Failed to send reply: {error}', 'error')
    return redirect(url_for('inbox'))

@app.route('/inbox/<int:id>/delete')
@login_required
def delete_reply(id):
    r = InboxReply.query.filter_by(id=id, user_id=current_user_id()).first_or_404()
    db.session.delete(r)
    db.session.commit()
    return redirect(url_for('inbox'))

# ─── TAGS CRUD ───

@app.route('/inbox/tags/create', methods=['POST'])
@login_required
def create_tag():
    uid   = current_user_id()
    name  = request.form.get('name','').strip()
    color = request.form.get('color','#6366f1')
    if not name:
        return jsonify({'success': False, 'msg': 'Name required'})
    max_pos = db.session.query(db.func.max(InboxTag.position)).filter_by(user_id=uid).scalar() or 0
    tag = InboxTag(user_id=uid, name=name, color=color, position=max_pos+1)
    db.session.add(tag)
    db.session.commit()
    return jsonify({'success': True, 'id': tag.id, 'name': tag.name, 'color': tag.color})

@app.route('/inbox/tags/<int:tag_id>/delete')
@login_required
def delete_tag(tag_id):
    uid = current_user_id()
    tag = InboxTag.query.filter_by(id=tag_id, user_id=uid).first_or_404()
    InboxReply.query.filter_by(tag_id=tag_id, user_id=uid).update({'tag_id': None})
    db.session.delete(tag)
    db.session.commit()
    flash(f'Tag "{tag.name}" deleted!', 'success')
    return redirect(url_for('inbox'))

@app.route('/inbox/tags/reorder', methods=['POST'])
@login_required
def reorder_tags():
    uid     = current_user_id()
    tag_ids = request.json.get('order', [])
    for i, tag_id in enumerate(tag_ids):
        tag = InboxTag.query.filter_by(id=int(tag_id), user_id=uid).first()
        if tag:
            tag.position = i
    db.session.commit()
    return jsonify({'success': True})

# ─── EMAIL TRACKING ───

@app.route('/track/open/<tracking_id>')
def track_open(tracking_id):
    lead = Lead.query.filter_by(tracking_id=tracking_id).first()
    if lead:
        lead.open_count += 1
        if not lead.opened_at:
            lead.opened_at = datetime.utcnow()
            if lead.campaign_id:
                c = Campaign.query.get(lead.campaign_id)
                if c:
                    c.open_count += 1
                    if lead.ab_variant == 'A': c.open_a += 1
                    elif lead.ab_variant == 'B': c.open_b += 1
        db.session.commit()
    return Response(
        b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;',
        mimetype='image/gif'
    )

# ─── EMAIL ACCOUNTS ───

@app.route('/accounts')
@login_required
def accounts():
    uid = current_user_id()
    return render_template('accounts.html', accounts=EmailAccount.query.filter_by(user_id=uid).all())

@app.route('/accounts/new', methods=['GET', 'POST'])
@login_required
def new_account():
    uid = current_user_id()
    if request.method == 'POST':
        db.session.add(EmailAccount(
            user_id=uid,
            name=request.form.get('name'), email=request.form.get('email'),
            password=request.form.get('password',''),
            smtp_host=request.form.get('smtp_host','smtp.gmail.com'),
            smtp_port=int(request.form.get('smtp_port',587)),
            imap_host=request.form.get('imap_host','imap.gmail.com'),
            daily_limit=int(request.form.get('daily_limit',50)),
            warmup_enabled='warmup_enabled' in request.form,
            warmup_limit=int(request.form.get('warmup_limit',5))
        ))
        db.session.commit()
        flash('Account added!', 'success')
        return redirect(url_for('accounts'))
    return render_template('new_account.html')

@app.route('/accounts/<int:id>/toggle')
@login_required
def toggle_account(id):
    acc = EmailAccount.query.filter_by(id=id, user_id=current_user_id()).first_or_404()
    acc.is_active = not acc.is_active
    db.session.commit()
    return redirect(url_for('accounts'))

@app.route('/accounts/<int:id>/delete')
@login_required
def delete_account(id):
    acc = EmailAccount.query.filter_by(id=id, user_id=current_user_id()).first_or_404()
    db.session.delete(acc)
    db.session.commit()
    flash('Deleted!', 'success')
    return redirect(url_for('accounts'))

@app.route('/accounts/<int:id>/test')
@login_required
def test_account(id):
    acc = EmailAccount.query.filter_by(id=id, user_id=current_user_id()).first_or_404()
    if acc.auth_type == 'oauth':
        token = get_valid_token(acc)
        return jsonify({'success': bool(token), 'msg': 'OAuth connected!' if token else 'Token expired — reconnect'})
    try:
        with smtplib.SMTP(acc.smtp_host, acc.smtp_port) as s:
            s.ehlo(); s.starttls(); s.login(acc.email, acc.password)
        return jsonify({'success': True, 'msg': 'Connected!'})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)})

@app.route('/accounts/<int:id>/warmup-toggle')
@login_required
def warmup_toggle(id):
    acc = EmailAccount.query.filter_by(id=id, user_id=current_user_id()).first_or_404()
    acc.warmup_enabled = not acc.warmup_enabled
    db.session.commit()
    flash(f'Warmup {"ON" if acc.warmup_enabled else "OFF"}!', 'success')
    return redirect(url_for('accounts'))

# ─── SETTINGS ───

@app.route('/settings', methods=['GET','POST'])
@login_required
def settings():
    if request.method == 'POST':
        set_setting('delay_min',  request.form.get('delay_min','1'))
        set_setting('delay_max',  request.form.get('delay_max','3'))
        set_setting('daily_limit',request.form.get('daily_limit','50'))
        flash('Saved!', 'success')
        return redirect(url_for('settings'))
    return render_template('settings.html',
        delay_min  =get_setting('delay_min','1'),
        delay_max  =get_setting('delay_max','3'),
        daily_limit=get_setting('daily_limit','50')
    )

# ─── ADMIN (only is_admin=True users) ───

@app.route('/admin')
@admin_required
def admin():
    return render_template('admin.html',
        total_leads   = Lead.query.count(),
        total_sent    = Lead.query.filter(Lead.status.in_(['sent','sent_followup_pending','replied'])).count(),
        total_failed  = Lead.query.filter_by(status='failed').count(),
        total_replied = Lead.query.filter_by(status='replied').count(),
        total_campaigns= Campaign.query.count(),
        total_accounts = EmailAccount.query.count(),
        active_accounts= EmailAccount.query.filter_by(is_active=True).count(),
        running        = Campaign.query.filter_by(status='running').count(),
        completed      = Campaign.query.filter_by(status='completed').count(),
        all_campaigns  = Campaign.query.order_by(Campaign.created_at.desc()).all(),
        all_accounts   = EmailAccount.query.all(),
        total_users    = User.query.count(),
        all_users      = User.query.order_by(User.created_at.desc()).all()
    )

@app.route('/admin/user/<int:id>/toggle')
@admin_required
def admin_toggle_user(id):
    user = User.query.get_or_404(id)
    if user.id == current_user_id():
        flash("Can't deactivate yourself!", 'error')
        return redirect(url_for('admin'))
    user.is_active = not user.is_active
    db.session.commit()
    flash(f'User {"activated" if user.is_active else "deactivated"}!', 'success')
    return redirect(url_for('admin'))

# ─── API ENDPOINTS ───

@app.route('/api/spam-check', methods=['POST'])
@login_required
def spam_check():
    data = request.json
    score, found = check_spam_score(data.get('subject',''), data.get('body',''))
    return jsonify({'score': score, 'words': found})

@app.route('/api/spintax-preview', methods=['POST'])
@login_required
def spintax_preview():
    text = request.json.get('text','')
    return jsonify({'previews': [process_spintax(text) for _ in range(3)]})

@app.route('/api/verify-email', methods=['POST'])
@login_required
def api_verify_email():
    email_val = request.json.get('email','')
    valid, reason = verify_email(email_val)
    return jsonify({'valid': valid, 'reason': reason})

@app.route('/api/stats')
@login_required
def api_stats():
    uid   = current_user_id()
    today = datetime.utcnow().date()
    # Session timeout check - 24 hours
    last_active = session.get('last_active')
    if last_active:
        diff = datetime.utcnow() - datetime.fromisoformat(last_active)
        if diff.total_seconds() > 86400:  # 24 hours
            session.clear()
            return jsonify({'timeout': True}), 401
    session['last_active'] = datetime.utcnow().isoformat()

    sent_today = Lead.query.filter(
        Lead.user_id == uid,
        Lead.sent_at != None,
        db.func.date(Lead.sent_at) == today
    ).count()

    # Best performing campaign
    camps = Campaign.query.filter_by(user_id=uid).all()
    best  = max(camps, key=lambda c: c.reply_count, default=None)

    return jsonify({
        'total_leads' : Lead.query.filter_by(user_id=uid).count(),
        'sent'        : Lead.query.filter(Lead.user_id==uid, Lead.status.in_(['sent','sent_followup_pending','replied'])).count(),
        'pending'     : Lead.query.filter_by(user_id=uid, status='pending').count(),
        'failed'      : Lead.query.filter_by(user_id=uid, status='failed').count(),
        'replied'     : Lead.query.filter_by(user_id=uid, status='replied').count(),
        'unread_inbox': InboxReply.query.filter_by(user_id=uid, is_read=False).count(),
        'sent_today'  : sent_today,
        'best_campaign': best.name if best and best.reply_count > 0 else None
    })

# ─────────────────────────────────────────
# PROFILE ROUTES
# ─────────────────────────────────────────

@app.route('/profile')
@login_required
def profile():
    user = User.query.get(current_user_id())
    return render_template('profile.html', user=user)

@app.route('/profile/update-info', methods=['POST'])
@login_required
def profile_update_info():
    user = User.query.get(current_user_id())
    name = request.form.get('name', '').strip()
    if not name:
        flash('Name cannot be empty!', 'error')
        return redirect(url_for('profile'))
    user.name = name
    session['user_name'] = name
    db.session.commit()
    flash('Profile updated successfully!', 'success')
    return redirect(url_for('profile'))

@app.route('/profile/change-password', methods=['POST'])
@login_required
def profile_change_password():
    user         = User.query.get(current_user_id())
    current_pass = request.form.get('current_password', '')
    new_pass     = request.form.get('new_password', '')
    confirm_pass = request.form.get('confirm_password', '')
    if not user.password_hash or not check_password_hash(user.password_hash, current_pass):
        flash('Current password is incorrect!', 'error')
        return redirect(url_for('profile'))
    if len(new_pass) < 8:
        flash('New password must be at least 8 characters!', 'error')
        return redirect(url_for('profile'))
    if new_pass != confirm_pass:
        flash('Passwords do not match!', 'error')
        return redirect(url_for('profile'))
    user.password_hash = generate_password_hash(new_pass)
    db.session.commit()
    flash('Password changed successfully!', 'success')
    return redirect(url_for('profile'))

@app.route('/campaigns/<int:id>/retry-failed')
@login_required
def retry_failed(id):
    uid = current_user_id()
    Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    count = Lead.query.filter_by(campaign_id=id, status='failed', user_id=uid).update({'status': 'pending', 'error_msg': ''})
    db.session.commit()
    flash(f'{count} failed leads reset for retry!', 'success')
    return redirect(url_for('view_campaign', id=id))

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    db.session.rollback()
    return render_template('500.html'), 500

@app.errorhandler(413)
def file_too_large(e):
    flash('File too large! Max 5MB allowed.', 'error')
    return redirect(url_for('leads'))

# ─────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────

# 5MB max file upload
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

# ─── AUTO MIGRATE — runs on every startup (gunicorn + local) ───
def auto_migrate():
    with app.app_context():
        try:
            db.create_all()
            migrations = [
                # Campaign Table
                "ALTER TABLE campaign ADD COLUMN workspace_id INTEGER",
                "ALTER TABLE campaign ADD COLUMN work_days VARCHAR(20) DEFAULT '0,1,2,3,4'",
                "ALTER TABLE campaign ADD COLUMN working_hours BOOLEAN DEFAULT 0",
                "ALTER TABLE campaign ADD COLUMN work_start INTEGER DEFAULT 9",
                "ALTER TABLE campaign ADD COLUMN work_end INTEGER DEFAULT 18",
                "ALTER TABLE campaign ADD COLUMN scheduled_at DATETIME",
                "ALTER TABLE campaign ADD COLUMN account_ids VARCHAR(500) DEFAULT ''",
                "ALTER TABLE campaign ADD COLUMN account_id INTEGER",
                
                # EmailAccount Table
                "ALTER TABLE email_account ADD COLUMN workspace_id INTEGER",
                "ALTER TABLE email_account ADD COLUMN warmup_enabled BOOLEAN DEFAULT 0",
                "ALTER TABLE email_account ADD COLUMN warmup_day INTEGER DEFAULT 1",
                "ALTER TABLE email_account ADD COLUMN warmup_limit INTEGER DEFAULT 5",
                
                # Lead Table
                "ALTER TABLE lead ADD COLUMN workspace_id INTEGER",
                "ALTER TABLE lead ADD COLUMN account_id INTEGER",
                "ALTER TABLE lead ADD COLUMN message_id VARCHAR(200) DEFAULT ''",
                "ALTER TABLE lead ADD COLUMN msg_references TEXT DEFAULT ''",
                
                # InboxReply Table
                "ALTER TABLE inbox_reply ADD COLUMN thread_id VARCHAR(200) DEFAULT ''",
                "ALTER TABLE inbox_reply ADD COLUMN message_id VARCHAR(200) DEFAULT ''",
                "ALTER TABLE inbox_reply ADD COLUMN is_sent BOOLEAN DEFAULT 0",
                "ALTER TABLE inbox_reply ADD COLUMN tag_id INTEGER",
                "ALTER TABLE inbox_reply ADD COLUMN msg_references TEXT DEFAULT ''",
                "ALTER TABLE inbox_reply ADD COLUMN draft_body TEXT DEFAULT ''",
                "ALTER TABLE inbox_reply ADD COLUMN snoozed_until DATETIME",
                
                # InboxTag Table
                "ALTER TABLE inbox_tag ADD COLUMN position INTEGER DEFAULT 0",
                
                # Attachment Table fallback
                "CREATE TABLE IF NOT EXISTS attachment (id INTEGER PRIMARY KEY AUTOINCREMENT, reply_id INTEGER, filename VARCHAR(255), filepath VARCHAR(500), mime_type VARCHAR(100), size INTEGER, FOREIGN KEY(reply_id) REFERENCES inbox_reply(id))"
            ]
            for sql in migrations:
                try:
                    db.session.execute(db.text(sql))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            # Create admin if not exists
            if not User.query.filter_by(email='admin@mailflow.com').first():
                db.session.add(User(
                    name='Admin', email='admin@mailflow.com',
                    password_hash=generate_password_hash('admin1234'),
                    is_admin=True
                ))
                db.session.commit()
                print("[SUCCESS] Admin account created!")
            print("[SUCCESS] Database migration complete!")
        except Exception as e:
            print(f'[auto_migrate error] {e}')

auto_migrate()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(email='admin@mailflow.com').first():
            db.session.add(User(
                name='Admin', email='admin@mailflow.com',
                password_hash=generate_password_hash('admin1234'),
                is_admin=True
            ))
            db.session.commit()
            print("=" * 50)
            print("[SUCCESS] Admin account bana diya!")
            print("   Email   : admin@mailflow.com")
            print("   Password: admin1234")
            print("   [WARNING] Please change the default password after login!")
            print("=" * 50)
    threading.Thread(target=run_followups_bg, daemon=True).start()
    threading.Thread(target=fetch_replies_bg, daemon=True).start()
    port = int(os.environ.get('PORT', 5000))
    print(f"\nMailFlow running -> http://localhost:{port}\n")
    app.run(debug=False, host='0.0.0.0', port=port, use_reloader=False)

# ─────────────────────────────────────────
# CAMPAIGN EDIT / DUPLICATE / FOLLOWUP
# ─────────────────────────────────────────

@app.route('/campaigns/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_campaign(id):
    uid      = current_user_id()
    campaign = Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    followups= FollowUp.query.filter_by(campaign_id=id).order_by(FollowUp.step).all()

    if request.method == 'POST':
        # Update main campaign
        campaign.name          = request.form.get('name', campaign.name)
        campaign.subject_a     = request.form.get('subject_a', campaign.subject_a)
        campaign.body_a        = request.form.get('body_a', campaign.body_a)
        campaign.subject_b     = request.form.get('subject_b', campaign.subject_b)
        campaign.body_b        = request.form.get('body_b', campaign.body_b)
        campaign.delay_min     = int(request.form.get('delay_min', campaign.delay_min))
        campaign.delay_max     = int(request.form.get('delay_max', campaign.delay_max))
        campaign.working_hours = 'working_hours' in request.form
        campaign.work_start    = int(request.form.get('work_start', 9))
        campaign.work_end      = int(request.form.get('work_end', 18))
        acc_id = request.form.get('account_id','')
        campaign.account_id    = int(acc_id) if acc_id else None
        scheduled_str = request.form.get('scheduled_at','').strip()
        if scheduled_str:
            campaign.scheduled_at = datetime.strptime(scheduled_str, '%Y-%m-%dT%H:%M')

        work_days_list = request.form.getlist('work_days')
        if work_days_list:
            campaign.work_days = ','.join(work_days_list)
        elif 'working_hours' in request.form:
            # If they enabled working hours but didn't select days, default to mon-fri
            campaign.work_days = '0,1,2,3,4'
        else:
            campaign.work_days = ''


        # Update existing followups
        fu_ids = request.form.getlist('fu_ids')
        for fu_id in fu_ids:
            fu = FollowUp.query.get(int(fu_id))
            if fu and fu.campaign_id == id:
                fu.wait_days = int(request.form.get(f'fu_days_{fu_id}', fu.wait_days))
                fu.subject   = request.form.get(f'fu_subject_{fu_id}', fu.subject)
                fu.body      = request.form.get(f'fu_body_{fu_id}', fu.body)

        # Add new followups
        new_subjects = request.form.getlist('new_fu_subject[]')
        new_bodies   = request.form.getlist('new_fu_body[]')
        new_days     = request.form.getlist('new_fu_days[]')
        max_step     = max([f.step for f in followups], default=0)
        for i, (s, b, d) in enumerate(zip(new_subjects, new_bodies, new_days)):
            if s.strip() and b.strip():
                max_step += 1
                db.session.add(FollowUp(
                    campaign_id=id, step=max_step,
                    subject=s, body=b, wait_days=int(d or 2)
                ))

        db.session.commit()
        flash('Campaign updated successfully!', 'success')
        return redirect(url_for('view_campaign', id=id))

    return render_template('edit_campaign.html', campaign=campaign, followups=followups, accounts=EmailAccount.query.filter_by(user_id=uid, is_active=True).all())


@app.route('/campaigns/<int:id>/followup/<int:fu_id>/delete')
@login_required
def delete_followup(id, fu_id):
    uid = current_user_id()
    Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    fu = FollowUp.query.filter_by(id=fu_id, campaign_id=id).first_or_404()
    db.session.delete(fu)
    # Re-number remaining followups
    remaining = FollowUp.query.filter_by(campaign_id=id).order_by(FollowUp.step).all()
    for i, f in enumerate(remaining):
        f.step = i + 1
    db.session.commit()
    flash('Follow-up deleted!', 'success')
    return redirect(url_for('edit_campaign', id=id))


@app.route('/campaigns/<int:id>/duplicate')
@login_required
def duplicate_campaign(id):
    uid      = current_user_id()
    original = Campaign.query.filter_by(id=id, user_id=uid).first_or_404()
    new_camp = Campaign(
        user_id   = uid,
        name      = original.name + ' (Copy)',
        subject_a = original.subject_a,
        body_a    = original.body_a,
        subject_b = original.subject_b,
        body_b    = original.body_b,
        ab_enabled= original.ab_enabled,
        ab_split  = original.ab_split,
        delay_min = original.delay_min,
        delay_max = original.delay_max,
        status    = 'draft'
    )
    db.session.add(new_camp)
    db.session.flush()
    # Copy followups
    for fu in FollowUp.query.filter_by(campaign_id=id).order_by(FollowUp.step).all():
        db.session.add(FollowUp(
            campaign_id=new_camp.id,
            step=fu.step, subject=fu.subject,
            body=fu.body, wait_days=fu.wait_days
        ))
    db.session.commit()
    flash(f'Campaign "{original.name}" duplicated!', 'success')
    return redirect(url_for('edit_campaign', id=new_camp.id))

