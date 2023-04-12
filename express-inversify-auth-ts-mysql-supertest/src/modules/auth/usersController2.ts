// const userModel = require("./model");
// const Auth = require("../../utils/auth");
// const ApiError = require("../../apierror/ApiError");
// const User = require("./User");

// exports.signUp = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     password = await Auth.hash(req.body.password);
//     const id = await userModel.signUp(email, password);
//     res.status(201).json({ id: id, email: user.email });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const user = new User(await userModel.login(email));
//     await Auth.compare(password, user.password);
//     const token = Auth.signToken(user.id, user.email);
//     res.status(200).json({ id: user.id, email: user.email, token: token });
//   } catch (error) {
//     if (error instanceof ApiError) {
//       return res.status(error.status).json({ error: error.message });
//     }
//     res.status(500).json({ error: error.message });
//   }
// };
