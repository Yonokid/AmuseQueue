function vibrateDevice() {
    if ("vibrate" in navigator) {
        navigator.vibrate(5000);
    } else {
        console.log("Vibration not supported.");
    }
}
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}min ${remainingSeconds}sec`;
}
function createListItem(user) {
    var li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "align-items-center");
    li.setAttribute("username", user.username);
    li.setAttribute("game_id", "game_{{i}}");

    li.appendChild(createBlankColumn());
    li.appendChild(createUsernameColumn(user.username));
    li.appendChild(createDeleteButton(user));

    return li;
}

function createBlankColumn() {
    var blank_col = document.createElement("span");
    blank_col.classList.add("col");
    return blank_col;
}

function createUsernameColumn(username) {
    var usernameSpan = document.createElement("span");
    usernameSpan.classList.add("col");
    usernameSpan.textContent = username;
    return usernameSpan;
}

function createDeleteButton(user) {
    var spanDelete = document.createElement("span");
    spanDelete.classList.add("col", "d-flex", "justify-content-end");

    var deleteButton = document.createElement("button");
    deleteButton.classList.add("btn", "btn-danger", "btn-sm", "delete-btn");
    deleteButton.id = "deleteBtn_" + user.username;
    deleteButton.textContent = "Remove";
    spanDelete.appendChild(deleteButton);
    return spanDelete;
}
function createConfirmButton(user) {
    var spanConfirm = document.createElement("span");
    spanConfirm.classList.add("col", "d-flex", "justify-content-end");

    var confirmButton = document.createElement("button");
    confirmButton.classList.add("btn", "btn-primary", "btn-sm", "confirm-btn");
    confirmButton.id = "confirmBtn_" + user.username;
    confirmButton.textContent = "Confirm";
    spanConfirm.appendChild(confirmButton);
    return spanConfirm;
}
document.addEventListener("DOMContentLoaded", function () {
    var socket = io.connect(
        location.protocol + "//" + document.domain + ":" + location.port,
    );
    var forms = document.querySelectorAll('[id^="join-form_"]');

    forms.forEach(function (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var i = parseInt(form.id.split("_")[1]);
            var username = document.getElementById("username_" + i).value;
            var game_id = i;
            fetch(`/api/get_token?username=${username}&game_id=${game_id}`)
                .then((response) => response.json())
                .then((data) => {
                    var token = data.token;
                    localStorage.setItem("token_" + i, token);
                    var join_button = document.getElementById(
                        "join_button_" + i,
                    );
                    join_button.classList.toggle("invisible");
                    socket.emit("join_queue", {
                        username: username,
                        game_id: game_id,
                        token: token,
                    });
                    var modal = bootstrap.Modal.getInstance(
                        document.getElementById("joinModal_" + i),
                    );
                    modal.hide();
                })
                .catch((error) => {
                    var modalText = document.getElementById(
                        "joinModalText_" + i,
                    );
                    modalText.textContent = "Invalid Username!";
                    modalText.classList.add("text-danger-emphasis");
                    console.error("Error fetching token:", error);
                });
        });
        var gameQueues = document.querySelectorAll('[id^="queue_"]');
        gameQueues.forEach(function (queueElement) {
            var gameId = parseInt(queueElement.id.split("_")[1]);
            queueElement.addEventListener("click", function (event) {
                if (
                    event.target &&
                    event.target.classList.contains("delete-btn")
                ) {
                    const listItem = event.target.closest("li");
                    const username = listItem.getAttribute("username");
                    const op_code = localStorage.getItem("operator_code");
                    socket.emit("remove_user", {
                        username: username,
                        game_id: gameId,
                        token: localStorage.getItem("token_" + gameId),
                        operator_code: op_code,
                    });
                    var join_button = document.getElementById(
                        "join_button_" + gameId,
                    );
                    join_button.classList.toggle("invisible");
                }
            });
            queueElement.addEventListener("click", function (event) {
                if (
                    event.target &&
                    event.target.classList.contains("confirm-btn")
                ) {
                    const listItem = event.target.closest("li");
                    const username = listItem.getAttribute("username");
                    const op_code = localStorage.getItem("operator_code");
                    socket.emit("remove_user", {
                        username: username,
                        game_id: gameId,
                        token: localStorage.getItem("token_" + username),
                        operator_code: op_code,
                    });
                    var join_button = document.getElementById(
                        "join_button_" + gameId,
                    );
                    join_button.classList.toggle("invisible");
                }
            });
            socket.on("queue_update", function (data) {
                if (data.game_id == gameId) {
                    queueElement.innerHTML = "";
                    data.queue.forEach(function (user) {
                        var isCurrentUser =
                            localStorage.getItem("token_" + gameId) ==
                            user.token;
                        var join_button = document.getElementById(
                            "join_button_" + gameId,
                        );
                        if (join_button) {
                            join_button.classList.toggle(
                                "invisible",
                                isCurrentUser,
                            );
                        }
                        var li = createListItem(user);
                        queueElement.appendChild(li);
                        var countdown = document.createElement("div");
                        countdown.id = "countdown_" + gameId;
                        queueElement.appendChild(countdown);
                        var deleteButton = document.getElementById(
                            "deleteBtn_" + user.username,
                        );
                        deleteButton.classList.toggle(
                            "invisible",
                            !isCurrentUser,
                        );
                    });
                }
            });
            socket.on("timer_update", function (data) {
                var countdownDisplay = document.getElementById(
                    "countdown_" + data.game_id,
                );
                if (
                    data.time_left > 0 &&
                    data.time_left != null &&
                    countdownDisplay != null
                ) {
                    countdownDisplay.textContent = `Time left: ${formatTime(data.time_left)}`;
                }
            });
            socket.on("user_removed", function (data) {
                if (
                    data.token == localStorage.getItem("token_" + gameId) ||
                    data.token ==
                        localStorage.getItem("token_" + gameId + gameId)
                ) {
                    localStorage.removeItem("token_" + gameId);
                    localStorage.removeItem("token_" + gameId + gameId);
                    var join_button = document.getElementById(
                        "join_button_" + data.game_id,
                    );
                    join_button.classList.remove("invisible");
                    vibrateDevice();
                    if (data.operator) {
                        setTimeout(function () {
                            alert(
                                "An operator removed you from the " +
                                    data.game_name +
                                    " queue.",
                            );
                        }, 1000);
                    } else if (data.timed_out) {
                        setTimeout(function () {
                            alert(
                                "You were removed from the " +
                                    data.game_name +
                                    " queue as you did not confirm your spot.",
                            );
                        }, 1000);
                    }
                }
            });
            socket.on("user_confirm", function (data) {
                if (data.token == localStorage.getItem("token_" + gameId)) {
                    var user = data.user;
                    localStorage.setItem(
                        "token_" + gameId + gameId,
                        data.token,
                    );
                    var isCurrentUser =
                        localStorage.getItem("token_" + gameId) == user.token;
                    localStorage.removeItem("token_" + gameId);
                    var queue = document.getElementById("queue_" + gameId);
                    var queueItems = queue.getElementsByTagName("li");
                    queueItems[0].classList.add("bg-warning");
                    var confirmButton = createConfirmButton(user);
                    queueItems[0].appendChild(confirmButton);
                    queueItems[0].children[2].remove();
                    vibrateDevice();
                    setTimeout(function () {
                        alert(
                            "Time is up! Head to the " +
                                data.game_name +
                                " machine! You have 2 minutes to confirm your spot.",
                        );
                    }, 1000);
                }
            });
        });
    });
});
