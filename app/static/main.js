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
          var join_button = document.getElementById("join_button_" + i);
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
          var modalText = document.getElementById("joinModalText_" + i);
          modalText.textContent = "Invalid Username!";
          modalText.classList.add("text-danger-emphasis");
          console.error("Error fetching token:", error);
        });
    });
    var gameQueues = document.querySelectorAll('[id^="queue_"]');
    gameQueues.forEach(function (queueElement) {
      var gameId = parseInt(queueElement.id.split("_")[1]);
      queueElement.addEventListener("click", function (event) {
        if (event.target && event.target.classList.contains("delete-btn")) {
          const listItem = event.target.closest("li");
          const username = listItem.getAttribute("username");
          const op_code = localStorage.getItem("operator_code");
          socket.emit("remove_user", {
            username: username,
            game_id: gameId,
            token: localStorage.getItem("token_" + gameId),
            operator_code: op_code,
          });
          var join_button = document.getElementById("join_button_" + gameId);
          join_button.classList.toggle("invisible");
        }
      });
      socket.on("queue_update", function (data) {
        if (data.game_id == gameId) {
          queueElement.innerHTML = "";
          data.queue.forEach(function (user) {
            var isCurrentUser =
              localStorage.getItem("token_" + gameId) == user.token;
            var join_button = document.getElementById("join_button_" + gameId);
            join_button.classList.toggle("invisible", isCurrentUser);
            var li = createListItem(user, join_button);
            queueElement.appendChild(li);
            var countdown = document.createElement("div");
            countdown.id = "countdown_" + gameId;
            queueElement.appendChild(countdown);
            var deleteButton = document.getElementById(
              "deleteBtn_" + user.username,
            );
            deleteButton.classList.toggle("invisible", !isCurrentUser);
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
        if (data.token == localStorage.getItem("token_" + gameId)) {
          var join_button = document.getElementById(
            "join_button_" + data.game_id,
          );
          join_button.classList.remove("invisible");
          vibrateDevice();
          if (!data.operator) {
            setTimeout(function () {
              alert(
                "Time is up! Head to the " +
                  data.game_name +
                  " machine to start your credit!",
              );
            }, 1000);
          } else {
            setTimeout(function () {
              alert(
                "An operator removed you from the " +
                  data.game_name +
                  " queue.",
              );
            }, 1000);
          }
        }
      });
    });
  });
});
