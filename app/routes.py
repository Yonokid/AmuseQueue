from flask import render_template, url_for, redirect, request, jsonify
from . import socketio
import tomllib
import time
import jwt
import random
import threading
from flask_socketio import emit, join_room, leave_room

with open('config.toml', 'rb') as f:
    config_info = tomllib.load(f)
store_name = config_info['store']['store_name']

queues = []
for i in range(len(config_info)+1):
    if f'game_{i}' in config_info:
        queues.append(config_info[f'game_{i}'])

for queue in queues:
    queue['queue'] = []
    queue['timer_thread'] = None
    queue['timer_running'] = False
user_socket_ids = {}
current_op_code = []


def randomize_string(input_string):
    char_list = list(input_string)
    random.shuffle(char_list)
    randomized_string = ''.join(char_list)
    return randomized_string

def start_timer(game_id):
    queues[game_id]['timer_running'] = True

    time_left = queues[game_id]['wait_time']
    while time_left > 0:
        socketio.emit('timer_update', {'game_id': game_id, 'time_left': time_left})
        if len(queues[game_id]) == 0:
            queues[game_id]['timer_running'] = False
            queues[game_id]['timer_thread'] = None
            return
        time.sleep(1)
        time_left -= 1
    queues[game_id]['timer_running'] = False

    removed_user = queues[game_id]['queue'].pop(0)
    print(f"User {removed_user} was removed from the queue for game {game_id}")
    user_socket_id = user_socket_ids.get(removed_user['username'])
    if user_socket_id:
        socketio.emit('user_removed', {'game_id': game_id, 'user': removed_user}, room=user_socket_id)

    socketio.emit('queue_update', {'game_id': game_id, 'queue': queues[game_id]['queue'], 'wait_time': queues[game_id]['wait_time']})

    if queues[game_id]['queue']:
        queues[game_id]['timer_thread'] = threading.Thread(target=start_timer, args=(game_id,))
        queues[game_id]['timer_thread'].start()

@socketio.on('remove_user')
def handle_remove_user(data):
    game_id = data.get('game_id')
    game_index = int(game_id.split('_')[1])
    username = data.get('username')
    token = data.get('token')
    operator_code = data.get('operator_code')
    if operator_code == current_op_code[len(current_op_code)-1]:
        for user in queues[game_index]['queue']:
            if user['username'] == username:
                removed_user = queues[game_index]['queue'].remove(user)
                break
            else:
                removed_user = None
    else:
        removed_user = queues[game_index]['queue'].remove({'username': username, 'token': token})
    print(f"User {removed_user} was removed from the queue for game {game_id}")
    if len(queues[game_index]) == 0:
        queues[game_index]['timer_running'] = False
        queues[game_index]['timer_thread'] = None
        if queues[game_id]['queue']:
            queues[game_index]['timer_thread'] = threading.Thread(target=start_timer, args=(game_index,))
            queues[game_index]['timer_thread'].start()
    socketio.emit('queue_update', {
        'game_id': game_index,
        'queue': queues[game_index]['queue'],
        'wait_time': queues[game_index]['wait_time'],
    })

@socketio.on('join_queue')
def handle_join_queue(data):
    game_id = data.get('game_id')
    username = data.get('username')
    game_index = int(game_id.split('_')[1])
    token = data.get('token')
    queues[game_index]['queue'].append({'username': username, 'token': token})
    user_socket_ids[username] = request.sid

    if not queues[game_index]['timer_running']:
        queues[game_index]['timer_running'] = True
        queues[game_index]['timer_thread'] = threading.Thread(target=start_timer, args=(game_index,))
        queues[game_index]['timer_thread'].start()

    socketio.emit('queue_update', {
        'game_id': game_index,
        'queue': [{"username": user["username"], "token": user[f"token"]} for user in queues[game_index]['queue']],
        'wait_time': queues[game_index]['wait_time'],
    })

@socketio.on('connect')
def handle_connect():
    for i in range(len(queues)):
        emit('queue_update', {
            'game_id': i,
            'queue': queues[i]['queue'],
            'wait_time': queues[i]['wait_time'],
        })

@socketio.on('disconnect')
def handle_disconnect():
    pass

def init_routes(app):
    @app.route('/')
    @app.route('/index')
    def index():
        return render_template('index.html', title=f'{store_name} Queue', queue_list=queues, store=config_info['store'])

    @app.route('/join', methods=['GET', 'POST'])
    def join():
        return redirect(url_for('index'))

    @app.route('/api/get_token', methods=['GET'])
    def get_token():
        username = request.args.get('username')
        game_id = request.args.get('game_id')
        if not game_id or not username:
            raise Exception(f'Invalid game id {game_id} or username {username}')
        if username.strip() == '' or username == "‎":
            return
        game_index = int(game_id.split('_')[1])
        for user in queues[game_index]['queue']:
            if user['username'] == username:
                return
        key = randomize_string(app.config['SECRET_KEY'])
        token = jwt.encode({'username': username}, key, algorithm='HS256')
        return jsonify({f'token': token})
    @app.route('/api/operator', methods=['GET'])
    def operator():
        operator_code = request.args.get('operator_code')
        if str(operator_code) == str(config_info['store']['operator_code']):
            key = randomize_string(app.config['SECRET_KEY'])
            token = jwt.encode({'operator_code': operator_code}, key, algorithm='HS256')
            current_op_code.append(token)
            return jsonify({'token': token})
