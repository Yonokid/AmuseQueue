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
function createListItem(group, index, isOperator) {
    var li = document.createElement("li");
    li.classList.add(
        "list-group-item",
        "d-flex",
        "flex-row",
        "align-items-center",
        "gap-2",
    );
    li.setAttribute("data-group-index", index);

    if (isOperator) {
        li.setAttribute("draggable", "true");
        li.classList.add("draggable-queue-item");
        li.style.cursor = "move";
    }

    group.forEach(function (user, userIndex) {
        var user_group = document.createElement("div");
        user_group.classList.add(
            "d-flex",
            "align-items-center",
            "flex-grow-1",
            "gap-2",
            "player-entry",
        );
        user_group.setAttribute("username", user.username);
        user_group.setAttribute("data-group-index", index);

        if (isOperator) {
            user_group.setAttribute("draggable", "true");
            user_group.classList.add("draggable-player");
            user_group.style.cursor = "move";
            user_group.style.padding = "0.25rem";
            user_group.style.margin = "0.125rem 0";
            user_group.style.borderRadius = "0.25rem";
        }

        if (isOperator) {
            user_group.appendChild(createDragHandle());
        } else {
            user_group.appendChild(createBlankColumn());
        }
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

function createDragHandle() {
    var dragHandle = document.createElement("span");
    dragHandle.classList.add("col");
    dragHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';
    dragHandle.style.cursor = "grab";
    return dragHandle;
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
function showBrowserNotification(title, message, icon = null) {
    if (typeof Notification === "undefined" || !("Notification" in window)) {
        console.warn("Browser notifications are not supported");
        return;
    }
    if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        location.protocol === "https:"
    ) {
        const notification = new Notification(title, {
            body: message,
            icon: icon || "/favicon.ico",
            badge: icon || "/favicon.ico",
            tag: "game-notification",
            requireInteraction: true,
            silent: false,
        });

        setTimeout(() => {
            notification.close();
        }, 10000);

        notification.onclick = function () {
            window.focus();
            notification.close();
        };
    }
}
document.addEventListener("DOMContentLoaded", function () {
    var socket = io.connect(
        location.protocol + "//" + document.domain + ":" + location.port,
    );
    var forms = document.querySelectorAll('[id^="join-form_"]');

    forms.forEach(function (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (location.protocol === "https:") {
                if (
                    typeof Notification === "undefined" ||
                    !("Notification" in window)
                ) {
                    console.warn("Browser notifications are not supported");
                } else {
                    Notification.requestPermission();
                }
            }
            var i = parseInt(form.id.split("_")[1]);
            var username = document.getElementById("username_" + i).value;
            var game_id = i;
            var element = document.getElementById("soloQueue_" + i);
            var isSoloQueue = element ? element.checked : null;
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
                        solo_queue: isSoloQueue,
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
                    var join_button = document.getElementById(
                        "join_button_" + gameId,
                    );
                    join_button.classList.remove("invisible");
                    socket.emit("remove_user", {
                        username: username,
                        game_id: gameId,
                        token: localStorage.getItem("token_" + gameId),
                        operator_code: op_code,
                    });
                    localStorage.removeItem("token_" + gameId);
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

                const isOperator =
                    localStorage.getItem("operator_code") !== null;

                // Process each group in the queue
                data.queue.forEach(function (group, index) {
                    const listItem = createListItem(group, index, isOperator);
                    fragment.appendChild(listItem);

                    // Loop through users in each group
                    group.forEach(function (user) {
                        const isCurrentUser = userTokens.includes(user.token);
                        const joinButton = document.getElementById(
                            "join_button_" + gameId,
                        );
                        const deleteButton = listItem.querySelector(
                            "#deleteBtn_" + user.username,
                        );
                        const confirmButton = listItem.querySelector(
                            "#confirmBtn_" + user.username,
                        );
                        // Toggle visibility based on conditions
                        if (joinButton) {
                            if (isCurrentUser) {
                                joinButton.classList.add("invisible");
                            }
                        }

                        if (deleteButton) {
                            deleteButton.classList.toggle(
                                "invisible",
                                !(isCurrentUser && !user.is_confirming),
                            );
                        }

                        if (confirmButton) {
                            confirmButton.classList.toggle(
                                "invisible",
                                !(isCurrentUser && user.is_confirming),
                            );
                        }
                    });
                });

                // Append the fragment after processing all groups
                queueElement.appendChild(fragment);

                // Add the countdown
                const countdown = document.createElement("div");
                countdown.id = "countdown_" + gameId;
                queueElement.appendChild(countdown);

                // Setup drag-and-drop for operators
                if (isOperator) {
                    setupDragAndDrop(queueElement, gameId, socket);
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
                const user = JSON.parse(data.user);
                if (
                    user.token == localStorage.getItem("token_" + gameId) ||
                    user.token == localStorage.getItem("token2_" + gameId)
                ) {
                    localStorage.removeItem("token_" + gameId);
                    localStorage.removeItem("token2_" + gameId);
                    var join_button = document.getElementById(
                        "join_button_" + gameId,
                    );
                    join_button.classList.remove("invisible");
                    vibrateDevice();
                    if (data.queue.operator) {
                        const message =
                            "An operator removed you from the " +
                            data.queue.name +
                            " queue.";
                        showBrowserNotification(
                            "Removed",
                            message,
                            "/path/to/your/icon.png",
                        );
                        setTimeout(function () {
                            alert(message);
                        }, 1000);
                    } else if (user.timed_out) {
                        const message =
                            "You were removed from the " +
                            data.queue.name +
                            " queue as you did not confirm your spot.";
                        showBrowserNotification(
                            "Removed",
                            message,
                            "/path/to/your/icon.png",
                        );
                        setTimeout(function () {
                            alert(message);
                        }, 1000);
                    }
                }
            });
            socket.on("user_confirm", function (data) {
                var group = data.queue[0];
                group.forEach(function (user) {
                    if (user.token == localStorage.getItem("token_" + gameId)) {
                        localStorage.setItem("token2_" + gameId, user.token);
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
                        const message =
                            "Time is up! Head to the " +
                            data.name +
                            " machine! You have 2 minutes to confirm your spot.";
                        showBrowserNotification(
                            "Your Turn - " + data.name,
                            message,
                            "/path/to/your/icon.png",
                        );
                        setTimeout(function () {
                            alert(message);
                        }, 1000);
                    }
                });
            });
        });

        // Drag-and-Drop functionality for queue reordering
        function setupDragAndDrop(queueElement, gameId, socket) {
            let draggedElement = null;
            let draggedType = null; // 'group' or 'player'
            let draggedData = {};

            const groupItems = queueElement.querySelectorAll(
                ".draggable-queue-item",
            );

            groupItems.forEach((item) => {
                item.addEventListener("dragstart", function (e) {
                    // Only drag group if not dragging a player
                    if (e.target.classList.contains("draggable-player")) {
                        e.stopPropagation();
                        return;
                    }

                    draggedElement = this;
                    draggedType = "group";
                    draggedData = {
                        groupIndex: parseInt(
                            this.getAttribute("data-group-index"),
                        ),
                    };
                    this.style.opacity = "0.5";
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/html", this.innerHTML);
                });

                item.addEventListener("dragend", function (e) {
                    this.style.opacity = "1";
                    groupItems.forEach((item) => {
                        item.classList.remove("drag-over");
                    });
                });

                item.addEventListener("dragover", function (e) {
                    if (e.preventDefault) {
                        e.preventDefault();
                    }

                    if (draggedType === "group") {
                        e.dataTransfer.dropEffect = "move";
                    }
                    return false;
                });

                item.addEventListener("dragenter", function (e) {
                    if (draggedType === "group" && this !== draggedElement) {
                        this.classList.add("drag-over");
                    }
                });

                item.addEventListener("dragleave", function (e) {
                    this.classList.remove("drag-over");
                });

                item.addEventListener("drop", function (e) {
                    if (e.stopPropagation) {
                        e.stopPropagation();
                    }

                    if (draggedType === "group" && draggedElement !== this) {
                        const newIndex = parseInt(
                            this.getAttribute("data-group-index"),
                        );
                        const operatorCode =
                            localStorage.getItem("operator_code");

                        socket.emit("reorder_queue", {
                            game_id: gameId,
                            old_index: draggedData.groupIndex,
                            new_index: newIndex,
                            operator_code: operatorCode,
                        });
                    }

                    return false;
                });
            });

            // Setup for individual players
            const playerItems =
                queueElement.querySelectorAll(".draggable-player");

            playerItems.forEach((player) => {
                player.addEventListener("dragstart", function (e) {
                    e.stopPropagation(); // Prevent group drag
                    draggedElement = this;
                    draggedType = "player";
                    draggedData = {
                        username: this.getAttribute("username"),
                        sourceGroupIndex: parseInt(
                            this.getAttribute("data-group-index"),
                        ),
                    };
                    this.style.opacity = "0.5";
                    this.style.backgroundColor = "rgba(13, 110, 253, 0.2)";
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", draggedData.username);
                });

                player.addEventListener("dragend", function (e) {
                    this.style.opacity = "1";
                    this.style.backgroundColor = "";
                    playerItems.forEach((p) => {
                        p.classList.remove("player-drag-over");
                    });
                    groupItems.forEach((g) => {
                        g.classList.remove("group-drag-over");
                    });
                });

                player.addEventListener("dragover", function (e) {
                    if (e.preventDefault) {
                        e.preventDefault();
                    }

                    if (draggedType === "player") {
                        e.dataTransfer.dropEffect = "move";
                    }
                    return false;
                });

                player.addEventListener("dragenter", function (e) {
                    if (draggedType === "player" && this !== draggedElement) {
                        this.classList.add("player-drag-over");
                    }
                });

                player.addEventListener("dragleave", function (e) {
                    this.classList.remove("player-drag-over");
                });

                player.addEventListener("drop", function (e) {
                    if (e.stopPropagation) {
                        e.stopPropagation();
                    }
                    e.preventDefault();

                    if (draggedType === "player" && draggedElement !== this) {
                        const targetGroupIndex = parseInt(
                            this.getAttribute("data-group-index"),
                        );
                        const operatorCode =
                            localStorage.getItem("operator_code");

                        socket.emit("move_player", {
                            game_id: gameId,
                            player_username: draggedData.username,
                            source_group_index: draggedData.sourceGroupIndex,
                            target_group_index: targetGroupIndex,
                            operator_code: operatorCode,
                        });
                    }

                    return false;
                });
            });

            // Also allow dropping players on group items (li elements) to add to end of group
            groupItems.forEach((item) => {
                item.addEventListener("dragover", function (e) {
                    if (draggedType === "player") {
                        if (e.preventDefault) {
                            e.preventDefault();
                        }
                        e.dataTransfer.dropEffect = "move";
                        return false;
                    }
                });

                item.addEventListener("dragenter", function (e) {
                    if (
                        draggedType === "player" &&
                        !this.contains(draggedElement)
                    ) {
                        this.classList.add("group-drag-over");
                    }
                });

                item.addEventListener("dragleave", function (e) {
                    // Only remove if we're leaving the entire group
                    if (!this.contains(e.relatedTarget)) {
                        this.classList.remove("group-drag-over");
                    }
                });

                item.addEventListener("drop", function (e) {
                    if (draggedType === "player") {
                        if (e.stopPropagation) {
                            e.stopPropagation();
                        }
                        e.preventDefault();

                        const targetGroupIndex = parseInt(
                            this.getAttribute("data-group-index"),
                        );
                        const operatorCode =
                            localStorage.getItem("operator_code");

                        // Don't emit if dropping back in the same group
                        if (draggedData.sourceGroupIndex !== targetGroupIndex) {
                            socket.emit("move_player", {
                                game_id: gameId,
                                player_username: draggedData.username,
                                source_group_index:
                                    draggedData.sourceGroupIndex,
                                target_group_index: targetGroupIndex,
                                operator_code: operatorCode,
                            });
                        }

                        return false;
                    }
                });
            });
        }

        const style = document.createElement("style");
        style.textContent = `
            .drag-over {
                border-top: 3px solid #0d6efd !important;
            }
            .draggable-queue-item {
                transition: opacity 0.2s;
            }
            .player-drag-over {
                background-color: rgba(13, 110, 253, 0.3) !important;
                border-radius: 0.25rem;
            }
            .group-drag-over {
                background-color: rgba(13, 110, 253, 0.15) !important;
                border: 2px dashed #0d6efd !important;
            }
            .draggable-player {
                transition: all 0.2s;
            }
            .draggable-player:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);
    });
});
