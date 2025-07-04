import json
import os
import threading
import time
from datetime import datetime, timedelta
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
    save_config,
    username_filtered,
    verify_operator_code,
)

from . import socketio

config_info = load_config()
store_name = config_info['store']['name']
queues = create_queues(config_info)
current_op_code = ''

def start_timer(queue: Queue, game_id, timer_type='wait', time_left=None):
    if not queue.timer_thread:
        duration = queue.wait_time
        if timer_type == 'confirm':
            duration = queue.confirm_time

        # Set the end time instead of time_left
        queue.timer_end_time = datetime.now() + timedelta(seconds=duration)
        queue.timer_thread = threading.Thread(target=timer, args=(queue, game_id, timer_type))
        queue.timer_thread.start()

def restart_timer(queue: Queue, game_id):
    if queue.timer_thread:
        queue.timer_thread = None
        queue.timer_end_time = datetime.now() + timedelta(seconds=queue.wait_time)
        queue.timer_thread = threading.Thread(target=timer, args=(queue, game_id, 'wait'))
        queue.timer_thread.start()

def timer(queue: Queue, game_id, timer_type):
    queue.timer_running = True
    current_len = len(queue.queue)

    while datetime.now() < queue.timer_end_time:
        if len(queue.queue) == 0:
            queue.timer_running = False
            queue.timer_thread = None
            return

        if timer_type == 'confirm' and len(queue.queue) != current_len:
            queue.timer_running = False
            queue.timer_thread = None
            start_timer(queue, game_id, timer_type='wait')
            return

        # Calculate remaining time for display purposes
        remaining = queue.timer_end_time - datetime.now()
        queue.time_left = max(0, int(remaining.total_seconds()))

        socketio.emit('timer_update', queue.get_info())
        current_len = len(queue.queue)
        time.sleep(0.1)  # Much shorter sleep for better responsiveness

    # Timer expired
    queue.timer_running = False
    queue.timer_thread = None
    queue.time_left = 0

    if timer_type == 'wait':
        socketio.emit('user_confirm', queue.get_info())
        for user in queue.queue[0]:
            user.is_confirming = True
        start_timer(queue, game_id, timer_type='confirm')
    elif timer_type == 'confirm':
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
    if len(queue.queue) >= 4:
        solo_queue = False
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

    @app.route('/api/store/edit', methods=['POST'])
    def edit_store():
        global current_op_code
        data = request.get_json()
        op_code = data.get('op_code', '').strip()
        if not verify_operator_code(op_code, current_op_code):
            return jsonify({
                'success': False,
                'message': 'Invalid Operator Code',
            })
        config_info['store']['name'] = data.get('name', '').strip()
        config_info['store']['info'] = (data.get('info', '')).replace('\n', '<br>')
        save_config(config_info)
        return jsonify({
            'success': True,
            'message': 'Store information updated successfully',
            'data': {
                'name': config_info['store']['name'],
                'info': config_info['store']['info']
            }
        })

    @app.route('/api/queue/edit', methods=['POST'])
    def edit_queue():
        global current_op_code
        data = request.get_json()
        op_code = data.get('op_code', '').strip()
        if not verify_operator_code(op_code, current_op_code):
            return jsonify({
                'success': False,
                'message': 'Invalid Operator Code',
            })
        index = data.get('queue_index', None)+1
        name = data.get('name', '').strip()
        info = (data.get('info', '')).replace('\n', '<br>')
        wait_time = data.get('wait_time', 0)
        double_queue = data.get('double_queue', False)
        config_info[f'game_{index}']['name'] = name
        config_info[f'game_{index}']['info'] = info
        config_info[f'game_{index}']['wait_time'] = wait_time
        config_info[f'game_{index}']['double_queue'] = double_queue
        save_config(config_info)
        queues[index-1].name = name
        queues[index-1].info = info
        queues[index-1].wait_time = wait_time
        queues[index-1].double_queue = double_queue
        return jsonify({
            'success': True,
            'message': 'Queue information updated successfully',
        })

    @app.route('/api/queue/restart', methods=['POST'])
    def restart_queue():
        global current_op_code
        data = request.get_json()
        op_code = data.get('op_code', '').strip()
        if not verify_operator_code(op_code, current_op_code):
            return jsonify({
                'success': False,
                'message': 'Invalid Operator Code',
            })
        index = data.get('queue_index', None)
        restart_timer(queues[index], index)
        return jsonify({
            'success': True,
            'message': 'Queue restarted.',
        })


    @app.route('/qrcode')
    def generate_qrcode():
        url = request.url_root
        qr_code = qrcode.make(url)
        buffer = BytesIO()
        qr_code.save(buffer, 'PNG')
        buffer.seek(0)
        return Response(buffer, mimetype="image/png")
