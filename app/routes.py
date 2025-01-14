from flask import render_template, url_for, redirect, request
from . import socketio
import tomllib
import time
import threading
from flask_socketio import emit, join_room, leave_room

with open('config.toml', 'rb') as f:
    config_info = tomllib.load(f)

queues = []
for i in range(len(config_info)+1):
    if f'game_{i}' in config_info:
        queues.append(config_info[f'game_{i}'])

for queue in queues:
    queue['queue'] = []
    queue['timer_thread'] = None
    queue['timer_running'] = False
user_socket_ids = {}

def start_timer(game_id):
    # Set the timer_running flag to True to prevent multiple threads from starting
    queues[game_id]['timer_running'] = True

    time_left = queues[game_id]['wait_time']
    while time_left > 0:
        socketio.emit('timer_update', {'game_id': game_id, 'time_left': time_left})
        time.sleep(1)
        time_left -= 1

    removed_user = queues[game_id]['queue'].pop(0)
    print(f"User {removed_user} was removed from the queue for game {game_id}")
    user_socket_id = user_socket_ids.get(removed_user)
    if user_socket_id:
        socketio.emit('user_removed', {'game_id': game_id, 'user': removed_user}, room=user_socket_id)

    socketio.emit('queue_update', {'game_id': game_id, 'queue': queues[game_id]['queue'], 'wait_time': queues[game_id]['wait_time']})

    # Once the timer finishes, reset the flag and check if the queue is still not empty
    queues[game_id]['timer_running'] = False
    queues[game_id]['timer_thread'] = None

    if queues[game_id]['queue']:
        start_timer(game_id)

@socketio.on('join_queue')
def handle_join_queue(data):
    game_id = data.get('game_id')
    username = data.get('username')

    if not game_id or not username:
        raise Exception(f'Invalid game id {game_id} or username {username}')

    game_index = int(game_id.split('_')[1])
    if username in queues[game_index]['queue'] or username == '' or username is None or username.strip() == '':
        return
    queues[game_index]['queue'].append(username)
    user_socket_ids[username] = request.sid

    # Only start a new timer if one is not already running
    if not queues[game_index]['timer_running']:
        queues[game_index]['timer_running'] = True  # Set the flag to indicate the timer is starting
        queues[game_index]['timer_thread'] = threading.Thread(target=start_timer, args=(game_index,))
        queues[game_index]['timer_thread'].start()

    socketio.emit('queue_update', {
        'game_id': game_index,
        'queue': queues[game_index]['queue'],
        'wait_time': queues[game_index]['wait_time']
    })

@socketio.on('connect')
def handle_connect():
    emit('queue_list', {'queues': queues, 'store': config_info['store']})

@socketio.on('disconnect')
def handle_disconnect():
    # You might want to remove the user from the queue when they disconnect, if necessary
    pass

def init_routes(app):
    @app.route('/')
    @app.route('/index')
    def index():
        store_name = config_info['store']['store_name']
        return render_template('index.html', title=f'{store_name} Queue', queue_list=queues, store=config_info['store'])

    @app.route('/join', methods=['GET', 'POST'])
    def join():
        return redirect(url_for('index'))
