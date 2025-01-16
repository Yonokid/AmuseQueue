from app import create_app, get_socket
from app.routes import init_routes

debug = False;
app = create_app()
socketio = get_socket()
if __name__ == '__main__' and debug == True:
    socketio.run(app, debug=True)
init_routes(app)
