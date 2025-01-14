from app import create_app, get_socket
from app.routes import init_routes

app = create_app()
socketio = get_socket()
if __name__ == '__main__':
    socketio.run(app, debug=True)
init_routes(app)
