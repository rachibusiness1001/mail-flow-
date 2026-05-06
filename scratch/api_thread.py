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
