from flask import Flask
from flask_socketio import SocketIO
from dotenv import load_dotenv
import os

load_dotenv()
debug = False;
if debug:
    socketio = SocketIO()
else:
    socketio = SocketIO(async_mode='eventlet')

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    socketio.init_app(app)
    return app

def get_socket():
    return socketio
