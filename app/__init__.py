from flask import Flask
from flask_socketio import SocketIO

debug = True
if debug:
    socketio = SocketIO()
else:
    socketio = SocketIO(async_mode='eventlet')

def create_app():
    app = Flask(__name__)
    socketio.init_app(app)
    return app

def get_socket():
    return socketio
