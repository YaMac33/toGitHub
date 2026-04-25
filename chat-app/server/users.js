const users = [
  {
    id: "userA",
    name: "userA",
    username: "userA",
    password: "passA",
  },
  {
    id: "userB",
    name: "userB",
    username: "userB",
    password: "passB",
  },
];

function findUser(username, password) {
  return users.find(
    (user) => user.username === username && user.password === password
  );
}

module.exports = {
  findUser,
};
