const Role = require("../models/role.model");
const USER_ROLES = require("../constants/userRoles.constant.js");

const seedRoles = async () => {
  const roles = Object.values(USER_ROLES);
  await Promise.all(
    roles.map((roleName) =>
      Role.findOrCreate({
        where: { name: roleName },
        defaults: { name: roleName },
      }),
    ),
  );
};

module.exports = seedRoles;
