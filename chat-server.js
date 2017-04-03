// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
	roomObject = new Array();
	originalroom = 0;
	roomObject[0] =
        {
            admin: null,
            name: "Main Lobby",
            users: [],
						password: "",
						private: false,
            // privt: 0,
            // allowedUsers: [],
            bannedUsers: []
        };

	var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];



// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.

	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.

		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){

	// This callback runs when a new Socket.IO connection is established.

	socket.on('message_to_server', function(data) {

		// This callback runs when the server receives a new message from the client.
		io.sockets.in(data.room).emit("message_to_client",{
			message: data.message,
			user: socket.username,
			color: getUsernameColor (socket.username)
	 })// broadcast the message to other users
	});

	// Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

	socket.on('new user', function(data, callback){

      var bool = true;
      for (var i = 0; i < roomObject.length; i++) {
          if (roomObject[i].users.indexOf(data) != -1) {
              callback(false);
							bool = false;
          }
      }
      if (bool) {
          callback(true);
					socket.join("Main Lobby");
          socket.username = data.trim();
					socket.room = 0;
          roomObject[socket.room].users.push(socket.username); //add the user to the main lobby

          io.sockets.in("Main Lobby").emit('current room', roomObject[socket.room]);
					updateRooms();
      }
  	});

		socket.on('new room', function(data,pass,callback){

			var bool = true;
			for (var i = 0; i < roomObject.length; i++) {
          if (roomObject[i].name == data.trim()) {
              callback(false);
							bool = false;
          }
      }
			if(bool){//
				callback(true);
				roomObject.push({
					admin: socket.username,
					name: data.trim(),
					users: [socket.username],
					password: pass,
					private: false,
					bannedUsers: []
				});
				roomObject[socket.room].users.splice(roomObject[socket.room].users.indexOf(socket.username),1);

				io.sockets.in(roomObject[socket.room].name).emit('current room', roomObject[socket.room]);
				//leave the old room and join new room
				socket.leave(roomObject[socket.room].name);
				socket.join(data.trim());

				socket.room = roomObject.length - 1;

				socket.emit('current room', roomObject[socket.room]);
				updateRooms();
			}

		});

		function updateRooms(){
			io.sockets.emit('rooms', roomObject);
		}

		socket.on('change room',function(data,callback){


			for (var i = 0; i < roomObject.length; i++) {
				if (data == roomObject[i].name) {
					var targetRoom = roomObject[i];
					if (data != roomObject[socket.room].name) {
						if (targetRoom.bannedUsers.indexOf(socket.username) != -1) {
							callback(false);
							return;
						}
						if (targetRoom.password != "") {//there is a password

							socket.emit('need password'," ");
							socket.on('password',function(password,callback){

								if (targetRoom.password == password) {//the password is correct
									//delete the user from the previous chat room

									callback(true);
									roomObject[socket.room].users.splice(roomObject[socket.room].users.indexOf(socket.username),1);
									io.sockets.in(roomObject[socket.room].name).emit('current room', roomObject[socket.room]);
									io.sockets.in(roomObject[socket.room].name).emit('leave room', socket.username);

									socket.leave(roomObject[socket.room].name);
									socket.join(data);

									//add this user to the new room
									targetRoom.users.push(socket.username);
									io.sockets.in(data).emit('current room', targetRoom);
									io.sockets.in(data).emit('join room', socket.username);

									//update the room number
									for (var j = 0; j < roomObject.length; j++) {
										if (targetRoom.name == roomObject[j].name) {
											socket.room = j;
										}
									}
									// socket.room = i;
									callback(true);
									return;
								}else{
									//the pass word is wrong
									callback(false);
								}
							});

						}else{//there is no password
							//delete the user from the previous chat room
							roomObject[socket.room].users.splice(roomObject[socket.room].users.indexOf(socket.username),1);
							io.sockets.in(roomObject[socket.room].name).emit('current room', roomObject[socket.room]);
							io.sockets.in(roomObject[socket.room].name).emit('leave room', socket.username);

							socket.leave(roomObject[socket.room].name);
							socket.join(data);

							//add this user to the new room
							targetRoom.users.push(socket.username);
							io.sockets.in(data).emit('current room', targetRoom);
							io.sockets.in(data).emit('join room', socket.username);

							//update the room number
							for (var j = 0; j < roomObject.length; j++) {
								if (targetRoom.name == roomObject[j].name) {
									socket.room = j;
								}
							}

							callback(true);
						}
					}
				}
			}
		});

		socket.on('kick user',function(data){
			io.sockets.emit('being kicked',data);
		});

		socket.on('kick me',function(data){
			//delete the user from the previous chat room
			roomObject[socket.room].users.splice(roomObject[socket.room].users.indexOf(data),1);
			io.sockets.in(roomObject[socket.room].name).emit('current room', roomObject[socket.room]);

			socket.leave(roomObject[socket.room].name);
			socket.join("Main Lobby");

			roomObject[0].users.push(data);
			io.sockets.in("Main Lobby").emit('current room', roomObject[0]);

			socket.room = 0;
		});

		socket.on('ban user',function(data){
			roomObject[socket.room].bannedUsers.push(data);
		});




		socket.on('talk Private', function(data){
	   io.sockets.emit("sendPrivateMessage",{
	    senderID: socket.id,
	    senderusername: socket.username,
	    message: data.message,
	    receiver: data.user
	   })
	  });
	    socket.on('sent message', function(data){
	   io.to(data.senderID).emit("senderPrivateMessage",data);
	   io.to(socket.id).emit("sentPrivateMessage",data);
	  });











		socket.on('disconnect', function(data){
			if (socket.username == null) {
				return;
			}
			roomObject[socket.room].users.splice(roomObject[socket.room].users.indexOf(socket.username),1);

			io.sockets.in(roomObject[socket.room].name).emit('current room', roomObject[socket.room]);
		});







});
