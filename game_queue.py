from app import create_app, get_socket
from app.routes import init_routes

app = create_app()
socketio = get_socket()
init_routes(app)
