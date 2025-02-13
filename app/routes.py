import threading
import time
from io import BytesIO

import qrcode
from flask import Response, jsonify, render_template, request
from flask_socketio import emit

from app.helpers import (
    create_queues,
    get_random_token,
    load_config,
    username_filtered,
    verify_operator_code,
)

from . import socketio

config_info = load_config()
store_name = config_info['store']['store_name']
queues = create_queues(config_info)
current_op_code = ''

def start_timer(queue, game_id, timer_type='wait', time_left=None):
    if not queue['timer_running']:
        if timer_type == 'wait':
            time_left = queue['wait_time']
        elif timer_type == 'confirm':
            time_left = queue['confirm_time']

        queue['timer_thread'] = threading.Thread(target=timer, args=(queue, game_id, timer_type, time_left))
        queue['timer_thread'].start()

def timer(queue, game_id, timer_type, time_left):
    queue['timer_running'] = True

    current_len = len(queue['queue'])
    while time_left > 0:
        if len(queue['queue']) == 0:
            queue['timer_running'] = False
            queue['timer_thread'] = None
            return
        if timer_type == 'confirm' and len(queue['queue']) != current_len:
            queue['timer_running'] = False
            queue['timer_thread'] = None
            start_timer(queue, game_id, timer_type='wait')
            return
        socketio.emit('timer_update', {'game_id': game_id, 'time_left': time_left})
        current_len = len(queue['queue'])
        time.sleep(1)
        time_left -= 1

    queue['timer_running'] = False
    queue['timer_thread'] = None

    if timer_type == 'wait':
        start_timer(queue, game_id, timer_type='confirm')
        socketio.emit('user_confirm', {'game_id': game_id, 'user': queue['queue'][0], 'game_name': queue['name'], 'token': queue['queue'][0]['token']})
    if timer_type == 'confirm':
        removed_user = queue['queue'].pop(0)
        token = removed_user['token']
        socketio.emit('user_removed', {'game_id': game_id, 'user': removed_user, 'game_name': queue['name'], 'token': token, 'timed_out': True})
        if queue['queue']:
            start_timer(queue, game_id, timer_type='wait')
        socketio.emit('queue_update', {'game_id': game_id, 'queue': queue['queue'], 'wait_time': queue['wait_time']})

@socketio.on('remove_user')
def handle_remove_user(data):
    game_id = data.get('game_id')
    username = data.get('username')
    token = data.get('token')
    operator_code = data.get('operator_code')
    removed_user = None
    queue = queues[game_id]
    if verify_operator_code(operator_code, current_op_code):
        for user in queue['queue']:
            if user['username'] == username:
                removed_user = user['username']
                token = user['token']
                queue['queue'].remove(user)
                break
        socketio.emit('user_removed', {'game_id': game_id, 'user': removed_user, 'game_name': queue['name'], 'operator': True, 'token': token})
    else:
        if {'username': username, 'token': token} not in queue['queue']:
            return
        removed_user = queue['queue'].remove({'username': username, 'token': token})
    if queue:
        start_timer(queue, game_id)
    socketio.emit('queue_update', {
        'game_id': game_id,
        'queue': queue['queue'],
        'wait_time': queue['wait_time'],
    })

@socketio.on('join_queue')
def handle_join_queue(data):
    game_id = data.get('game_id')
    username = data.get('username')
    queue = queues[game_id]
    token = data.get('token')
    queue['queue'].append({'username': username, 'token': token})

    start_timer(queue, game_id)

    socketio.emit('queue_update', {
        'game_id': game_id,
        'queue': [{"username": user["username"], "token": user["token"]} for user in queue['queue']],
        'wait_time': queue['wait_time'],
    })

@socketio.on('connect')
def handle_connect():
    for i in range(len(queues)):
        emit('queue_update', {
            'game_id': i,
            'queue': queues[i]['queue'],
            'wait_time': queues[i]['wait_time'],
        })

def init_routes(app):
    @app.route('/')
    @app.route('/index')
    def index():
        view = request.args.get('view')
        return render_template('index.html', title=f'{store_name} Queue', queue_list=queues, store=config_info['store'], view_only=view)

    @app.route('/api/get_token', methods=['GET'])
    def get_token():
        username = str(request.args.get('username'))
        game_id = request.args.get('game_id')
        if game_id is not None:
            game_id = int(game_id)
        else:
            raise Exception('Game ID missing')
        if username_filtered(username, queues[game_id]['queue']):
            return 'Username filtered'
        token = get_random_token(username, app.config['SECRET_KEY'])
        return jsonify({'token': token})

    @app.route('/api/operator', methods=['GET'])
    def operator():
        global current_op_code
        operator_code = str(request.args.get('operator_code'))
        if str(operator_code) != str(config_info['store']['operator_code']):
            return
        token = get_random_token(operator_code, app.config['SECRET_KEY'])
        current_op_code = token
        return jsonify({'token': token})

    @app.route('/qrcode')
    def generate_qrcode():
        url = request.url_root
        qr_code = qrcode.make(url)
        buffer = BytesIO()
        qr_code.save(buffer, 'PNG')
        buffer.seek(0)
        return Response(buffer, mimetype="image/png")
