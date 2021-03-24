const mongoose = require('mongoose');
mongoose.connect("mongodb://localhost/fortuneteller", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.Promise = global.Promise;

const User = require('./user')
User.collection.drop();

User.create([{
  username: 'walrus',
  password: 'walrus'
}, {
  username: 'whale',
  password: 'whale'
}])
.then(user => {
  console.log(`${user.length} users created`);
})
.catch((err) => {
  console.log(err);
})
.finally(() => {
  mongoose.connection.close();
})