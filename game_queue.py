from app import create_app, get_socket
from app.routes import init_routes
from app.helpers import format_time
from dotenv import load_dotenv
import os

load_dotenv()
app = create_app()
app.jinja_env.globals.update(formatTime=format_time)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
socketio = get_socket()
init_routes(app)
