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
