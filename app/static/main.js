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
function createListItem(group) {
    var li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "align-items-center");

    group.forEach(function (user) {
        var user_group = document.createElement("div");
        user_group.classList.add(
            "d-flex",
            "align-items-center",
            "w-100",
            "gap-2",
        ); // Ensures it fills the space
        user_group.setAttribute("username", user.username);

        user_group.appendChild(createBlankColumn());
        user_group.appendChild(createUsernameColumn(user.username));
        if (user.is_confirming) {
            li.classList.add("bg-warning");
            user_group.appendChild(createConfirmButton(user));
        } else {
            user_group.appendChild(createDeleteButton(user));
        }
        li.appendChild(user_group);
    });

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
                    const listItem = event.target.closest("div");
                    const username = listItem.getAttribute("username");
                    const op_code = localStorage.getItem("operator_code");
                    socket.emit("remove_user", {
                        username: username,
                        game_id: gameId,
                        token: localStorage.getItem("token_" + gameId),
                        operator_code: op_code,
                    });
                    localStorage.removeItem("token_" + gameId);
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
                    const listItem = event.target.closest("div");
                    const username = listItem.getAttribute("username");
                    const op_code = localStorage.getItem("operator_code");
                    socket.emit("remove_user", {
                        username: username,
                        game_id: gameId,
                        token: localStorage.getItem("token2_" + gameId),
                        operator_code: op_code,
                    });
                    localStorage.removeItem("token2_" + gameId);
                    var join_button = document.getElementById(
                        "join_button_" + gameId,
                    );
                    join_button.classList.remove("invisible");
                }
            });
            socket.on("queue_update", function (data) {
                if (data.game_id !== gameId) return;
                queueElement.innerHTML = "";
                const fragment = document.createDocumentFragment();
                const userTokens = [
                    localStorage.getItem("token_" + gameId),
                    localStorage.getItem("token2_" + gameId),
                ].filter(Boolean);
                data.queue.forEach(function (group) {
                    const listItem = createListItem(group);
                    fragment.appendChild(listItem);

                    fragment.querySelectorAll(".delete-btn").forEach((btn) => {
                        btn.classList.toggle("invisible");
                    });
                    fragment.querySelectorAll(".confirm-btn").forEach((btn) => {
                        btn.classList.toggle("invisible");
                    });
                    group.forEach(function (user) {
                        const isCurrentUser = userTokens.includes(user.token);

                        const joinButton = fragment.getElementById(
                            "join_button_" + gameId,
                        );
                        const deleteButton = fragment.getElementById(
                            "deleteBtn_" + user.username,
                        );
                        const confirmButton = fragment.getElementById(
                            "confirmBtn_" + user.username,
                        );
                        joinButton?.classList.toggle(
                            "invisible",
                            joinButton && (isCurrentUser || user.is_confirming),
                        );
                        if (deleteButton) {
                            if (isCurrentUser && !user.is_confirming) {
                                deleteButton.classList.remove("invisible");
                            }
                        }
                        if (confirmButton) {
                            if (isCurrentUser && user.is_confirming) {
                                confirmButton.classList.remove("invisible");
                            }
                        }
                    });
                });

                queueElement.appendChild(fragment);

                const countdown = document.createElement("div");
                countdown.id = "countdown_" + gameId;
                queueElement.appendChild(countdown);
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
                const user = JSON.parse(data.user);
                if (
                    user.token == localStorage.getItem("token_" + gameId) ||
                    user.token == localStorage.getItem("token2_" + gameId)
                ) {
                    vibrateDevice();
                    if (data.queue.operator) {
                        setTimeout(function () {
                            alert(
                                "An operator removed you from the " +
                                    data.queue.name +
                                    " queue.",
                            );
                        }, 1000);
                    } else if (user.timed_out) {
                        setTimeout(function () {
                            alert(
                                "You were removed from the " +
                                    data.queue.name +
                                    " queue as you did not confirm your spot.",
                            );
                        }, 1000);
                    }
                }
            });
            socket.on("user_confirm", function (data) {
                var group = data.queue[0];
                group.forEach(function (user) {
                    if (user.token == localStorage.getItem("token_" + gameId)) {
                        localStorage.setItem("token2_" + gameId, user.token);
                        var isCurrentUser =
                            localStorage.getItem("token_" + gameId) ==
                            user.token;
                        localStorage.removeItem("token_" + gameId);
                        var confirmButton = createConfirmButton(user);
                        var queue = document.getElementById("queue_" + gameId);
                        var queueItems = queue.getElementsByTagName("li");
                        var matchingDiv = Array.from(queueItems)
                            .map((item) =>
                                Array.from(
                                    item.getElementsByTagName("div"),
                                ).find(
                                    (div) =>
                                        div.getAttribute("username") ===
                                        user.username,
                                ),
                            )
                            .filter(Boolean);
                        queueItems[0].classList.add("bg-warning");
                        if (matchingDiv.length > 0) {
                            matchingDiv[0].appendChild(confirmButton);
                            matchingDiv[0].children[2].remove();
                        }
                        vibrateDevice();
                        setTimeout(function () {
                            alert(
                                "Time is up! Head to the " +
                                    data.name +
                                    " machine! You have 2 minutes to confirm your spot.",
                            );
                        }, 1000);
                    }
                });
            });
        });
    });
});
