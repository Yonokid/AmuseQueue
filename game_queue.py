import os

from dotenv import load_dotenv

from app import create_app, get_socket
from app.helpers import format_time
from app.routes import init_routes

load_dotenv()
app = create_app()
app.jinja_env.globals.update(formatTime=format_time)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
socketio = get_socket()
init_routes(app)
