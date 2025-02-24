import json
import os
import threading
import time
from io import BytesIO

import qrcode
from flask import Response, jsonify, render_template, request
from flask_socketio import emit

from app.helpers import (
    Player,
    Queue,
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

def start_timer(queue: Queue, game_id, timer_type='wait', time_left=None):
    if not queue.timer_thread:
        if timer_type == 'wait':
            queue.time_left = queue.wait_time
        elif timer_type == 'confirm':
            queue.time_left = queue.confirm_time

        queue.timer_thread = threading.Thread(target=timer, args=(queue, game_id, timer_type))
        queue.timer_thread.start()

def timer(queue: Queue, game_id, timer_type):
    queue.timer_running = True

    current_len = len(queue.queue)
    while queue.time_left > 0:
        if len(queue.queue) == 0:
            queue.timer_running = False
            queue.timer_thread = None
            return
        if timer_type == 'confirm' and len(queue.queue) != current_len:
            queue.timer_running = False
            queue.timer_thread = None
            start_timer(queue, game_id, timer_type='wait')
            return
        socketio.emit('timer_update', queue.get_info())
        current_len = len(queue.queue)
        time.sleep(1)
        queue.time_left -= 1

    queue.timer_running = False
    queue.timer_thread = None

    if timer_type == 'wait':
        socketio.emit('user_confirm', queue.get_info())
        for user in queue.queue[0]:
            user.is_confirming = True
        start_timer(queue, game_id, timer_type='confirm')
    if timer_type == 'confirm':
        group = queue.queue.pop(0)
        for user in group:
            user.timed_out = True
            socketio.emit('user_removed', {'queue': queue.get_info(), 'user': json.dumps(user.__dict__)})
        if queue.queue:
            start_timer(queue, game_id, timer_type='wait')
    socketio.emit('queue_update', queue.get_info())

@socketio.on('remove_user')
def handle_remove_user(data):
    game_id: int = data.get('game_id')
    username = data.get('username')
    operator_code = data.get('operator_code')
    removed_user = None
    queue = queues[game_id]
    if verify_operator_code(operator_code, current_op_code):
        for group in queue.queue:
            for user in group:
                if username == user.username:
                    removed_user = user
                    group.remove(user)
                    if group == []:
                        queue.queue.remove(group)
                    break
        socketio.emit('user_removed', {'queue': queue.get_info(), 'user': json.dumps(removed_user.__dict__)})
    else:
        token = data.get('token')
        if token is None:
            return
        for group in queue.queue:
            for user in group:
                if username == user.username and token == user.token:
                    print(user)
                    removed_user = user
                    group.remove(user)
                    if group == []:
                        queue.queue.remove(group)
                    break
    if queue:
        start_timer(queue, game_id)
    socketio.emit('queue_update', queue.get_info())

@socketio.on('join_queue')
def handle_join_queue(data):
    game_id: int = data.get('game_id')
    username: str = data.get('username')
    solo_queue: bool = data.get('solo_queue')
    queue = queues[game_id]
    token = data.get('token')
    if (solo_queue or len(queue.queue) == 0 or len(queue.queue[-1]) == 2 or queue.queue[-1][0].solo_queue) or not queue.double_queue:
        queue.queue.append([Player(username, token, solo_queue=solo_queue)])
        start_timer(queue, game_id)
    else:
        queue.queue[-1].append(Player(username, token, solo_queue=solo_queue))

    socketio.emit('queue_update', queue.get_info())

@socketio.on('connect')
def handle_connect():
    for i in range(len(queues)):
        emit('queue_update', queues[i].get_info())

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
            raise ValueError("Missing Game ID")
        queue = queues[game_id]
        if username_filtered(username, queue):
            return 'Username filtered'
        token = get_random_token(username, app.config['SECRET_KEY'])
        return jsonify({'token': token})

    @app.route('/api/operator', methods=['GET'])
    def operator():
        global current_op_code
        operator_code = str(request.args.get('operator_code'))
        if str(operator_code) != str(os.getenv('OPERATOR_CODE')):
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
