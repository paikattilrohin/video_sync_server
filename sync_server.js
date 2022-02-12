const debug = true;
const debug_level = 0;
const logs = false;
const secretkey = "hello";
const socket_connections_to_room = {};
let all_rooms = {};
const express = require("express")();
const server = require("http").createServer(express);
const io = require("socket.io")(server, {
  allowEIO3: true,
  cors: {
    origin: false,
    methods: ["GET", "POST"],
  },
});
const http = require("http");

const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiterOptions = {
  points: 10, // 6 points
  duration: 1, // Per second
  blockDuration: 15, // Block duration in seconds
};

const rateLimiter = new RateLimiterMemory(rateLimiterOptions);


const PORT = process.env.PORT || 8080;
server.listen(PORT, (msg) => {
  console.log(msg);
});


const wakeServerTime = 20; // in minutes
let wake = false;

function wakeServer(status) {
  if (status) {
    wake = setInterval( () => {
      if (!debug) {
        http.get('https://video-sync-extension-server.herokuapp.com/');
      }
    }, wakeServerTime * 60000);

  } else {
    clearInterval(wake);
    wake = false;
  }
}
// keep the server awake forever
wakeServer(true);




io.on("connection", (socket) => {

  socket.on('enter', (login_details) => {

    if (login_details.secretkey === secretkey) {
      let roomname = login_details.roomname;
      let username = login_details.username;
      socket_connections_to_room[socket.id] = roomname;
      if (!(all_rooms[roomname])) {
        all_rooms[roomname] = {};
        all_rooms[roomname].time_requested = false;
        all_rooms[roomname]["connected_users"] = {}
        all_rooms[roomname]["video_details"] = {}
        all_rooms[roomname].count = 0;
      }
      all_rooms[roomname].count++;
      all_rooms[roomname]["connected_users"][socket.id] = username;
      socket.join(roomname);
      socket.emit('enter', { successful: true, self: socket.id, room_details: all_rooms[roomname] });
      socket.broadcast.to(roomname).emit('connected_users', all_rooms[roomname]);
    }
    else {
      socket.emit('enter', { successful: false, reason: "Wrong Secret Key" });
      socket.disconnect();
    }
  });



  socket.on('disconnect', () => {
    console.log("deleting socket", socket.id);
    if (socket_connections_to_room[socket.id]) {
      let roomname = socket_connections_to_room[socket.id];
      socket.leave(roomname);
      delete all_rooms[roomname]["connected_users"][socket.id];
      all_rooms[roomname].count--;
      if (all_rooms[roomname].count == 5) {
        delete all_rooms[roomname];
      }
      else {
        socket.broadcast.to(roomname).emit('connected_users', all_rooms[roomname]);
      }
      delete socket_connections_to_room[socket.id];
    }
  });

  socket.on('share', (message) => {
    console.log(message);
    let roomname = socket_connections_to_room[socket.id];
    all_rooms[roomname]["video_details"] = message;
    console.log(all_rooms);
    socket.broadcast.to(roomname).emit("share", all_rooms[roomname]);    
    socket.emit("share", all_rooms[roomname]);   
  });


  socket.on('request_time', ()=>{
    console.log("-> time requested");
    let roomname = socket_connections_to_room[socket.id];
    all_rooms[roomname].time_requested = true;
    socket.broadcast.to(roomname).emit("get_time", {});   
    
  });



  socket.on('get_time', (data)=>{
    let roomname = socket_connections_to_room[socket.id];
    if(all_rooms[roomname].time_requested == true){
      socket.broadcast.to(roomname).emit("start_video", data); 
      
      all_rooms[roomname].time_requested = false;
    }
  });

  socket.on('transmit_video_event', (data)=>{
    console.log("->transmit event \n", data);
    let roomname = socket_connections_to_room[socket.id];

  
    socket.broadcast.to(roomname).emit("transmit_video_event", data);   
  });


});
