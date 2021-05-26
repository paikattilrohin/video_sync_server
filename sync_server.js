const debug = false;
const logs = false;

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

const { RateLimiterMemory } = require("rate-limiter-flexible");

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});


io.on("connection", (socket) => {
  socket.onAny((event, data) => {
    console.log("event is ", event, "data is", data);
  });
});
