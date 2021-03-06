var express = require('express');
var cors = require("cors")
var bodyParser = require("body-parser")
var app = express();
var port = process.env.PORT || 8080

var db = require('./db');

db.connect();
db.query("CREATE DATABASE IF NOT EXISTS chat");
db.query("USE chat");
var sql = "CREATE TABLE IF NOT EXISTS user (user_id VARCHAR(50), user_pw VARCHAR(50), PRIMARY KEY(user_id))";
db.query(sql);
sql = "CREATE TABLE IF NOT EXISTS log (id int AUTO_INCREMENT, user_id VARCHAR(50), content VARCHAR(255), time VARCHAR(10), PRIMARY KEY(id))";
db.query(sql);
sql = "INSERT IGNORE INTO user (user_id, user_pw) VALUES('root', 'root')"
db.query(sql);

app.use(bodyParser.json());
app.use(cors());
app.get('/', function (req, res) {
  res.send('HI');
});

var user = require('./routes/User');
app.use('/user', user);

var msg = require('./routes/Msg');
app.use('/msg', msg);

var resetDB = require('./routes/ResetDB');
app.use('/resetdb', resetDB);

var server = app.listen(port, function(){
  console.log('server is running on port ' + port);
});

var socket = require('socket.io');
var io = socket(server);
var user_list = []

io.on('connection', (socket) => {
  const user_id = socket.handshake.query.user_id;
  if(user_list.indexOf(user_id) === -1) {
    user_list.push(user_id)
  }
  io.emit('NEW_USER', {"user_list": user_list, "user_id": user_id});

  socket.on('SEND_MESSAGE', (data) => {
    const time = new Date();
    var isRoot = false;
    if(data.user_id.length < 50 && data.content.length < 255) {
      if (data.user_id === 'root') isRoot = true;
      if (isRoot && data.content.substring(0, 14) === '/reset_message'){
        db.query("DELETE FROM log")
        return
      }
      if (isRoot && data.content.substring(0, 11) === '/reset_user'){
        db.query("DELETE FROM user WHERE user_id != 'root'")
        return
      }
      if (isRoot && data.content.substring(0, 10) === '/reset_all'){
        db.query("DELETE FROM user WHERE user_id != 'root'")
        db.query("DELETE FROM log")
        return
      }
      db.query("INSERT INTO log(user_id, content, time) VALUES (?,?,?)", [data.user_id, data.content, time.getHours()+':'+time.getMinutes()])
      io.emit('RECEIVE_MESSAGE', {"alert": false, "user_id": data.user_id, "content": data.content, "time": time.getHours()+':'+time.getMinutes()});
    }
  });

  socket.on('disconnect', () => {
    const idx = user_list.indexOf(user_id);
    user_list.splice(idx, 1);
    io.emit('OUT_USER', {"user_list": user_list, "user_id": user_id});
  });
});