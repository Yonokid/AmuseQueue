import math
import random

import jwt
import tomllib


def format_time(seconds: int) -> str:
    mins = math.floor(seconds / 60)
    remaining_sec = seconds % 60
    return f'{mins}min {remaining_sec}sec'

def load_config() -> dict:
    with open('config.toml', 'rb') as f:
        config_info = tomllib.load(f)
    return config_info

def create_queues(config_info: dict) -> list[dict]:
    queues = []
    for i in range(len(config_info)+1):
        if f'game_{i}' in config_info:
            queues.append(config_info[f'game_{i}'])

    for queue in queues:
        queue['queue'] = []
        queue['timer_thread'] = None
        queue['timer_running'] = False
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

def username_filtered(username: str, queue: dict) -> bool:
    if not username:
        return True
    if username.strip() == '' or username == "‎":
        return True
    for user in queue:
        if user['username'] == username:
            return True
    return False

def verify_operator_code(operator_code: str, current_op_code: str) -> bool:
    if current_op_code == '':
        return False
    if operator_code != current_op_code:
        return False
    return True
