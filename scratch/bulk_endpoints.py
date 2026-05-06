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
