import math
import random
import threading
from typing import Optional

import jwt
import tomllib


class Queue:
    def __init__(self, game_id, name, wait_time, confirm_time, double_queue):
        self.name = name
        self.game_id = game_id
        self.wait_time = wait_time
        self.confirm_time = confirm_time
        self.timer_thread: Optional[threading.Thread] = None
        self.timer_running = False
        self.time_left = self.wait_time
        self.operator = False
        self.queue: list[list[Player]] = []
        self.double_queue = double_queue

    def get_info(self) -> dict:
        return {'game_id': self.game_id, 'name': self.name,
                'wait_time': self.wait_time, 'confirm_time': self.confirm_time,
                'time_left': self.time_left, 'operator': self.operator,
                'queue': [[player.get_info() for player in sublist] for sublist in self.queue]}

class Player:
    def __init__(self, name, token, solo_queue=False):
        self.username = name
        self.token = token
        self.timed_out = False
        self.solo_queue = solo_queue
        self.is_confirming = False
    def __eq__(self, other):
        if isinstance(other, Player):
            return self.username == other.username and self.token == other.token
        return False

    def __hash__(self):
        return hash((self.username, self.token))

    def get_info(self):
        return {'username': self.username, 'token': self.token,
                'solo_queue': self.solo_queue, 'timed_out': self.timed_out,
                'is_confirming': self.is_confirming}

def format_time(seconds: int) -> str:
    mins = math.floor(seconds / 60)
    remaining_sec = seconds % 60
    return f'{mins}min {remaining_sec}sec'

def load_config() -> dict:
    with open('config.toml', 'rb') as f:
        config_info = tomllib.load(f)
    return config_info

def create_queues(config_info: dict) -> list[Queue]:
    queues = []
    for i in range(len(config_info)+1):
        if f'game_{i}' in config_info:
            queue = Queue(i-1, config_info[f'game_{i}']["name"],
                        config_info[f'game_{i}']["wait_time"],
                        config_info[f'game_{i}']["confirm_time"],
                        config_info[f'game_{i}']["double_queue"])
            queues.append(queue)
    return queues

def randomize_string(input_string: str) -> str:
    char_list = list(input_string)
    random.shuffle(char_list)
    randomized_string = ''.join(char_list)
    return randomized_string

def get_random_token(input: str, secret_key: str) -> str:
    key = randomize_string(secret_key)
    encode_dict = dict()
    encode_dict[input] = input
    token = jwt.encode(encode_dict, key, algorithm='HS256')
    return token

def username_filtered(username: str, queue: Queue) -> bool:
    if not username:
        return True
    if username.strip() == '' or username == "‎":
        return True
    for group in queue.queue:
        for user in group:
            if user.username == username:
                return True
    return False

def verify_operator_code(operator_code: str, current_op_code: str) -> bool:
    if current_op_code == '':
        return False
    if operator_code != current_op_code:
        return False
    return True
