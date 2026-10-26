"""Send commands using the revision actually observed from the server."""
def study_post(client, path, *, json=None):
    if path in {'/api/stop', '/api/totals/reset', '/api/end-day'} or path.endswith('/start'):
        state = client.get('/api/study-state').json()
        json = {**(json or {}), 'expected_revision': state['revision'],
                'expected_active_session_id': state['active_session']['id'] if state['active_session'] else None}
    return client.post(path, json=json)
