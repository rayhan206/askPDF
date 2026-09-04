const admin = db.getSiblingDB("admin");

if (admin.getUser("askpdf_dev") === null) {
  admin.createUser({
    user: "askpdf_dev",
    pwd: "askpdf_dev_password",
    roles: [{ role: "readWrite", db: "askpdf" }],
  });
}
