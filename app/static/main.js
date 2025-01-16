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
