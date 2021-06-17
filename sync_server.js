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
  // console.log(`Listening on ${PORT}`);
  console.log(msg);
});


const wakeServerTime = 20; // in minutes
let wake = false;

function wakeServer(status) {
  if (status) {
    wake = setInterval( () => {
      // console.log("running Every 1 minute");
      if (!debug) {
        http.get('http://syncevent.herokuapp.com');
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
  console.log("------------------------------------------------------------------------------------");
  console.log(" connecting socket ", socket.id);


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
    console.log("all rooms", all_rooms);
    console.log("socket to rooms", socket_connections_to_room);

  });



  socket.on('disconnect', () => {
    console.log("deleting socket", socket.id);
    if (socket_connections_to_room[socket.id]) {
      let roomname = socket_connections_to_room[socket.id];
      socket.leave(roomname);
      delete all_rooms[roomname]["connected_users"][socket.id];
      all_rooms[roomname].count--;
      //////////////// CHANGE THIS TO < 1 ----------------------------------------------------------------------------------------------- Important
      if (all_rooms[roomname].count == 5) {
        delete all_rooms[roomname];
      }
      else {
        console.log("update user list ");
        socket.broadcast.to(roomname).emit('connected_users', all_rooms[roomname]);
      }
      delete socket_connections_to_room[socket.id];
      console.log("all rooms", all_rooms);
      console.log("socket to rooms", socket_connections_to_room);
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
    socket.broadcast.to(roomname).emit("get_time", {});   // <------change this while locally testing
    // socket.emit("get_time", {});   // <-----   change to this later while locally testing
  });



  socket.on('get_time', (data)=>{
    // time sent back to server
    console.log("-> time given back is \n ", data);
    let roomname = socket_connections_to_room[socket.id];
    if(all_rooms[roomname].time_requested == true){
      socket.broadcast.to(roomname).emit("start_video", data);  // <-----   change to this later while locally testing
      // socket.emit("transmit_video_event", data); // <-----   change to this later while locally testing
      all_rooms[roomname].time_requested = false;
    }
  });

  socket.on('transmit_video_event', (data)=>{
    console.log("->transmit event \n", data);
    let roomname = socket_connections_to_room[socket.id];

  
    socket.broadcast.to(roomname).emit("transmit_video_event", data);   // <----- change this while testing locally  
    // socket.emit("transmit_video_event",data);  // <-----   change to this later while locally testing
  });



  socket.onAny((event, data) => {
    console.log("GENERAL -------event is this:", event, " \n data is \n", data);
  });


});


  // socket.on('disconnect', () => {
  //   console.log("deleting socket", socket.id);
  //   if (socket_connections_to_room[socket.id]) {
  //     let roomname = socket_connections_to_room[socket.id];
  //     socket.leave(socket_connections_to_room[socket.id]);
  //     delete all_rooms[socket_connections_to_room[socket.id]][socket.id];
  //     if (all_rooms[socket_connections_to_room[socket.id]] &&
  //       Object.keys(all_rooms[socket_connections_to_room[socket.id]]).length === 0) {
  //       console.log("deleting room ", socket_connections_to_room[socket.id]);
  //       delete all_rooms[socket_connections_to_room[socket.id]];
  //     }
  //     if (all_rooms[socket_connections_to_room[socket.id]]) {
  //       console.log("update user list ");
  //       socket.broadcast.to(roomname).emit('connectedUsers', all_rooms[socket_connections_to_room[socket.id]]);
  //     }
  //     console.log("all rooms",all_rooms);
  //     console.log("socket to rooms",socket_connections_to_room);
  //   }
  // });





  // socket_connections_to_room[socket.id] = null;


  // socket.on('enter', (login_details) => {
  //   console.log(login_details);

  //   if (login_details.secretkey === secretkey ) {

  //     if(socket_connections_to_room[socket.id]){
  //       // already connected to a room 
  //       let roomname = socket_connections_to_room[socket.id];
  //       delete all_rooms[socket_connections_to_room[socket.id]][socket.id];
  //       if (all_rooms[socket_connections_to_room[socket.id]] &&
  //         Object.keys(all_rooms[socket_connections_to_room[socket.id]]).length === 0) {
  //         console.log("deleting room ", socket_connections_to_room[socket.id]);
  //         delete all_rooms[socket_connections_to_room[socket.id]];
  //       }
  //       if (all_rooms[socket_connections_to_room[socket.id]]) {
  //         console.log("update user list ");
  //         socket.broadcast.to(roomname).emit('connectedUsers', all_rooms[socket_connections_to_room[socket.id]]);
  //       }
  //       delete socket_connections_to_room[socket.id];
  //     }
  //     if (!(login_details.roomname in all_rooms)) {
  //       all_rooms[login_details.roomname] = {};
  //       all_rooms[login_details.roomname][socket.id] = null       
  //     }

  //     socket_connections_to_room[socket.id] = login_details.roomname;
  //     all_rooms[login_details.roomname][socket.id] = login_details.username;
  //     socket.join(login_details.roomname);
  //     console.log("connected successfully");
  //     socket.emit('enter', {successful : true});
  //     console.log("all rooms",all_rooms);
  //     console.log("socket to rooms",socket_connections_to_room);
  //   }
  //   else {
  //     socket.send('enter', { successful: false });
  //     delete socket_connections_to_room[socket.id];
  //     socket.disconnect();
  //   }
  // });


